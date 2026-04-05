/**
 * quiz.js — Multiple choice quiz mode
 *
 * Shows a prompt (kanji character or vocab word) and 4 answer choices.
 * Auto-grades on selection with visual feedback before advancing.
 * Keyboard: 1-4 to select.
 *
 * Does not start the session itself. Renders current card from Session.
 */
const Quiz = (() => {
  const NUM_CHOICES = 4;
  const FEEDBACK_DELAY = 900;

  let _allPool = [];
  let _waiting = false;
  let _feedbackTimer = null;
  let _onNext = null;

  function _getAnswer(item) {
    return (item.meanings || []).join(', ');
  }

  function _getPrompt(item) {
    const mode = Session.mode();
    if (mode === 'kanji') return item.character;
    return item.word;
  }

  function _getPromptSub(item) {
    const mode = Session.mode();
    if (mode === 'kanji') return 'Kanji';
    return `Vocabulary · ${item.pos || ''}`;
  }

  function _generateChoices(correctItem) {
    const correctAnswer = _getAnswer(correctItem);
    const correctId = Session.getId(correctItem);

    const pool = Session.shuffle(
      _allPool.filter(item => Session.getId(item) !== correctId)
    );

    const distractors = [];
    const seen = new Set([correctAnswer.toLowerCase()]);
    for (const item of pool) {
      const ans = _getAnswer(item);
      const key = ans.toLowerCase();
      if (!seen.has(key) && ans) {
        seen.add(key);
        distractors.push(ans);
      }
      if (distractors.length >= NUM_CHOICES - 1) break;
    }

    const choices = [
      { text: correctAnswer, correct: true },
      ...distractors.map(d => ({ text: d, correct: false })),
    ];
    return Session.shuffle(choices);
  }

  function _renderCard() {
    const card = Session.current();
    if (!card) return;

    const promptEl = document.getElementById('quiz-prompt');
    const promptSub = document.getElementById('quiz-prompt-sub');
    const choicesEl = document.getElementById('quiz-choices');
    const counter = document.getElementById('quiz-card-counter');
    const qBar = document.getElementById('quiz-mc-progress-bar');
    const scoreCorrect = document.getElementById('quiz-score-correct');
    const scoreSeen = document.getElementById('quiz-score-seen');
    const hintEl = document.getElementById('quiz-hint');

    if (!promptEl) return;

    _waiting = false;
    promptEl.textContent = _getPrompt(card);
    promptSub.textContent = _getPromptSub(card);
    hintEl.textContent = 'Press 1-4 to choose';

    const idx = Session.index();
    const total = Session.total();
    const { correct, incorrect } = Session.scores();
    counter.textContent = `${idx + 1} / ${total}`;
    qBar.style.width = (idx / total) * 100 + '%';
    scoreCorrect.textContent = correct;
    scoreSeen.textContent = correct + incorrect;

    const choices = _generateChoices(card);
    choicesEl.innerHTML = '';
    choices.forEach((choice, i) => {
      const btn = document.createElement('button');
      btn.className = 'quiz-choice';
      btn.dataset.index = i;
      btn.dataset.correct = choice.correct;
      btn.innerHTML = `<span class="choice-key">${i + 1}</span><span class="choice-text">${choice.text}</span>`;
      btn.addEventListener('click', () => _selectChoice(btn, choice.correct, choicesEl));
      choicesEl.appendChild(btn);
    });
  }

  function _selectChoice(selectedBtn, isCorrect, choicesEl) {
    if (_waiting) return;
    _waiting = true;

    const buttons = choicesEl.querySelectorAll('.quiz-choice');
    buttons.forEach(btn => {
      btn.classList.add('disabled');
      if (btn.dataset.correct === 'true') {
        btn.classList.add('choice-correct');
      }
    });

    if (!isCorrect) {
      selectedBtn.classList.add('choice-wrong');
    }

    const hintEl = document.getElementById('quiz-hint');
    hintEl.textContent = isCorrect ? 'Correct!' : 'Wrong — correct answer highlighted';

    _feedbackTimer = setTimeout(() => {
      const done = Session.recordAndAdvance(isCorrect);
      if (done) return;
      if (_onNext) _onNext();
    }, FEEDBACK_DELAY);
  }

  function _onKey(e) {
    if (_waiting) return;

    const keyNum = parseInt(e.key, 10);
    if (keyNum >= 1 && keyNum <= NUM_CHOICES) {
      e.preventDefault();
      const choicesEl = document.getElementById('quiz-choices');
      const btn = choicesEl?.querySelector(`[data-index="${keyNum - 1}"]`);
      if (btn) {
        const isCorrect = btn.dataset.correct === 'true';
        _selectChoice(btn, isCorrect, choicesEl);
      }
    }
  }

  function mount(mode, allPool, onNext) {
    _allPool = allPool;
    _onNext = onNext;
    _waiting = false;
    _renderCard();
    document.addEventListener('keydown', _onKey);
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
