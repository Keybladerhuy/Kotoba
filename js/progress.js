/**
 * progress.js — localStorage read/write for progress state
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
 * }
 */
const Progress = (() => {
  const KEY = 'jp_progress';

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

  function getAll() {
    return _load();
  }

  function getItem(id) {
    return _load()[id] || null;
  }

  /** Record a quiz result for a single item */
  function recordResult(id, correct) {
    const all = _load();
    const now = new Date().toISOString();
    const prev = all[id] || {
      id,
      status: 'new',
      lastSeen: null,
      correctCount: 0,
      incorrectCount: 0,
    };

    prev.lastSeen = now;
    if (correct) {
      prev.correctCount += 1;
      // Promote status: new -> learning after 1 correct, learning -> known after 3 total correct
      if (prev.status === 'new') prev.status = 'learning';
      if (prev.status === 'learning' && prev.correctCount >= 3) prev.status = 'known';
    } else {
      prev.incorrectCount += 1;
      // Demote: known -> learning if wrong
      if (prev.status === 'known') prev.status = 'learning';
    }

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

  /** Filter a list of items by mode */
  function filterItems(items, getId, mode) {
    if (mode === 'all') return items;
    const all = _load();
    return items.filter(item => {
      const p = all[getId(item)];
      if (mode === 'new') return !p || p.status === 'new';
      if (mode === 'learning') return p && p.status === 'learning';
      if (mode === 'due') return !p || p.status === 'new' || p.status === 'learning';
      return true;
    });
  }

  function reset() {
    localStorage.removeItem(KEY);
  }

  return { getAll, getItem, recordResult, getStats, filterItems, reset };
})();
