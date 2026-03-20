/**
 * progress.js — localStorage read/write for progress state + SRS scheduling
 *
 * Storage key: jp_progress
 * Shape: { [id: string]: ProgressItem }
 *
 * ProgressItem: {
 *   id: string,           // kanji character or vocab word
 *   status: 'new' | 'learning' | 'known',
 *   lastSeen: string,     // ISO date string
 *   correctCount: number,
 *   incorrectCount: number,
 *   interval: number,     // SRS interval in days (0 = unseen)
 *   easeFactor: number,   // SM-2 ease factor (default 2.5, min 1.3)
 *   nextReview: string|null, // ISO date string for next scheduled review
 * }
 */
const Progress = (() => {
  const KEY = 'jp_progress';
  const DEFAULT_EASE = 2.5;
  const MIN_EASE = 1.3;

  function _load() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch {
      return {};
    }
  }

  function _save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
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

  /** Record a quiz result and update SRS schedule (SM-2 algorithm) */
  function recordResult(id, correct) {
    const all = _load();
    const now = new Date().toISOString();
    const prev = all[id] || {
      id,
      status: 'new',
      lastSeen: null,
      correctCount: 0,
      incorrectCount: 0,
      interval: 0,
      easeFactor: DEFAULT_EASE,
      nextReview: null,
    };

    // Backfill SRS fields for items created before SRS was added
    if (prev.interval == null) prev.interval = 0;
    if (prev.easeFactor == null) prev.easeFactor = DEFAULT_EASE;

    prev.lastSeen = now;
    if (correct) {
      prev.correctCount += 1;

      // SM-2 interval progression
      if (prev.interval === 0) {
        prev.interval = 1;
      } else if (prev.interval === 1) {
        prev.interval = 6;
      } else {
        prev.interval = Math.round(prev.interval * prev.easeFactor);
      }
      // Increase ease slightly on success (cap at 2.5)
      prev.easeFactor = Math.min(DEFAULT_EASE, prev.easeFactor + 0.1);

      // Promote status
      if (prev.status === 'new') prev.status = 'learning';
      if (prev.status === 'learning' && prev.correctCount >= 3) prev.status = 'known';
    } else {
      prev.incorrectCount += 1;

      // Reset interval, decrease ease
      prev.interval = 1;
      prev.easeFactor = Math.max(MIN_EASE, prev.easeFactor - 0.2);

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

  function reset() {
    localStorage.removeItem(KEY);
  }

  return { getAll, getItem, recordResult, getStats, getDueCount, filterItems, reset };
})();
