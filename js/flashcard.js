/**
 * flashcard.js — Card flip animation, keyboard shortcuts, rendering
 *
 * Renders the current card from Session. Does not start the session itself.
 * Calls onNext callback after grading to let app.js route to the next card.
 */
const Flashcard = (() => {
  let _flipped = false;
  let _onNext = null;

  // ---- Card HTML builders ----
  function _buildKanjiFront(card) {
    return `
      <div class="card-label">Kanji</div>
      <div class="card-character">${card.character}</div>
    `;
  }

  function _buildKanjiBack(card) {
    const on = (card.readings?.on || []).map(r => `<span class="reading-chip">${r}</span>`).join('');
    const kun = (card.readings?.kun || []).map(r => `<span class="reading-chip">${r}</span>`).join('');
    const meanings = (card.meanings || []).join(', ');
    const compounds = (card.compounds || []).map(c => {
      const word = typeof c === 'string' ? c : c.word;
      const meaning = typeof c === 'object' && c.meaning ? ` <span class="example-meaning">${c.meaning}</span>` : '';
      return `<li><span class="example-word">${word}</span>${meaning}</li>`;
    }).join('');
    return `
      <div class="back-section"><h4>Character</h4><p style="font-size:2rem">${card.character}</p></div>
      ${on ? `<div class="back-section"><h4>On Reading</h4><p>${on}</p></div>` : ''}
      ${kun ? `<div class="back-section"><h4>Kun Reading</h4><p>${kun}</p></div>` : ''}
      <div class="back-section"><h4>Meanings</h4><p>${meanings}</p></div>
      ${compounds ? `<div class="back-section"><h4>Compounds</h4><ul class="example-list">${compounds}</ul></div>` : ''}
    `;
  }

  function _buildVocabFront(card) {
    return `
      <div class="card-label">Vocabulary · ${card.pos || ''}</div>
      <div class="card-character" style="font-size:3.5rem">${card.word}</div>
    `;
  }

  function _buildVocabBack(card) {
    const meanings = (card.meanings || []).join(', ');
    const exJa = card.example?.ja || '';
    const exEn = card.example?.en || '';
    return `
      <div class="back-section"><h4>Word</h4><p style="font-size:2rem">${card.word}</p></div>
      <div class="back-section"><h4>Reading</h4><p>${card.reading || '—'}</p></div>
      <div class="back-section"><h4>Meanings</h4><p>${meanings}</p></div>
      ${exJa ? `<div class="back-section"><h4>Example</h4><p class="example-ja">${exJa}</p><p class="example-en">${exEn}</p></div>` : ''}
    `;
  }

  function _renderCard() {
    const card = Session.current();
    const frontEl = document.getElementById('card-front');
    const backEl = document.getElementById('card-back');
    const inner = document.getElementById('card-inner');
    const counter = document.getElementById('card-counter');
    const qBar = document.getElementById('quiz-progress-bar');
    const scoreCorrect = document.getElementById('score-correct');
    const scoreSeen = document.getElementById('score-seen');

    if (!frontEl) return;

    inner.classList.remove('flipped');
    _flipped = false;
    document.getElementById('card-actions-flip').classList.remove('hidden');
    document.getElementById('card-actions-grade').classList.add('hidden');

    const mode = Session.mode();
    if (mode === 'kanji') {
      frontEl.innerHTML = _buildKanjiFront(card);
      backEl.innerHTML = _buildKanjiBack(card);
    } else {
      frontEl.innerHTML = _buildVocabFront(card);
      backEl.innerHTML = _buildVocabBack(card);
    }

    const idx = Session.index();
    const total = Session.total();
    const { correct, incorrect } = Session.scores();
    counter.textContent = `${idx + 1} / ${total}`;
    qBar.style.width = (idx / total) * 100 + '%';
    scoreCorrect.textContent = correct;
    scoreSeen.textContent = correct + incorrect;
  }

  function _flip() {
    if (_flipped) return;
    _flipped = true;
    document.getElementById('card-inner').classList.add('flipped');
    document.getElementById('card-actions-flip').classList.add('hidden');
    document.getElementById('card-actions-grade').classList.remove('hidden');
  }

  function _triggerAnim(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth; // force reflow to restart animation
    el.classList.add(cls);
    el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
  }

  function _grade(correct) {
    const done = Session.recordAndAdvance(correct);
    if (done) return; // onComplete already fired by Session
    if (_onNext) _onNext();
  }

  function _onKey(e) {
    if (e.code === 'Space') { e.preventDefault(); _flip(); }
    if (e.code === 'ArrowRight') { if (_flipped) _grade(true); }
    if (e.code === 'ArrowLeft') { if (_flipped) _grade(false); }
  }

  function mount(mode, onNext) {
    _onNext = onNext;
    _flipped = false;
    _renderCard();

    document.getElementById('flashcard').addEventListener('click', _flip);
    document.getElementById('flip-btn').addEventListener('click', _flip);
    document.getElementById('correct-btn').addEventListener('click', () => {
      _triggerAnim(document.getElementById('correct-btn'), 'anim-bounce');
      _grade(true);
    });
    document.getElementById('wrong-btn').addEventListener('click', () => {
      _triggerAnim(document.getElementById('wrong-btn'), 'anim-shake');
      _grade(false);
    });
    document.addEventListener('keydown', _onKey);
  }

  function unmount() {
    document.removeEventListener('keydown', _onKey);
    _onNext = null;
  }

  return { mount, unmount };
})();
