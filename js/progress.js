/**
 * progress.js — localStorage read/write for mastery-level progress
 *
 * Storage key: jp_progress_<level>
 * Shape: { [id: string]: ProgressItem }
 *
 * ProgressItem: {
 *   id: string,              // kanji character or vocab word
 *   masteryLevel: 0|1|2|3,   // 0=unseen, 1=passed flashcard, 2=passed quiz, 3=mastered
 *   lastSeen: string|null,   // ISO date string
 *   correctCount: number,
 *   incorrectCount: number,
 * }
 */
const Progress = (() => {
  const _key = () => `jp_progress_${Data.getLevel()}`;

  function _load() {
    try {
      const raw = JSON.parse(localStorage.getItem(_key()) || '{}');
      // Migrate old SRS format if detected
      const needsMigration = Object.values(raw).some(item => item.status !== undefined);
      if (needsMigration) {
        for (const [id, item] of Object.entries(raw)) {
          if (item.status !== undefined) {
            item.masteryLevel = item.status === 'known' ? 2
                              : item.status === 'learning' ? 1
                              : 0;
            delete item.status;
            delete item.interval;
            delete item.easeFactor;
            delete item.nextReview;
            delete item.learningStep;
            delete item.quiz;
            delete item.typing;
          }
        }
        localStorage.setItem(_key(), JSON.stringify(raw));
      }
      return raw;
    } catch {
      return {};
    }
  }

  function _save(data) {
    localStorage.setItem(_key(), JSON.stringify(data));
  }

  function getAll() {
    return _load();
  }

  function getItem(id) {
    return _load()[id] || null;
  }

  /** Record a study result. On correct: advance masteryLevel by 1. On wrong: no level change. */
  function recordResult(id, correct) {
    const all = _load();
    const now = new Date().toISOString();
    const prev = all[id] || {
      id,
      masteryLevel: 0,
      lastSeen: null,
      correctCount: 0,
      incorrectCount: 0,
    };

    prev.lastSeen = now;

    if (correct) {
      prev.correctCount += 1;
      if (prev.masteryLevel < 3) {
        prev.masteryLevel += 1;
      }
    } else {
      prev.incorrectCount += 1;
    }

    all[id] = prev;
    _save(all);
  }

  /** Stats for a set of item IDs */
  function getStats(ids) {
    const all = _load();
    let mastered = 0, inProgress = 0, unseen = 0;
    for (const id of ids) {
      const item = all[id];
      if (!item || item.masteryLevel === 0) unseen++;
      else if (item.masteryLevel === 3) mastered++;
      else inProgress++;
    }
    return { total: ids.length, mastered, inProgress, unseen };
  }

  /** Filter a list of items by mode */
  function filterItems(items, getId, mode) {
    if (mode === 'all') return items;
    const all = _load();
    return items.filter(item => {
      const p = all[getId(item)];
      if (mode === 'notmastered') return !p || p.masteryLevel < 3;
      if (mode === 'unseen') return !p || p.masteryLevel === 0;
      return true;
    });
  }

  /** Full progress records for a list of IDs (stubs for unseen items) */
  function getAllItemDetails(ids) {
    const all = _load();
    return ids.map(id => all[id] || {
      id,
      masteryLevel: 0,
      lastSeen: null,
      correctCount: 0,
      incorrectCount: 0,
    });
  }

  function reset() {
    localStorage.removeItem(_key());
  }

  return { getAll, getItem, recordResult, getStats, filterItems, getAllItemDetails, reset };
})();
