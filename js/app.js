/**
 * app.js — View router, wires everything together
 *
 * Unified study flow: cards progress through Flashcard → Quiz → Typing
 * within a single session based on their mastery level.
 */
(async () => {
  const view = document.getElementById('view');
  const nav = document.getElementById('nav');

  let _currentMode = null; // 'kanji' | 'vocab'
  let _quizSize = 5;
  let _filterMode = 'all';

  // ---- Utilities ----
  function cloneTemplate(id) {
    return document.getElementById(id).content.cloneNode(true);
  }

  function setView(fragment) {
    Flashcard.unmount();
    Quiz.unmount();
    Typing.unmount();
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

    // JLPT level toggle
    const levelToggle = document.getElementById('level-toggle');
    const levelRadio = levelToggle.querySelector(`input[value="${Data.getLevel()}"]`);
    if (levelRadio) levelRadio.checked = true;
    levelToggle.addEventListener('change', async e => {
      Data.setLevel(e.target.value);
      showLoading();
      try {
        await Data.loadAll();
        showHome();
      } catch (err) {
        showError(err.message);
      }
    });

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

    document.getElementById('kanji-known').textContent = `${kStats.mastered} mastered`;
    document.getElementById('kanji-total').textContent = `${kStats.total} total`;
    document.getElementById('vocab-known').textContent = `${vStats.mastered} mastered`;
    document.getElementById('vocab-total').textContent = `${vStats.total} total`;

    const kPct = kStats.total ? (kStats.mastered / kStats.total) * 100 : 0;
    const vPct = vStats.total ? (vStats.mastered / vStats.total) * 100 : 0;
    document.getElementById('kanji-progress-bar').style.width = kPct + '%';
    document.getElementById('vocab-progress-bar').style.width = vPct + '%';

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
  }

  // ---- Stats ----
  function showStats() {
    updateNav('stats');
    const frag = cloneTemplate('tpl-stats');
    setView(frag);

    document.querySelector('[data-action="home"]')?.addEventListener('click', showHome);

    const kanji = Data.getKanji();
    const vocab = Data.getVocab();
    const kanjiIds = kanji.map(k => k.character);
    const vocabIds = vocab.map(v => v.word);
    const allIds = [...kanjiIds, ...vocabIds];

    // --- Donut charts ---
    const kStats = Progress.getStats(kanjiIds);
    const vStats = Progress.getStats(vocabIds);

    function renderDonut(el, stats) {
      const { mastered, inProgress, total } = stats;
      if (total === 0) return;
      const pMastered = (mastered / total) * 100;
      const pInProgress = (inProgress / total) * 100;
      el.style.background = `conic-gradient(
        var(--correct) 0% ${pMastered}%,
        var(--accent) ${pMastered}% ${pMastered + pInProgress}%,
        var(--bg3) ${pMastered + pInProgress}% 100%
      )`;
    }

    renderDonut(document.getElementById('stats-kanji-donut'), kStats);
    renderDonut(document.getElementById('stats-vocab-donut'), vStats);

    document.getElementById('stats-kanji-mastered').textContent = kStats.mastered;
    document.getElementById('stats-kanji-inprogress').textContent = kStats.inProgress;
    document.getElementById('stats-kanji-new').textContent = kStats.unseen;
    document.getElementById('stats-vocab-mastered').textContent = vStats.mastered;
    document.getElementById('stats-vocab-inprogress').textContent = vStats.inProgress;
    document.getElementById('stats-vocab-new').textContent = vStats.unseen;

    // --- Overall accuracy ---
    const allDetails = Progress.getAllItemDetails(allIds);
    const studied = allDetails.filter(d => d.lastSeen !== null);
    let totalCorrect = 0, totalAnswers = 0;
    for (const d of allDetails) {
      totalCorrect += d.correctCount;
      totalAnswers += d.correctCount + d.incorrectCount;
    }
    const accuracy = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0;
    document.getElementById('stats-accuracy').textContent = totalAnswers > 0 ? accuracy + '%' : '—';
    document.getElementById('stats-studied').textContent = studied.length;

    // --- Hardest items (top 10 by lowest accuracy with at least 1 wrong) ---
    const hardest = studied
      .filter(d => d.incorrectCount > 0)
      .sort((a, b) => {
        const aTotal = a.correctCount + a.incorrectCount;
        const bTotal = b.correctCount + b.incorrectCount;
        const aAcc = aTotal > 0 ? a.correctCount / aTotal : 0;
        const bAcc = bTotal > 0 ? b.correctCount / bTotal : 0;
        return aAcc - bAcc || b.incorrectCount - a.incorrectCount;
      })
      .slice(0, 10);

    const hardestEl = document.getElementById('stats-hardest');
    if (hardest.length === 0) {
      hardestEl.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem">No incorrect answers yet</p>';
    } else {
      hardestEl.innerHTML = hardest.map(d => {
        const total = d.correctCount + d.incorrectCount;
        const acc = total > 0 ? Math.round((d.correctCount / total) * 100) + '%' : '—';
        return `<div class="hardest-item">
          <span class="item-char">${d.id}</span>
          <span class="item-stat">${acc}</span>
        </div>`;
      }).join('');
    }

    // --- Full item list ---
    const kanjiDetails = Progress.getAllItemDetails(kanjiIds).map(d => ({ ...d, type: 'kanji' }));
    const vocabDetails = Progress.getAllItemDetails(vocabIds).map(d => ({ ...d, type: 'vocab' }));
    const allItemsList = [...kanjiDetails, ...vocabDetails];

    function _masteryLabel(level) {
      if (level === 3) return 'mastered';
      if (level >= 1) return 'in-progress';
      return 'unseen';
    }

    function renderItemList() {
      const typeFilter = document.getElementById('stats-type-filter').value;
      const statusFilter = document.getElementById('stats-status-filter').value;
      const sortBy = document.getElementById('stats-sort').value;

      let filtered = allItemsList;
      if (typeFilter !== 'all') filtered = filtered.filter(d => d.type === typeFilter);
      if (statusFilter === 'studied') {
        filtered = filtered.filter(d => d.lastSeen !== null);
      } else if (statusFilter === 'mastered') {
        filtered = filtered.filter(d => d.masteryLevel === 3);
      } else if (statusFilter === 'in-progress') {
        filtered = filtered.filter(d => d.masteryLevel >= 1 && d.masteryLevel < 3);
      } else if (statusFilter === 'unseen') {
        filtered = filtered.filter(d => d.masteryLevel === 0);
      }

      filtered = [...filtered];
      if (sortBy === 'accuracy-asc' || sortBy === 'accuracy-desc') {
        filtered.sort((a, b) => {
          const aTotal = a.correctCount + a.incorrectCount;
          const bTotal = b.correctCount + b.incorrectCount;
          const aAcc = aTotal > 0 ? a.correctCount / aTotal : -1;
          const bAcc = bTotal > 0 ? b.correctCount / bTotal : -1;
          return sortBy === 'accuracy-asc' ? aAcc - bAcc : bAcc - aAcc;
        });
      } else if (sortBy === 'last-seen') {
        filtered.sort((a, b) => {
          const aDate = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
          const bDate = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
          return bDate - aDate;
        });
      } else if (sortBy === 'name') {
        filtered.sort((a, b) => a.id.localeCompare(b.id, 'ja'));
      }

      const listEl = document.getElementById('stats-item-list');
      if (filtered.length === 0) {
        listEl.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem;padding:.5rem">No items match filters</p>';
        return;
      }

      listEl.innerHTML = filtered.map(d => {
        const total = d.correctCount + d.incorrectCount;
        const acc = total > 0 ? Math.round((d.correctCount / total) * 100) + '%' : '—';
        const lastSeen = d.lastSeen
          ? new Date(d.lastSeen).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : '—';
        const label = _masteryLabel(d.masteryLevel);
        const statusClass = `status-${label}`;
        const typeLabel = d.type === 'kanji' ? 'Kanji' : 'Vocab';
        return `<div class="item-row">
          <span class="item-row-char">${d.id}</span>
          <span class="item-row-name">${typeLabel}</span>
          <span class="item-row-status ${statusClass}">${label}</span>
          <span class="item-row-accuracy">${acc}</span>
          <span class="item-row-date">${lastSeen}</span>
        </div>`;
      }).join('');
    }

    renderItemList();

    document.getElementById('stats-type-filter').addEventListener('change', renderItemList);
    document.getElementById('stats-status-filter').addEventListener('change', renderItemList);
    document.getElementById('stats-sort').addEventListener('change', renderItemList);
  }

  // ---- Shared: prepare items for a session ----
  function _prepareItems(mode, filterMode) {
    const allItems = mode === 'kanji' ? Data.getKanji() : Data.getVocab();
    const getId = item => mode === 'kanji' ? item.character : item.word;

    let items = Progress.filterItems(allItems, getId, filterMode);
    if (items.length === 0) items = allItems;

    const size = _quizSize === 0 ? items.length : Math.min(_quizSize, items.length);
    const shuffled = Session.shuffle(items).slice(0, size);
    return { allItems, shuffled };
  }

  // ---- Unified card routing ----
  function _showCurrentCard() {
    const studyMode = Session.currentMode();
    if (!studyMode) return; // session complete (handled by onComplete)

    Flashcard.unmount();
    Quiz.unmount();
    Typing.unmount();

    if (studyMode === 'flashcard') {
      const frag = cloneTemplate('tpl-flashcard');
      setView(frag);
      // Add mode badge
      _addModeBadge('Flashcard');
      document.querySelector('[data-action="home"]')?.addEventListener('click', showHome);
      Flashcard.mount(_currentMode, _showCurrentCard);
    } else if (studyMode === 'quiz') {
      const allPool = Session.allPool();
      if (allPool.length < 4) {
        // Not enough items for quiz — fall back to flashcard
        const frag = cloneTemplate('tpl-flashcard');
        setView(frag);
        _addModeBadge('Flashcard');
        document.querySelector('[data-action="home"]')?.addEventListener('click', showHome);
        Flashcard.mount(_currentMode, _showCurrentCard);
        return;
      }
      const frag = cloneTemplate('tpl-quiz');
      setView(frag);
      _addModeBadge('Quiz');
      document.querySelector('[data-action="home"]')?.addEventListener('click', showHome);
      Quiz.mount(_currentMode, allPool, _showCurrentCard);
    } else if (studyMode === 'typing') {
      const frag = cloneTemplate('tpl-typing');
      setView(frag);
      _addModeBadge('Typing');
      document.querySelector('[data-action="home"]')?.addEventListener('click', showHome);
      Typing.mount(_currentMode, _showCurrentCard);
    }
  }

  /** Add a mode indicator badge to the study header */
  function _addModeBadge(label) {
    const header = document.querySelector('.quiz-header');
    if (!header) return;
    const badge = document.createElement('span');
    badge.className = 'mode-badge';
    badge.textContent = label;
    header.insertBefore(badge, header.firstChild.nextSibling);
  }

  // ---- Start Study ----
  function startStudy(mode) {
    _currentMode = mode;
    const { allItems, shuffled } = _prepareItems(mode, _filterMode);

    if (shuffled.length === 0) {
      alert('No cards match the current filter. Try changing the filter setting.');
      return;
    }

    updateNav('study');
    const onComplete = ({ correct, incorrect, total }) => {
      showSummary({ correct, incorrect, total, mode });
    };

    Session.start(mode, shuffled, allItems, onComplete);
    _showCurrentCard();
  }

  // ---- Summary ----
  function showSummary({ correct, incorrect, total, mode }) {
    Flashcard.unmount();
    Quiz.unmount();
    Typing.unmount();
    updateNav('summary');
    const frag = cloneTemplate('tpl-summary');
    setView(frag);

    document.getElementById('sum-correct').textContent = correct;
    document.getElementById('sum-wrong').textContent = incorrect;
    document.getElementById('sum-total').textContent = total;

    const pct = total ? Math.round((correct / total) * 100) : 0;
    document.getElementById('summary-bar').style.width = pct + '%';
    document.getElementById('summary-pct').textContent = `${pct}% correct`;

    const celebEl = document.getElementById('summary-celebration');
    if (pct === 100) {
      celebEl.textContent = 'Perfect!';
    } else if (pct >= 80) {
      celebEl.textContent = 'Great job!';
    } else if (pct >= 60) {
      celebEl.textContent = 'Nice effort!';
    }

    document.getElementById('study-again-btn').addEventListener('click', () => startStudy(mode));
    document.querySelector('[data-action="home"]').addEventListener('click', showHome);
  }

  // ---- Global action delegation ----
  document.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'home') showHome();
  });

  // ---- Boot ----
  Theme.init();
  document.getElementById('stats-toggle').addEventListener('click', showStats);
  showLoading();
  try {
    await Data.loadAll();
    showHome();
  } catch (err) {
    showError(err.message);
  }
})();
