/**
 * session.js — Shared session state for Flashcard and Quiz modes
 *
 * Manages: deck, shuffle, index, scoring, progress updates.
 * Both Flashcard and Quiz delegate session bookkeeping here.
 *
 * Repeat-wrong-cards: when enabled, missed cards are re-inserted later
 * in the deck. Each wrong answer adds one required correct repeat.
 * The card keeps reappearing until the user answers it correctly
 * enough times to "make up" for the mistakes.
 */
const Session = (() => {
  let _deck = [];
  let _index = 0;
  let _correct = 0;
  let _incorrect = 0;
  let _mode = 'kanji';
  let _studyMode = 'flashcard';
  let _onComplete = null;
  let _originalTotal = 0;

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

  function start(mode, items, onComplete, studyMode) {
    _mode = mode;
    _studyMode = studyMode || 'flashcard';
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

  /** Insert item at a random position between minAhead and end of deck */
  function _reinsert(item) {
    // Place it at least 2 cards ahead (or at the end if deck is short)
    const minPos = _index + 2;
    const maxPos = _deck.length; // will be pushed, so length = last+1
    const pos = minPos >= maxPos
      ? maxPos
      : minPos + Math.floor(Math.random() * (maxPos - minPos + 1));
    _deck.splice(pos, 0, item);
  }

  /** Record a result and advance. Returns true if session is complete. */
  function recordAndAdvance(correct) {
    const card = _deck[_index];
    const id = getId(card);
    const repeatEnabled = SrsSettings.get('repeatWrongCards');

    // Initialize repeat tracking for this card if needed
    if (!_repeatMap[id]) {
      _repeatMap[id] = { wrongCount: 0, correctNeeded: 0 };
    }

    if (correct) {
      _correct++;

      if (_repeatMap[id].correctNeeded > 0) {
        // This is a repeat card — count down
        _repeatMap[id].correctNeeded--;
        if (_repeatMap[id].correctNeeded > 0) {
          // Still needs more correct answers — re-insert
          _reinsert(card);
        } else {
          // Fully made up — record the final correct to SRS
          Progress.recordResult(id, true, _studyMode);
        }
      } else {
        // Normal correct — record to SRS
        Progress.recordResult(id, true, _studyMode);
      }
    } else {
      _incorrect++;
      Progress.recordResult(id, false, _studyMode);

      if (repeatEnabled) {
        _repeatMap[id].wrongCount++;
        _repeatMap[id].correctNeeded++;
        _reinsert(card);
      }
    }

    _index++;
    if (_index >= _deck.length) {
      _onComplete && _onComplete(scores());
      return true;
    }
    return false;
  }

  /** Get all items in the deck (for distractor generation). */
  function allItems() {
    return _deck;
  }

  /** Get repeat info for the current card (for UI display) */
  function getRepeatInfo() {
    const card = _deck[_index];
    if (!card) return null;
    const id = getId(card);
    return _repeatMap[id] || null;
  }

  return { shuffle, start, getId, current, mode, total, originalTotal, index, scores, recordAndAdvance, allItems, getRepeatInfo };
})();
