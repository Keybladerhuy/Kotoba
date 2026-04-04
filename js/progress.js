/**
 * progress.js — localStorage read/write for progress state + SRS scheduling
 *
 * Storage key: jp_progress
 * Shape: { [id: string]: ProgressItem }
 *
 * ProgressItem: {
 *   id: string,              // kanji character or vocab word
 *   status: 'new' | 'learning' | 'known',
 *   lastSeen: string,        // ISO date string
 *   correctCount: number,
 *   incorrectCount: number,
 *   interval: number,        // SRS interval in days (0 = unseen)
 *   easeFactor: number,      // SM-2 ease factor (default 2.5, min 1.3)
 *   nextReview: string|null, // ISO date string for next scheduled review
 *   learningStep: number,    // index into learningSteps array (null = graduated to full SRS)
 * }
 */
const Progress = (() => {
  // Scoped per JLPT level so each level has independent progress tracking
  const _key = () => `jp_progress_${Data.getLevel()}`;

  function _load() {
    try {
      return JSON.parse(localStorage.getItem(_key()) || '{}');
    } catch {
      return {};
    }
  }

  function _save(data) {
    localStorage.setItem(_key(), JSON.stringify(data));
  }

  /** Add N days to a date, return ISO string */
  function _addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d.toISOString();
  }

  /** Check if a date string is today or in the past */
  function _isDueNow(isoString) {
    if (!isoString) return true;
    const now = new Date();
    const due = new Date(isoString);
    // Compare by calendar date (ignore time)
    now.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    return due <= now;
  }

  function getAll() {
    return _load();
  }

  function getItem(id) {
    return _load()[id] || null;
  }

  /** Record a quiz result and update SRS schedule (SM-2 algorithm with learning steps) */
  function recordResult(id, correct, studyMode) {
    const cfg = SrsSettings.getAll();
    const all = _load();
    const now = new Date().toISOString();
    const prev = all[id] || {
      id,
      status: 'new',
      lastSeen: null,
      correctCount: 0,
      incorrectCount: 0,
      interval: 0,
      easeFactor: cfg.defaultEase,
      nextReview: null,
      learningStep: 0,
    };

    // Backfill fields for items created before these features
    if (prev.interval == null) prev.interval = 0;
    if (prev.easeFactor == null) prev.easeFactor = cfg.defaultEase;
    if (prev.learningStep === undefined) {
      // Existing items with interval > 0 have already graduated
      prev.learningStep = prev.interval > 0 ? null : 0;
    }

    // Per-mode sub-counts
    if (studyMode === 'quiz' || studyMode === 'typing') {
      if (!prev[studyMode]) prev[studyMode] = { correct: 0, incorrect: 0 };
      if (correct) prev[studyMode].correct += 1;
      else prev[studyMode].incorrect += 1;
    }

    prev.lastSeen = now;
    const steps = cfg.learningSteps || [];
    const isLearning = prev.learningStep != null && steps.length > 0;

    if (correct) {
      prev.correctCount += 1;

      if (isLearning) {
        // --- Learning phase ---
        const stepIndex = prev.learningStep;
        if (stepIndex < steps.length) {
          // Use the interval from the current learning step
          prev.interval = steps[stepIndex];
          prev.learningStep = stepIndex + 1;

          // Check if we've completed all learning steps
          if (prev.learningStep >= steps.length) {
            // Graduate to full SRS
            prev.learningStep = null;
            prev.interval = cfg.graduateInterval;
          }
        }
      } else {
        // --- Full SRS phase (SM-2) ---
        prev.interval = Math.round(prev.interval * prev.easeFactor);
        // Minimum 1 day
        if (prev.interval < 1) prev.interval = 1;
      }

      // Increase ease slightly on success (cap at defaultEase)
      prev.easeFactor = Math.min(cfg.defaultEase, prev.easeFactor + cfg.easeBonus);

      // Promote status
      if (prev.status === 'new') prev.status = 'learning';
      if (prev.status === 'learning' && prev.correctCount >= cfg.knownThreshold) prev.status = 'known';
    } else {
      prev.incorrectCount += 1;

      // Reset to first learning step
      if (steps.length > 0) {
        prev.learningStep = 0;
      }
      prev.interval = steps.length > 0 ? steps[0] : 1;

      // Decrease ease
      prev.easeFactor = Math.max(cfg.minEase, prev.easeFactor - cfg.easePenalty);

      // Demote status
      if (prev.status === 'known') prev.status = 'learning';
    }

    prev.nextReview = _addDays(now, prev.interval);
    all[id] = prev;
    _save(all);
  }

  /** Stats for a set of item IDs */
  function getStats(ids) {
    const all = _load();
    let known = 0, learning = 0, unseen = 0;
    for (const id of ids) {
      const item = all[id];
      if (!item || item.status === 'new') unseen++;
      else if (item.status === 'known') known++;
      else learning++;
    }
    return { total: ids.length, known, learning, unseen };
  }

  /** Count how many items from `ids` are due for SRS review right now */
  function getDueCount(ids) {
    const all = _load();
    let count = 0;
    for (const id of ids) {
      const item = all[id];
      // New/unseen items count as due
      if (!item || item.status === 'new') { count++; continue; }
      // Items whose nextReview is today or past are due
      if (_isDueNow(item.nextReview)) count++;
    }
    return count;
  }

  /** Filter a list of items by mode */
  function filterItems(items, getId, mode) {
    if (mode === 'all') return items;
    const all = _load();
    return items.filter(item => {
      const p = all[getId(item)];
      if (mode === 'new') return !p || p.status === 'new';
      if (mode === 'learning') return p && p.status === 'learning';
      if (mode === 'due') return !p || p.status === 'new' || p.status === 'learning';
      if (mode === 'srs') {
        if (!p || p.status === 'new') return true;
        return _isDueNow(p.nextReview);
      }
      return true;
    });
  }

  /** Full progress records for a list of IDs (stubs for unseen items) */
  function getAllItemDetails(ids) {
    const cfg = SrsSettings.getAll();
    const all = _load();
    return ids.map(id => all[id] || {
      id,
      status: 'new',
      lastSeen: null,
      correctCount: 0,
      incorrectCount: 0,
      interval: 0,
      easeFactor: cfg.defaultEase,
      nextReview: null,
      learningStep: 0,
    });
  }

  /** Count items due today, tomorrow, and within 7 days */
  function getUpcomingReviews(ids) {
    const all = _load();
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
    const tmrwEnd = new Date(tomorrow); tmrwEnd.setDate(tmrwEnd.getDate() + 1);
    const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7);
    let today = 0, tmrw = 0, week = 0;
    for (const id of ids) {
      const item = all[id];
      if (!item || !item.nextReview) continue;
      const due = new Date(item.nextReview); due.setHours(0, 0, 0, 0);
      if (due <= now) today++;
      else if (due < tmrwEnd) tmrw++;
      if (due <= weekEnd) week++;
    }
    return { today, tomorrow: tmrw, thisWeek: week };
  }

  function reset() {
    localStorage.removeItem(_key());
  }

  return { getAll, getItem, recordResult, getStats, getDueCount, filterItems, getAllItemDetails, getUpcomingReviews, reset };
})();
