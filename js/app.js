/**
 * app.js — View router, wires everything together
 */
(async () => {
  const view = document.getElementById('view');
  const nav = document.getElementById('nav');

  let _currentMode = null; // 'kanji' | 'vocab'
  let _quizSize = 25;
  let _filterMode = 'all';

  // ---- Utilities ----
  function cloneTemplate(id) {
    return document.getElementById(id).content.cloneNode(true);
  }

  function setView(fragment) {
    Flashcard.unmount();
    view.innerHTML = '';
    view.appendChild(fragment);
  }

  function updateNav(page) {
    nav.innerHTML = page === 'home'
      ? ''
      : `<button data-action="home">Home</button>`;
  }

  // ---- Loading screen ----
  function showLoading() {
    view.innerHTML = `
      <div class="loading-screen">
        <div class="spinner"></div>
        <p>Loading data…</p>
      </div>`;
  }

  function showError(msg) {
    view.innerHTML = `
      <div class="error-screen">
        <p>⚠ ${msg}</p>
        <p style="font-size:.85rem;color:var(--text-muted);margin-top:.5rem">
          Make sure you're running a local server and have placed JSON files in /data/.<br>
          See data/README.md for details.
        </p>
      </div>`;
  }

  // ---- Home ----
  function showHome() {
    _currentMode = null;
    updateNav('home');
    const frag = cloneTemplate('tpl-home');
    setView(frag);

    // Restore settings
    const sizeEl = document.getElementById('quiz-size');
    const filterEl = document.getElementById('filter-mode');
    sizeEl.value = String(_quizSize);
    filterEl.value = _filterMode;
    sizeEl.addEventListener('change', e => { _quizSize = parseInt(e.target.value, 10); });
    filterEl.addEventListener('change', e => { _filterMode = e.target.value; });

    // Progress stats
    const kanji = Data.getKanji();
    const vocab = Data.getVocab();
    const kanjiIds = kanji.map(k => k.character);
    const vocabIds = vocab.map(v => v.word);
    const kStats = Progress.getStats(kanjiIds);
    const vStats = Progress.getStats(vocabIds);

    document.getElementById('kanji-known').textContent = `${kStats.known} known`;
    document.getElementById('kanji-total').textContent = `${kStats.total} total`;
    document.getElementById('vocab-known').textContent = `${vStats.known} known`;
    document.getElementById('vocab-total').textContent = `${vStats.total} total`;

    const kPct = kStats.total ? (kStats.known / kStats.total) * 100 : 0;
    const vPct = vStats.total ? (vStats.known / vStats.total) * 100 : 0;
    document.getElementById('kanji-progress-bar').style.width = kPct + '%';
    document.getElementById('vocab-progress-bar').style.width = vPct + '%';

    // SRS due counts
    const kanjiDue = Progress.getDueCount(kanjiIds);
    const vocabDue = Progress.getDueCount(vocabIds);
    document.getElementById('kanji-due').textContent = kanjiDue;
    document.getElementById('vocab-due').textContent = vocabDue;

    document.getElementById('reset-progress').addEventListener('click', () => {
      if (confirm('Reset all progress? This cannot be undone.')) {
        Progress.reset();
        showHome();
      }
    });

    // Deck card buttons
    document.querySelectorAll('[data-action="study-kanji"]').forEach(el =>
      el.addEventListener('click', () => startStudy('kanji')));
    document.querySelectorAll('[data-action="study-vocab"]').forEach(el =>
      el.addEventListener('click', () => startStudy('vocab')));
    document.querySelectorAll('[data-action="review-kanji"]').forEach(el =>
      el.addEventListener('click', () => startSrsReview('kanji')));
    document.querySelectorAll('[data-action="review-vocab"]').forEach(el =>
      el.addEventListener('click', () => startSrsReview('vocab')));
  }

  // ---- Start SRS Review (only due items) ----
  function startSrsReview(mode) {
    _currentMode = mode;
    const allItems = mode === 'kanji' ? Data.getKanji() : Data.getVocab();
    const getId = item => mode === 'kanji' ? item.character : item.word;

    let items = Progress.filterItems(allItems, getId, 'srs');
    if (items.length === 0) {
      alert('No cards due for review right now. Check back later!');
      return;
    }

    // Limit to quiz size
    const size = _quizSize === 0 ? items.length : Math.min(_quizSize, items.length);
    const shuffled = shuffleArr(items).slice(0, size);

    updateNav('study');
    const frag = cloneTemplate('tpl-flashcard');
    setView(frag);

    document.querySelector('[data-action="home"]')?.addEventListener('click', showHome);

    Flashcard.mount(mode, shuffled, ({ correct, incorrect, total }) => {
      showSummary({ correct, incorrect, total, mode });
    });
  }

  // ---- Start Study ----
  function startStudy(mode) {
    _currentMode = mode;
    const allItems = mode === 'kanji' ? Data.getKanji() : Data.getVocab();
    const getId = item => mode === 'kanji' ? item.character : item.word;

    // Filter
    let items = Progress.filterItems(allItems, getId, _filterMode);
    if (items.length === 0) {
      // Fallback to all if filter yields nothing
      items = allItems;
    }

    // Limit size
    const size = _quizSize === 0 ? items.length : Math.min(_quizSize, items.length);
    // Shuffle + slice
    const shuffled = shuffleArr(items).slice(0, size);

    if (shuffled.length === 0) {
      alert('No cards match the current filter. Try changing the filter setting.');
      return;
    }

    updateNav('study');
    const frag = cloneTemplate('tpl-flashcard');
    setView(frag);

    // Wire home button
    document.querySelector('[data-action="home"]')?.addEventListener('click', showHome);

    Flashcard.mount(mode, shuffled, ({ correct, incorrect, total }) => {
      showSummary({ correct, incorrect, total, mode });
    });
  }

  // ---- Summary ----
  function showSummary({ correct, incorrect, total, mode }) {
    Flashcard.unmount();
    updateNav('summary');
    const frag = cloneTemplate('tpl-summary');
    setView(frag);

    document.getElementById('sum-correct').textContent = correct;
    document.getElementById('sum-wrong').textContent = incorrect;
    document.getElementById('sum-total').textContent = total;

    const pct = total ? Math.round((correct / total) * 100) : 0;
    document.getElementById('summary-bar').style.width = pct + '%';
    document.getElementById('summary-pct').textContent = `${pct}% correct`;

    document.getElementById('study-again-btn').addEventListener('click', () => startStudy(mode));
    document.querySelector('[data-action="home"]').addEventListener('click', showHome);
  }

  // ---- Global action delegation ----
  document.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'home') showHome();
  });

  // ---- Shuffle helper ----
  function shuffleArr(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---- Boot ----
  showLoading();
  try {
    await Data.loadAll();
    showHome();
  } catch (err) {
    showError(err.message);
  }
})();
