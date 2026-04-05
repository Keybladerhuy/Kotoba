/**
 * session.js — Shared session state for unified study flow
 *
 * Manages: deck, shuffle, index, scoring, progress updates.
 * Cards progress through mastery levels within a single session:
 *   Level 0 → Flashcard, Level 1 → Quiz, Level 2 → Typing, Level 3 → Mastered
 *
 * Repeat-wrong-cards is always on: missed cards are re-inserted later
 * in the deck at the same level. Correct cards advance a level and
 * are re-inserted to be tested in the next mode.
 */
const Session = (() => {
  let _deck = [];
  let _index = 0;
  let _correct = 0;
  let _incorrect = 0;
  let _mode = 'kanji';
  let _onComplete = null;
  let _originalTotal = 0;
  let _allPool = []; // full data pool for quiz distractor generation

  // Repeat-wrong tracking: cardId → { wrongCount, correctNeeded }
  let _repeatMap = {};

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function start(mode, items, allPool, onComplete) {
    _mode = mode;
    _allPool = allPool || [];
    _deck = shuffle(items);
    _index = 0;
    _correct = 0;
    _incorrect = 0;
    _onComplete = onComplete;
    _originalTotal = items.length;
    _repeatMap = {};
  }

  function getId(item) {
    return _mode === 'kanji' ? item.character : item.word;
  }

  function current() {
    return _deck[_index] || null;
  }

  /** Get the study mode for the current card based on its mastery level */
  function currentMode() {
    const card = _deck[_index];
    if (!card) return null;
    const id = getId(card);
    const progress = Progress.getItem(id);
    const level = progress ? progress.masteryLevel : 0;
    if (level === 0) return 'flashcard';
    if (level === 1) return 'quiz';
    if (level === 2) return 'typing';
    return null; // level 3 = mastered, shouldn't be in deck
  }

  function mode() {
    return _mode;
  }

  function total() {
    return _deck.length;
  }

  function originalTotal() {
    return _originalTotal;
  }

  function index() {
    return _index;
  }

  function scores() {
    return { correct: _correct, incorrect: _incorrect, total: _originalTotal };
  }

  function allPool() {
    return _allPool;
  }

  /** Insert item at a random position between minAhead and end of deck */
  function _reinsert(item) {
    const minPos = _index + 2;
    const maxPos = _deck.length;
    const pos = minPos >= maxPos
      ? maxPos
      : minPos + Math.floor(Math.random() * (maxPos - minPos + 1));
    _deck.splice(pos, 0, item);
  }

  /** Record a result and advance. Returns true if session is complete. */
  function recordAndAdvance(correct) {
    const card = _deck[_index];
    const id = getId(card);

    if (!_repeatMap[id]) {
      _repeatMap[id] = { wrongCount: 0, correctNeeded: 0 };
    }

    if (correct) {
      _correct++;

      if (_repeatMap[id].correctNeeded > 0) {
        // Repeat card — count down
        _repeatMap[id].correctNeeded--;
        if (_repeatMap[id].correctNeeded > 0) {
          // Still needs more correct answers — re-insert at same level
          _reinsert(card);
        } else {
          // Fully made up — record correct (advances mastery level)
          Progress.recordResult(id, true);
          // Re-insert only if not yet mastered (level < 3)
          const updated = Progress.getItem(id);
          if (updated && updated.masteryLevel < 3) {
            _repeatMap[id] = { wrongCount: 0, correctNeeded: 0 };
            _reinsert(card);
          }
        }
      } else {
        // Normal correct — record to progress (advances mastery level)
        Progress.recordResult(id, true);
        // Re-insert only if not yet mastered (level < 3)
        const updated = Progress.getItem(id);
        if (updated && updated.masteryLevel < 3) {
          _reinsert(card);
        }
      }
    } else {
      _incorrect++;
      Progress.recordResult(id, false);

      // Always repeat wrong cards
      _repeatMap[id].wrongCount++;
      _repeatMap[id].correctNeeded++;
      _reinsert(card);
    }

    _index++;
    if (_index >= _deck.length) {
      _onComplete && _onComplete(scores());
      return true;
    }
    return false;
  }

  /** Get repeat info for the current card (for UI display) */
  function getRepeatInfo() {
    const card = _deck[_index];
    if (!card) return null;
    const id = getId(card);
    return _repeatMap[id] || null;
  }

  return { shuffle, start, getId, current, currentMode, mode, total, originalTotal, index, scores, allPool, recordAndAdvance, getRepeatInfo };
})();
