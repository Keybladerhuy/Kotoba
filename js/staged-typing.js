/**
 * staged-typing.js — 3-stage typing quiz with progressive hints
 *
 * Stage 0 (mastery 0→1): Full hints shown (faded), unfade as typed correctly
 * Stage 1 (mastery 1→2): Partial hints (first half + "...")
 * Stage 2 (mastery 2→3): No hints
 *
 * Kanji: On Reading + Kun Reading + Meaning fields
 * Vocab: Reading + Meaning fields
 */
const StagedTyping = (() => {
  let _waiting = false;
  let _onNext = null;
  let _fields = []; // current field config

  /** Convert katakana to hiragana */
  function _kataToHira(str) {
    return str.replace(/[\u30A1-\u30F6]/g, ch =>
      String.fromCharCode(ch.charCodeAt(0) - 0x60)
    );
  }

  /** Convert hiragana to katakana */
  function _hiraToKata(str) {
    return str.replace(/[\u3041-\u3096]/g, ch =>
      String.fromCharCode(ch.charCodeAt(0) + 0x60)
    );
  }

  /** Auto-convert kana in an input field, preserving cursor position */
  function _autoConvertKana(inputEl, converter) {
    const pos = inputEl.selectionStart;
    const converted = converter(inputEl.value);
    if (converted !== inputEl.value) {
      inputEl.value = converted;
      inputEl.setSelectionRange(pos, pos);
    }
  }

  /** Normalize a string for comparison */
  function _normalize(str) {
    return _kataToHira(str.trim().toLowerCase().replace(/\./g, ''));
  }

  /** Generate hint text based on stage */
  function _getHintText(answer, stage) {
    if (stage === 0) return answer;
    if (stage === 1) {
      const half = Math.ceil(answer.length / 2);
      return answer.slice(0, half) + '...';
    }
    return '';
  }

  /** Escape HTML for safe insertion */
  function _escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Streak is now tracked in Session module

  const _praise = [
    '🎯 Spot on!', '✨ Perfect!', '🔥 Nice!', '💪 Nailed it!',
    '⭐ Great!', '🎉 Yes!', '👏 Got it!', '💫 Brilliant!'
  ];
  const _streakPraise = [
    { min: 3, msgs: ['🔥 On fire! x', '🔥 Blazing! x', '🔥 Hot streak! x'] },
    { min: 5, msgs: ['⚡ Unstoppable! x', '⚡ Dominating! x', '💥 Crushing it! x'] },
    { min: 10, msgs: ['🏆 Legendary! x', '👑 Master! x', '🌟 Incredible! x'] },
  ];
  function _getPraise(nextStreak) {
    const s = nextStreak !== undefined ? nextStreak : Session.streak();
    for (let i = _streakPraise.length - 1; i >= 0; i--) {
      if (s >= _streakPraise[i].min) {
        const msgs = _streakPraise[i].msgs;
        return msgs[Math.floor(Math.random() * msgs.length)] + s;
      }
    }
    return _praise[Math.floor(Math.random() * _praise.length)];
  }

  /** Update ghost hint overlay for an input.
   *  For partial hints (e.g. "fo..."), only validate against the known prefix.
   *  Once the user types past the hint, hide the ghost and stop validating. */
  function _updateGhost(inputEl, ghostEl, hintText) {
    const value = inputEl.value;
    inputEl.classList.remove('input-error');

    if (!value) {
      ghostEl.textContent = hintText;
      ghostEl.style.opacity = '0.35';
      return;
    }

    // Determine if this is a partial hint (ends with "...")
    const isPartial = hintText.endsWith('...');
    const knownPrefix = isPartial ? hintText.slice(0, -3) : hintText;
    const normalPrefix = _normalize(knownPrefix);
    const normalVal = _normalize(value);

    if (isPartial) {
      // Only validate up to the known prefix length
      const valCheck = normalVal.slice(0, normalPrefix.length);
      if (normalPrefix.startsWith(valCheck)) {
        // Still within or matches the known prefix — show ghost
        if (value.length < hintText.length) {
          const spacer = hintText.slice(0, value.length);
          const remainder = hintText.slice(value.length);
          ghostEl.innerHTML = '<span style="visibility:hidden">' + _escHtml(spacer) + '</span>' + _escHtml(remainder);
          ghostEl.style.opacity = '0.35';
        } else {
          // Typed past the hint — hide ghost, no error
          ghostEl.style.opacity = '0';
        }
      } else {
        // Wrong within the known prefix portion
        ghostEl.style.opacity = '0';
        inputEl.classList.add('input-error');
      }
    } else {
      // Full hint — validate against the entire answer
      const normalHint = _normalize(hintText);
      if (normalHint.startsWith(normalVal)) {
        const matchLen = value.length;
        const spacer = hintText.slice(0, matchLen);
        const remainder = hintText.slice(matchLen);
        ghostEl.innerHTML = '<span style="visibility:hidden">' + _escHtml(spacer) + '</span>' + _escHtml(remainder);
        ghostEl.style.opacity = normalVal === normalHint ? '0' : '0.35';
      } else {
        ghostEl.style.opacity = '0';
        inputEl.classList.add('input-error');
      }
    }
  }

  /** Build field config based on mode and current card */
  function _buildFields(item, mode) {
    const fields = [];
    if (mode === 'kanji') {
      const on = item.readings?.on || [];
      const kun = item.readings?.kun || [];
      if (on.length > 0) {
        fields.push({ id: 'on', label: 'On Reading', answers: on });
      }
      if (kun.length > 0) {
        fields.push({ id: 'kun', label: 'Kun Reading', answers: kun });
      }
      fields.push({ id: 'meaning', label: 'Meaning', answers: item.meanings || [] });
    } else {
      fields.push({ id: 'reading', label: 'Reading', answers: item.reading ? [item.reading] : [] });
      fields.push({ id: 'meaning', label: 'Meaning', answers: item.meanings || [] });
    }
    return fields;
  }

  /** Check if user input matches any accepted answer */
  function _checkField(input, acceptedAnswers) {
    if (!input.trim()) return false;
    const tokens = input.split(',').map(t => _normalize(t)).filter(Boolean);
    return tokens.some(token =>
      acceptedAnswers.some(ans => _normalize(ans) === token)
    );
  }

  /** Render the dot-based progress top bar */
  function _renderTopBar(stage) {
    const dotsContainer = document.getElementById('st-progress-dots');
    const stageLabel = document.getElementById('st-stage-label');
    const streakEl = document.getElementById('st-streak');
    const streakCount = document.getElementById('st-streak-count');
    if (!dotsContainer) return;

    // Progress dots — one per original card, colored by mastery state
    const cards = Session.originalCards();
    const currentCard = Session.current();
    const currentId = currentCard ? Session.getId(currentCard) : null;
    const mode = Session.mode();

    dotsContainer.innerHTML = '';
    dotsContainer.classList.toggle('dots-small', cards.length > 15);
    dotsContainer.classList.toggle('dots-tiny', cards.length > 30);

    for (const card of cards) {
      const id = mode === 'kanji' ? card.character : card.word;
      const dot = document.createElement('span');
      dot.className = 'progress-dot';

      if (id === currentId) {
        dot.classList.add('current');
      } else {
        dot.classList.add(Session.cardState(id));
      }
      dotsContainer.appendChild(dot);
    }

    // Stage label
    stageLabel.textContent = `Stage ${stage + 1}`;

    // Hint blocks: 3 - stage active
    const hintsActive = 3 - stage;
    for (let i = 0; i < 3; i++) {
      const hintBlock = document.getElementById(`st-hint-${i}`);
      if (hintBlock) {
        hintBlock.classList.toggle('active', i < hintsActive);
        hintBlock.classList.toggle('fade', i >= hintsActive);
      }
    }

    // Streak
    const currentStreak = Session.streak();
    if (currentStreak >= 2) {
      streakEl.classList.add('visible');
      streakCount.textContent = currentStreak;
    } else {
      streakEl.classList.remove('visible');
    }
  }

  /** Render the current card */
  function _renderCard() {
    const card = Session.current();
    if (!card) return;

    _waiting = false;
    const mode = Session.mode();
    const stage = Session.currentStage();
    _fields = _buildFields(card, mode);

    // Header
    const promptEl = document.getElementById('st-prompt');
    const promptSub = document.getElementById('st-prompt-sub');
    const feedbackEl = document.getElementById('st-feedback');
    const hintEl = document.getElementById('st-hint');
    const submitBtn = document.getElementById('st-submit');

    if (!promptEl) return;

    promptEl.textContent = mode === 'kanji' ? card.character : card.word;
    const typeLabel = mode === 'kanji' ? 'Kanji' : 'Vocabulary';
    promptSub.textContent = typeLabel;

    _renderTopBar(stage);

    feedbackEl.innerHTML = '';
    feedbackEl.className = 'typing-feedback';
    hintEl.textContent = 'Type your answers, then press Enter';
    submitBtn.textContent = 'Submit';
    submitBtn.disabled = false;

    // Build input fields
    const fieldsContainer = document.getElementById('st-fields');
    fieldsContainer.innerHTML = '';

    for (const field of _fields) {
      const wrapper = document.createElement('div');
      wrapper.className = 'st-field';

      const label = document.createElement('label');
      label.className = 'typing-field-label';
      label.textContent = field.label;
      label.setAttribute('for', `st-input-${field.id}`);

      const inputWrapper = document.createElement('div');
      inputWrapper.className = 'typing-input-wrapper';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'typing-input';
      input.id = `st-input-${field.id}`;
      input.autocomplete = 'off';
      input.autocapitalize = 'off';
      input.spellcheck = false;
      input.dataset.fieldId = field.id;

      inputWrapper.appendChild(input);

      // Auto-convert kana after IME composition finishes:
      // on reading → katakana, kun reading → hiragana
      if (field.id === 'on') {
        input.addEventListener('compositionend', () => _autoConvertKana(input, _hiraToKata));
      } else if (field.id === 'kun') {
        input.addEventListener('compositionend', () => _autoConvertKana(input, _kataToHira));
      }

      // Ghost text hint (stages 0 and 1 only)
      const hintText = field.answers.length > 0 ? _getHintText(field.answers[0], stage) : '';
      if (hintText) {
        const ghost = document.createElement('div');
        ghost.className = 'typing-ghost';
        ghost.id = `st-ghost-${field.id}`;
        ghost.textContent = hintText;
        inputWrapper.appendChild(ghost);

        input.addEventListener('input', () => {
          _updateGhost(input, ghost, hintText);
        });
      } else {
        input.placeholder = `Type the ${field.label.toLowerCase()}...`;
      }

      wrapper.appendChild(label);
      wrapper.appendChild(inputWrapper);
      fieldsContainer.appendChild(wrapper);
    }

    // Compounds (kanji only)
    const compoundsSection = document.getElementById('st-compounds');
    const compoundsList = document.getElementById('st-compounds-list');
    if (mode === 'kanji' && card.compounds && card.compounds.length > 0) {
      compoundsSection.classList.remove('hidden');
      compoundsList.innerHTML = card.compounds.map(c => {
        if (typeof c === 'string') return `<span class="st-compound">${c}</span>`;
        return `<span class="st-compound">${c.word} <small>${c.meaning}</small></span>`;
      }).join('');
    } else {
      compoundsSection.classList.add('hidden');
      compoundsList.innerHTML = '';
    }

    // Focus first input
    const firstInput = fieldsContainer.querySelector('input');
    if (firstInput) firstInput.focus();
  }

  function _submitAnswer() {
    if (_waiting) return;

    const card = Session.current();
    if (!card) return;

    const feedbackEl = document.getElementById('st-feedback');
    const hintEl = document.getElementById('st-hint');
    const submitBtn = document.getElementById('st-submit');

    // Check all fields have at least some input
    const inputs = document.querySelectorAll('#st-fields input');
    let anyFilled = false;
    inputs.forEach(inp => { if (inp.value.trim()) anyFilled = true; });
    if (!anyFilled) return;

    _waiting = true;

    // Hide all ghost hints on submit
    document.querySelectorAll('#st-fields .typing-ghost').forEach(g => { g.style.opacity = '0'; });

    // Grade each field with inline feedback
    let allCorrect = true;
    let fieldIndex = 0;

    // Pre-check all fields for correctness to compute preview streak
    for (const field of _fields) {
      const inp = document.getElementById(`st-input-${field.id}`);
      if (inp && !_checkField(inp.value, field.answers)) { allCorrect = false; break; }
    }
    const _previewStreak = allCorrect ? Session.streak() + 1 : 0;
    allCorrect = true; // reset for actual grading loop

    for (const field of _fields) {
      const input = document.getElementById(`st-input-${field.id}`);
      if (!input) continue;
      input.disabled = true;

      const correct = _checkField(input.value, field.answers);
      input.classList.remove('input-error');
      input.classList.add(correct ? 'input-correct' : 'input-wrong');

      // Remove any existing inline feedback
      const wrapper = input.closest('.typing-input-wrapper');
      const oldFb = wrapper?.querySelector('.typing-inline-feedback');
      if (oldFb) oldFb.remove();

      if (!correct) allCorrect = false;

      // Add inline feedback with staggered delay
      const delay = fieldIndex * 120;
      const _correct = correct;
      const _field = field;
      const _input = input;
      const _wrapper = wrapper;
      setTimeout(() => {
        // Glow pulse on correct inputs
        if (_correct) _input.classList.add('glow-pulse');

        if (_wrapper) {
          const fb = document.createElement('span');
          fb.className = 'typing-inline-feedback';
          if (_correct) {
            fb.classList.add('feedback-correct');
            fb.innerHTML = '✓ ' + EmojiFx.buildPraiseHTML(_getPraise(_previewStreak));
          } else {
            fb.classList.add('feedback-wrong');
            fb.textContent = _field.answers.join(', ');
          }
          _wrapper.appendChild(fb);
        }
      }, delay);
      fieldIndex++;
    }

    feedbackEl.innerHTML = '';
    feedbackEl.className = 'typing-feedback';

    hintEl.textContent = 'Press Enter to continue';
    submitBtn.textContent = 'Next';
    submitBtn.disabled = false;

    let _advanced = false;
    const advance = () => {
      if (_advanced) return;
      _advanced = true;
      const done = Session.recordAndAdvance(allCorrect);
      if (done) return;
      if (_onNext) _onNext();
    };

    submitBtn.onclick = advance;
  }

  function _onKey(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();

    if (_waiting) {
      const submitBtn = document.getElementById('st-submit');
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

    const submitBtn = document.getElementById('st-submit');
    if (submitBtn) {
      submitBtn.onclick = () => _submitAnswer();
    }
  }

  function unmount() {
    document.removeEventListener('keydown', _onKey);
    _waiting = false;
    _onNext = null;
    _fields = [];
  }

  return { mount, unmount };
})();
