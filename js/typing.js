/**
 * typing.js — Dual-input typing mode (meaning + reading)
 *
 * Shows a prompt and two text inputs: one for the meaning, one for the reading.
 * Both must be correct for the card to pass.
 * Accepts any one valid answer per field (comma-delimited matching).
 * Does not start the session itself. Renders current card from Session.
 */
const Typing = (() => {
  const FEEDBACK_DELAY = 2500;

  let _waiting = false;
  let _feedbackTimer = null;
  let _onNext = null;

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

  /** Get accepted meaning answers for the current card */
  function _getAcceptedMeanings(item) {
    return (item.meanings || []).slice();
  }

  /** Get accepted reading answers for the current card */
  function _getAcceptedReadings(item) {
    const mode = Session.mode();
    if (mode === 'kanji') {
      const on = (item.readings?.on || []).map(r => r.replace(/\./g, ''));
      const kun = (item.readings?.kun || []).map(r => r.replace(/\./g, ''));
      return [...on, ...kun];
    }
    return item.reading ? [item.reading] : [];
  }

  /**
   * Check if user input matches any accepted answer.
   * User can type comma-separated values; any one match is sufficient.
   */
  function _checkField(input, acceptedAnswers) {
    if (!input.trim()) return false;
    const tokens = input.split(',').map(t => _normalize(t)).filter(Boolean);
    return tokens.some(token =>
      acceptedAnswers.some(ans => _normalize(ans) === token)
    );
  }

  /** Format accepted answers for display */
  function _formatMeanings(item) {
    return (item.meanings || []).join(', ');
  }

  function _formatReadings(item) {
    const mode = Session.mode();
    if (mode === 'kanji') {
      const parts = [];
      const on = item.readings?.on || [];
      const kun = item.readings?.kun || [];
      if (on.length) parts.push(on.join(', '));
      if (kun.length) parts.push(kun.join(', '));
      return parts.join(' · ');
    }
    return item.reading || '';
  }

  function _getPrompt(item) {
    return Session.mode() === 'kanji' ? item.character : item.word;
  }

  function _getPromptSub(item) {
    const mode = Session.mode();
    if (mode === 'kanji') return 'Kanji · Type meaning & reading';
    return 'Vocabulary · Type meaning & reading';
  }

  function _renderCard() {
    const card = Session.current();
    if (!card) return;

    _waiting = false;

    const promptEl = document.getElementById('typing-prompt');
    const promptSub = document.getElementById('typing-prompt-sub');
    const meaningInput = document.getElementById('typing-meaning');
    const readingInput = document.getElementById('typing-reading');
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

    meaningInput.value = '';
    meaningInput.disabled = false;
    meaningInput.classList.remove('input-correct', 'input-wrong');

    readingInput.value = '';
    readingInput.disabled = false;
    readingInput.classList.remove('input-correct', 'input-wrong');

    feedbackEl.innerHTML = '';
    feedbackEl.className = 'typing-feedback';
    hintEl.textContent = 'Type meaning & reading, then press Enter';
    submitBtn.textContent = 'Submit';
    submitBtn.disabled = false;

    const idx = Session.index();
    const total = Session.total();
    const { correct, incorrect } = Session.scores();
    counter.textContent = `${idx + 1} / ${total}`;
    bar.style.width = (idx / total) * 100 + '%';
    scoreCorrect.textContent = correct;
    scoreSeen.textContent = correct + incorrect;

    meaningInput.focus();
  }

  function _submitAnswer() {
    if (_waiting) return;

    const meaningInput = document.getElementById('typing-meaning');
    const readingInput = document.getElementById('typing-reading');
    const feedbackEl = document.getElementById('typing-feedback');
    const hintEl = document.getElementById('typing-hint');
    const submitBtn = document.getElementById('typing-submit');
    const card = Session.current();

    if (!card || !meaningInput || !readingInput) return;

    const meaningVal = meaningInput.value.trim();
    const readingVal = readingInput.value.trim();
    if (!meaningVal && !readingVal) return;

    _waiting = true;
    meaningInput.disabled = true;
    readingInput.disabled = true;

    const meaningCorrect = _checkField(meaningInput.value, _getAcceptedMeanings(card));
    const readingCorrect = _checkField(readingInput.value, _getAcceptedReadings(card));
    const isCorrect = meaningCorrect && readingCorrect;

    // Visual feedback per field
    meaningInput.classList.add(meaningCorrect ? 'input-correct' : 'input-wrong');
    readingInput.classList.add(readingCorrect ? 'input-correct' : 'input-wrong');

    if (isCorrect) {
      feedbackEl.className = 'typing-feedback feedback-correct';
      feedbackEl.innerHTML = `<span class="feedback-icon">&#10003;</span> Correct!`;
    } else {
      feedbackEl.className = 'typing-feedback feedback-wrong';
      const parts = [];
      if (!meaningCorrect) parts.push(`Meaning: <strong>${_formatMeanings(card)}</strong>`);
      if (!readingCorrect) parts.push(`Reading: <strong>${_formatReadings(card)}</strong>`);
      feedbackEl.innerHTML = `<span class="feedback-icon">&#10007;</span> ${parts.join(' · ')}`;
    }

    hintEl.textContent = 'Press Enter to continue';
    submitBtn.textContent = 'Next';
    submitBtn.disabled = false;

    let _advanced = false;
    const advance = () => {
      if (_advanced) return;
      _advanced = true;
      if (_feedbackTimer) { clearTimeout(_feedbackTimer); _feedbackTimer = null; }
      const done = Session.recordAndAdvance(isCorrect);
      if (done) return;
      if (_onNext) _onNext();
    };

    submitBtn.onclick = advance;
    _feedbackTimer = setTimeout(advance, FEEDBACK_DELAY);
  }

  function _onKey(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();

    if (_waiting) {
      const submitBtn = document.getElementById('typing-submit');
      if (submitBtn?.onclick) submitBtn.onclick();
    } else {
      _submitAnswer();
    }
  }

  function mount(mode, onNext) {
    _onNext = onNext;
    _waiting = false;
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
    _onNext = null;
  }

  return { mount, unmount };
})();
