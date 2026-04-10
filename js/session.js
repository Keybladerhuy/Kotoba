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

  // Per-card session tracking
  let _originalCards = []; // original cards in session order (for dot display)
  let _cardSeen = new Set(); // IDs of cards attempted at least once
  let _cardLastWrong = new Set(); // IDs whose most recent attempt was wrong
  let _streak = 0;

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
    _originalCards = [...items];
    _cardSeen = new Set();
    _cardLastWrong = new Set();
    _streak = 0;
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
    if (level >= 0 && level <= 2) return 'staged-typing';
    return null; // level 3 = mastered, shouldn't be in deck
  }

  /** Skip past any already-mastered cards in the deck.
   *  Returns true if the session is complete after skipping. */
  function skipMastered() {
    while (_index < _deck.length) {
      const card = _deck[_index];
      const id = getId(card);
      const progress = Progress.getItem(id);
      const level = progress ? progress.masteryLevel : 0;
      if (level < 3) return false; // found a non-mastered card
      _index++;
    }
    // Deck exhausted
    _onComplete && _onComplete(scores());
    return true;
  }

  /** Get the current card's mastery level (0, 1, or 2) for staged hint display */
  function currentStage() {
    const card = _deck[_index];
    if (!card) return 0;
    const id = getId(card);
    const progress = Progress.getItem(id);
    return progress ? progress.masteryLevel : 0;
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

    _cardSeen.add(id);
    if (correct) {
      _cardLastWrong.delete(id);
      _streak++;
    } else {
      _cardLastWrong.add(id);
      _streak = 0;
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
      Progress.resetMastery(id);

      // Always repeat wrong cards — reset to stage 0
      _repeatMap[id].wrongCount++;
      _repeatMap[id].correctNeeded = 0;
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

  function originalCards() {
    return _originalCards;
  }

  /** Get the session state for a card: 'unseen' | 'wrong' | 'stage-1' | 'stage-2' | 'mastered' */
  function cardState(id) {
    if (_cardLastWrong.has(id)) return 'wrong';
    if (!_cardSeen.has(id)) return 'unseen';
    const p = Progress.getItem(id);
    const m = p ? p.masteryLevel : 0;
    if (m >= 3) return 'mastered';
    if (m === 2) return 'stage-2';
    if (m === 1) return 'stage-1';
    return 'unseen';
  }

  function streak() {
    return _streak;
  }

  return { shuffle, start, getId, current, currentMode, currentStage, mode, total, originalTotal, index, scores, allPool, recordAndAdvance, skipMastered, getRepeatInfo, originalCards, cardState, streak };
})();
