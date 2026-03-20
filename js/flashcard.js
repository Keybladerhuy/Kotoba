/**
 * flashcard.js — Card flip animation, scoring, session state
 */
const Flashcard = (() => {
  let _deck = [];       // full shuffled deck for the session
  let _index = 0;
  let _correct = 0;
  let _incorrect = 0;
  let _mode = 'kanji'; // 'kanji' | 'vocab'
  let _flipped = false;
  let _onComplete = null;

  // ---- Shuffle ----
  function _shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---- ID helpers ----
  function _getId(item) {
    return _mode === 'kanji' ? item.character : item.word;
  }

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
    const examples = (card.examples || []).map(e => `<li>${e}</li>`).join('');
    return `
      <div class="back-section"><h4>Character</h4><p style="font-size:2rem">${card.character}</p></div>
      ${on ? `<div class="back-section"><h4>On Reading</h4><p>${on}</p></div>` : ''}
      ${kun ? `<div class="back-section"><h4>Kun Reading</h4><p>${kun}</p></div>` : ''}
      <div class="back-section"><h4>Meanings</h4><p>${meanings}</p></div>
      ${examples ? `<div class="back-section"><h4>Examples</h4><ul>${examples}</ul></div>` : ''}
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
    const card = _deck[_index];
    const frontEl = document.getElementById('card-front');
    const backEl = document.getElementById('card-back');
    const inner = document.getElementById('card-inner');
    const counter = document.getElementById('card-counter');
    const qBar = document.getElementById('quiz-progress-bar');
    const scoreCorrect = document.getElementById('score-correct');
    const scoreSeen = document.getElementById('score-seen');

    if (!frontEl) return;

    // Unflip
    inner.classList.remove('flipped');
    _flipped = false;
    document.getElementById('card-actions-flip').classList.remove('hidden');
    document.getElementById('card-actions-grade').classList.add('hidden');

    if (_mode === 'kanji') {
      frontEl.innerHTML = _buildKanjiFront(card);
      backEl.innerHTML = _buildKanjiBack(card);
    } else {
      frontEl.innerHTML = _buildVocabFront(card);
      backEl.innerHTML = _buildVocabBack(card);
    }

    counter.textContent = `${_index + 1} / ${_deck.length}`;
    const pct = (_index / _deck.length) * 100;
    qBar.style.width = pct + '%';
    scoreCorrect.textContent = _correct;
    scoreSeen.textContent = _correct + _incorrect;
  }

  function _flip() {
    if (_flipped) return;
    _flipped = true;
    document.getElementById('card-inner').classList.add('flipped');
    document.getElementById('card-actions-flip').classList.add('hidden');
    document.getElementById('card-actions-grade').classList.remove('hidden');
  }

  function _grade(correct) {
    const card = _deck[_index];
    Progress.recordResult(_getId(card), correct);
    if (correct) _correct++; else _incorrect++;

    _index++;
    if (_index >= _deck.length) {
      _onComplete && _onComplete({ correct: _correct, incorrect: _incorrect, total: _deck.length });
      return;
    }
    _renderCard();
  }

  function _onKey(e) {
    if (e.code === 'Space') { e.preventDefault(); _flip(); }
    if (e.code === 'ArrowRight') { if (_flipped) _grade(true); }
    if (e.code === 'ArrowLeft') { if (_flipped) _grade(false); }
  }

  function mount(mode, items, onComplete) {
    _mode = mode;
    _deck = _shuffle(items);
    _index = 0;
    _correct = 0;
    _incorrect = 0;
    _onComplete = onComplete;
    _flipped = false;

    _renderCard();

    // Wire up buttons
    document.getElementById('flashcard').addEventListener('click', _flip);
    document.getElementById('flip-btn').addEventListener('click', _flip);
    document.getElementById('correct-btn').addEventListener('click', () => _grade(true));
    document.getElementById('wrong-btn').addEventListener('click', () => _grade(false));
    document.addEventListener('keydown', _onKey);
  }

  function unmount() {
    document.removeEventListener('keydown', _onKey);
  }

  return { mount, unmount };
})();
