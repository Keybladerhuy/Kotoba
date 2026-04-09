/**
 * typing.js — Dual-input typing mode (meaning + reading)
 *
 * Shows a prompt and two text inputs: one for the meaning, one for the reading.
 * Both must be correct for the card to pass.
 * Accepts any one valid answer per field (comma-delimited matching).
 * Does not start the session itself. Renders current card from Session.
 */
const Typing = (() => {
  let _waiting = false;
  let _onNext = null;
  let _ghostMeaning = '';
  let _ghostReading = '';

  let _streak = 0;

  const _praise = [
    '🎯 Spot on!', '✨ Perfect!', '🔥 Nice!', '💪 Nailed it!',
    '⭐ Great!', '🎉 Yes!', '👏 Got it!', '💫 Brilliant!'
  ];
  const _streakPraise = [
    { min: 3, msgs: ['🔥 On fire! x', '🔥 Blazing! x', '🔥 Hot streak! x'] },
    { min: 5, msgs: ['⚡ Unstoppable! x', '⚡ Dominating! x', '💥 Crushing it! x'] },
    { min: 10, msgs: ['🏆 Legendary! x', '👑 Master! x', '🌟 Incredible! x'] },
  ];
  function _getPraise() {
    for (let i = _streakPraise.length - 1; i >= 0; i--) {
      if (_streak >= _streakPraise[i].min) {
        const msgs = _streakPraise[i].msgs;
        return msgs[Math.floor(Math.random() * msgs.length)] + _streak;
      }
    }
    return _praise[Math.floor(Math.random() * _praise.length)];
  }

  function _addInlineFeedback(inputEl, correct, correctionText, delay) {
    const wrapper = inputEl.closest('.typing-input-wrapper');
    if (!wrapper) return;
    const old = wrapper.querySelector('.typing-inline-feedback');
    if (old) old.remove();
    setTimeout(() => {
      if (correct) inputEl.classList.add('glow-pulse');
      const fb = document.createElement('span');
      fb.className = 'typing-inline-feedback';
      if (correct) {
        fb.classList.add('feedback-correct');
        fb.innerHTML = '✓ ' + EmojiFx.buildPraiseHTML(_getPraise());
      } else {
        fb.classList.add('feedback-wrong');
        fb.textContent = correctionText;
      }
      wrapper.appendChild(fb);
    }, delay || 0);
  }

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

  /** Update ghost hint overlay for an input field */
  function _updateGhost(inputEl, ghostEl, answer) {
    const value = inputEl.value;

    inputEl.classList.remove('input-error');

    if (!value) {
      ghostEl.textContent = answer;
      ghostEl.style.opacity = '0.35';
      return;
    }

    const normalVal = _normalize(value);
    const normalAns = _normalize(answer);

    if (normalAns.startsWith(normalVal)) {
      // Correct so far — show typed portion (invisible) + remaining as ghost
      // Use the original answer casing for display
      const matchLen = value.length;
      const spacer = answer.slice(0, matchLen);
      const remainder = answer.slice(matchLen);
      ghostEl.innerHTML = '<span style="visibility:hidden">' + _escHtml(spacer) + '</span>' + _escHtml(remainder);
      ghostEl.style.opacity = normalVal === normalAns ? '0' : '0.35';
    } else {
      // Wrong input — hide ghost
      ghostEl.style.opacity = '0';
      inputEl.classList.add('input-error');
    }
  }

  function _escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _onMeaningInput() {
    const input = document.getElementById('typing-meaning');
    const ghost = document.getElementById('typing-ghost-meaning');
    if (input && ghost) _updateGhost(input, ghost, _ghostMeaning);
  }

  function _onReadingInput() {
    const input = document.getElementById('typing-reading');
    const ghost = document.getElementById('typing-ghost-reading');
    if (input && ghost) _updateGhost(input, ghost, _ghostReading);
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

    // Set ghost hint answers (first accepted answer for each field)
    const meanings = _getAcceptedMeanings(card);
    const readings = _getAcceptedReadings(card);
    _ghostMeaning = meanings[0] || '';
    _ghostReading = readings[0] || '';

    meaningInput.value = '';
    meaningInput.disabled = false;
    meaningInput.classList.remove('input-correct', 'input-wrong', 'input-error', 'glow-pulse');

    readingInput.value = '';
    readingInput.disabled = false;
    readingInput.classList.remove('input-correct', 'input-wrong', 'input-error', 'glow-pulse');

    // Clear old inline feedback
    document.querySelectorAll('.typing-input-wrapper .typing-inline-feedback').forEach(el => el.remove());

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

    // Initialize ghost hints
    const ghostMeaningEl = document.getElementById('typing-ghost-meaning');
    const ghostReadingEl = document.getElementById('typing-ghost-reading');
    if (ghostMeaningEl) {
      ghostMeaningEl.textContent = _ghostMeaning;
      ghostMeaningEl.style.opacity = '0.35';
    }
    if (ghostReadingEl) {
      ghostReadingEl.textContent = _ghostReading;
      ghostReadingEl.style.opacity = '0.35';
    }

    // Attach input listeners for ghost updates
    meaningInput.removeEventListener('input', _onMeaningInput);
    meaningInput.addEventListener('input', _onMeaningInput);
    readingInput.removeEventListener('input', _onReadingInput);
    readingInput.addEventListener('input', _onReadingInput);

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
    meaningInput.classList.remove('input-error');
    readingInput.classList.remove('input-error');

    // Hide ghost hints on submit
    const ghostM = document.getElementById('typing-ghost-meaning');
    const ghostR = document.getElementById('typing-ghost-reading');
    if (ghostM) ghostM.style.opacity = '0';
    if (ghostR) ghostR.style.opacity = '0';

    const meaningCorrect = _checkField(meaningInput.value, _getAcceptedMeanings(card));
    const readingCorrect = _checkField(readingInput.value, _getAcceptedReadings(card));
    const isCorrect = meaningCorrect && readingCorrect;

    // Visual feedback per field
    meaningInput.classList.add(meaningCorrect ? 'input-correct' : 'input-wrong');
    readingInput.classList.add(readingCorrect ? 'input-correct' : 'input-wrong');

    // Update streak
    if (isCorrect) { _streak++; } else { _streak = 0; }

    // Staggered inline feedback on the right side of each input
    _addInlineFeedback(meaningInput, meaningCorrect, _formatMeanings(card), 0);
    _addInlineFeedback(readingInput, readingCorrect, _formatReadings(card), 120);

    feedbackEl.innerHTML = '';
    feedbackEl.className = 'typing-feedback';

    hintEl.textContent = 'Press Enter to continue';
    submitBtn.textContent = 'Next';
    submitBtn.disabled = false;

    let _advanced = false;
    const advance = () => {
      if (_advanced) return;
      _advanced = true;
      const done = Session.recordAndAdvance(isCorrect);
      if (done) return;
      if (_onNext) _onNext();
    };

    submitBtn.onclick = advance;
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
    const meaningInput = document.getElementById('typing-meaning');
    const readingInput = document.getElementById('typing-reading');
    if (meaningInput) meaningInput.removeEventListener('input', _onMeaningInput);
    if (readingInput) readingInput.removeEventListener('input', _onReadingInput);
    _waiting = false;
    _onNext = null;
  }

  return { mount, unmount };
})();
