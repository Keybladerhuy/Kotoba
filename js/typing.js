/**
 * typing.js — Type-answer quiz mode
 *
 * Shows a prompt (kanji character or vocab word) and a text input.
 * User types the meaning or reading. Validates against accepted answers.
 * Keyboard: Enter to submit, Enter again to advance after feedback.
 */
const Typing = (() => {
  const FEEDBACK_DELAY = 1500;

  let _subMode = 'meaning'; // 'meaning' | 'reading' | 'mixed'
  let _questionType = 'meaning'; // per-card: 'meaning' or 'reading'
  let _waiting = false;
  let _feedbackTimer = null;

  /** Convert katakana to hiragana */
  function _kataToHira(str) {
    return str.replace(/[\u30A1-\u30F6]/g, ch =>
      String.fromCharCode(ch.charCodeAt(0) - 0x60)
    );
  }

  /** Normalize a string for comparison */
  function _normalize(str) {
    return _kataToHira(str.trim().toLowerCase().replace(/\./g, ''));
  }

  /** Get the list of accepted answers for the current card */
  function _getAcceptedAnswers(item) {
    const mode = Session.mode();

    if (_questionType === 'meaning') {
      return (item.meanings || []).slice();
    }

    // Reading mode
    if (mode === 'kanji') {
      const on = (item.readings?.on || []).map(r => r.replace(/\./g, ''));
      const kun = (item.readings?.kun || []).map(r => r.replace(/\./g, ''));
      return [...on, ...kun];
    }
    // Vocab
    return [item.reading];
  }

  /** Check if user input matches any accepted answer */
  function _checkAnswer(input, item) {
    const normalized = _normalize(input);
    if (!normalized) return false;

    const accepted = _getAcceptedAnswers(item);
    return accepted.some(ans => _normalize(ans) === normalized);
  }

  /** Format accepted answers for display */
  function _formatAnswers(item) {
    const mode = Session.mode();

    if (_questionType === 'meaning') {
      return (item.meanings || []).join(', ');
    }

    if (mode === 'kanji') {
      const parts = [];
      const on = item.readings?.on || [];
      const kun = item.readings?.kun || [];
      if (on.length) parts.push('On: ' + on.join(', '));
      if (kun.length) parts.push('Kun: ' + kun.join(', '));
      return parts.join(' · ');
    }
    return item.reading;
  }

  function _getPrompt(item) {
    return Session.mode() === 'kanji' ? item.character : item.word;
  }

  function _getPromptSub(item) {
    const mode = Session.mode();
    const typeLabel = _questionType === 'meaning' ? 'Type the meaning' : 'Type the reading';
    if (mode === 'kanji') return `Kanji · ${typeLabel}`;
    return `Vocabulary · ${typeLabel}`;
  }

  function _pickQuestionType() {
    if (_subMode === 'meaning') return 'meaning';
    if (_subMode === 'reading') return 'reading';
    return Math.random() < 0.5 ? 'meaning' : 'reading';
  }

  function _renderCard() {
    const card = Session.current();
    if (!card) return;

    _questionType = _pickQuestionType();
    _waiting = false;

    const promptEl = document.getElementById('typing-prompt');
    const promptSub = document.getElementById('typing-prompt-sub');
    const inputEl = document.getElementById('typing-input');
    const feedbackEl = document.getElementById('typing-feedback');
    const counter = document.getElementById('typing-card-counter');
    const bar = document.getElementById('typing-progress-bar');
    const scoreCorrect = document.getElementById('typing-score-correct');
    const scoreSeen = document.getElementById('typing-score-seen');
    const hintEl = document.getElementById('typing-hint');
    const submitBtn = document.getElementById('typing-submit');

    if (!promptEl) return;

    promptEl.textContent = _getPrompt(card);
    promptSub.textContent = _getPromptSub(card);
    inputEl.value = '';
    inputEl.disabled = false;
    inputEl.classList.remove('input-correct', 'input-wrong');
    feedbackEl.innerHTML = '';
    feedbackEl.className = 'typing-feedback';
    hintEl.textContent = _questionType === 'meaning'
      ? 'Type in English, then press Enter'
      : 'Type in kana, then press Enter';
    submitBtn.textContent = 'Submit';
    submitBtn.disabled = false;

    const idx = Session.index();
    const total = Session.total();
    const { correct, incorrect } = Session.scores();
    counter.textContent = `${idx + 1} / ${total}`;
    bar.style.width = (idx / total) * 100 + '%';
    scoreCorrect.textContent = correct;
    scoreSeen.textContent = correct + incorrect;

    inputEl.focus();
  }

  function _submitAnswer() {
    if (_waiting) return;

    const inputEl = document.getElementById('typing-input');
    const feedbackEl = document.getElementById('typing-feedback');
    const hintEl = document.getElementById('typing-hint');
    const submitBtn = document.getElementById('typing-submit');
    const card = Session.current();

    if (!card || !inputEl) return;

    const userAnswer = inputEl.value.trim();
    if (!userAnswer) return;

    _waiting = true;
    inputEl.disabled = true;

    const isCorrect = _checkAnswer(userAnswer, card);
    const allAnswers = _formatAnswers(card);

    if (isCorrect) {
      inputEl.classList.add('input-correct');
      feedbackEl.className = 'typing-feedback feedback-correct';
      feedbackEl.innerHTML = `<span class="feedback-icon">&#10003;</span> Correct!`;
    } else {
      inputEl.classList.add('input-wrong');
      feedbackEl.className = 'typing-feedback feedback-wrong';
      feedbackEl.innerHTML = `<span class="feedback-icon">&#10007;</span> <strong>${allAnswers}</strong>`;
    }

    hintEl.textContent = 'Press Enter to continue';
    submitBtn.textContent = 'Next';
    submitBtn.disabled = false;

    // Allow Enter to advance (one-shot to prevent double-advance)
    let _advanced = false;
    const advance = () => {
      if (_advanced) return;
      _advanced = true;
      if (_feedbackTimer) { clearTimeout(_feedbackTimer); _feedbackTimer = null; }
      const done = Session.recordAndAdvance(isCorrect);
      if (!done) _renderCard();
    };

    submitBtn.onclick = advance;
    _feedbackTimer = setTimeout(advance, FEEDBACK_DELAY + 1000);
  }

  function _onKey(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();

    if (_waiting) {
      // Advance immediately on Enter during feedback
      const submitBtn = document.getElementById('typing-submit');
      if (submitBtn?.onclick) submitBtn.onclick();
    } else {
      _submitAnswer();
    }
  }

  function mount(mode, items, typingSubMode, onComplete) {
    _subMode = typingSubMode || 'meaning';
    _waiting = false;
    Session.start(mode, items, onComplete, 'typing');
    _renderCard();

    document.addEventListener('keydown', _onKey);

    const submitBtn = document.getElementById('typing-submit');
    if (submitBtn) {
      submitBtn.onclick = () => _submitAnswer();
    }
  }

  function unmount() {
    document.removeEventListener('keydown', _onKey);
    if (_feedbackTimer) {
      clearTimeout(_feedbackTimer);
      _feedbackTimer = null;
    }
    _waiting = false;
  }

  return { mount, unmount };
})();
