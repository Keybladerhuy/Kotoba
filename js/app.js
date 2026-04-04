/**
 * app.js — View router, wires everything together
 */
(async () => {
  const view = document.getElementById('view');
  const nav = document.getElementById('nav');

  let _currentMode = null; // 'kanji' | 'vocab'
  let _quizSize = 10;
  let _filterMode = 'all';
  let _studyMode = 'flashcard'; // 'flashcard' | 'quiz' | 'typing'
  let _typingSubMode = 'meaning'; // 'meaning' | 'reading' | 'mixed'

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

    // Pill toggle for study mode
    const modeToggle = document.getElementById('study-mode-toggle');
    const modeRadio = modeToggle.querySelector(`input[value="${_studyMode}"]`);
    if (modeRadio) modeRadio.checked = true;

    // Typing sub-mode
    const typingSubRow = document.getElementById('typing-sub-mode-row');
    const typingSubEl = document.getElementById('typing-sub-mode');
    typingSubEl.value = _typingSubMode;
    typingSubEl.addEventListener('change', e => { _typingSubMode = e.target.value; });

    function updateTypingSubVisibility() {
      typingSubRow.classList.toggle('hidden', _studyMode !== 'typing');
    }
    updateTypingSubVisibility();

    modeToggle.addEventListener('change', e => {
      _studyMode = e.target.value;
      updateTypingSubVisibility();
    });

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

    // --- SRS Settings panel ---
    const srsToggle = document.getElementById('srs-settings-toggle');
    const srsBody = document.getElementById('srs-settings-body');
    const srsArrow = document.getElementById('srs-toggle-arrow');
    srsToggle.addEventListener('click', () => {
      const open = srsBody.classList.toggle('hidden');
      srsArrow.style.transform = open ? '' : 'rotate(90deg)';
    });

    // Load current SRS settings into inputs
    const srs = SrsSettings.getAll();
    const srsRepeatEl = document.getElementById('srs-repeat-wrong');
    const srsStepsEl = document.getElementById('srs-learning-steps');
    const srsGradEl = document.getElementById('srs-graduate-interval');
    const srsDefEaseEl = document.getElementById('srs-default-ease');
    const srsMinEaseEl = document.getElementById('srs-min-ease');
    const srsEaseBonusEl = document.getElementById('srs-ease-bonus');
    const srsEasePenaltyEl = document.getElementById('srs-ease-penalty');
    const srsKnownEl = document.getElementById('srs-known-threshold');

    srsRepeatEl.checked = srs.repeatWrongCards;
    srsStepsEl.value = (srs.learningSteps || []).join(', ');
    srsGradEl.value = srs.graduateInterval;
    srsDefEaseEl.value = srs.defaultEase;
    srsMinEaseEl.value = srs.minEase;
    srsEaseBonusEl.value = srs.easeBonus;
    srsEasePenaltyEl.value = srs.easePenalty;
    srsKnownEl.value = srs.knownThreshold;

    function saveSrsSettings() {
      const steps = srsStepsEl.value
        .split(',')
        .map(s => parseFloat(s.trim()))
        .filter(n => !isNaN(n) && n > 0);
      SrsSettings.set({
        repeatWrongCards: srsRepeatEl.checked,
        learningSteps: steps,
        graduateInterval: parseInt(srsGradEl.value, 10) || 6,
        defaultEase: parseFloat(srsDefEaseEl.value) || 2.5,
        minEase: parseFloat(srsMinEaseEl.value) || 1.3,
        easeBonus: parseFloat(srsEaseBonusEl.value) || 0.1,
        easePenalty: parseFloat(srsEasePenaltyEl.value) || 0.2,
        knownThreshold: parseInt(srsKnownEl.value, 10) || 3,
      });
    }

    [srsRepeatEl, srsStepsEl, srsGradEl, srsDefEaseEl, srsMinEaseEl, srsEaseBonusEl, srsEasePenaltyEl, srsKnownEl]
      .forEach(el => el.addEventListener('change', saveSrsSettings));

    document.getElementById('srs-reset-defaults').addEventListener('click', () => {
      SrsSettings.reset();
      const d = SrsSettings.getDefaults();
      srsRepeatEl.checked = d.repeatWrongCards;
      srsStepsEl.value = d.learningSteps.join(', ');
      srsGradEl.value = d.graduateInterval;
      srsDefEaseEl.value = d.defaultEase;
      srsMinEaseEl.value = d.minEase;
      srsEaseBonusEl.value = d.easeBonus;
      srsEasePenaltyEl.value = d.easePenalty;
      srsKnownEl.value = d.knownThreshold;
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
      const { known, learning, total } = stats;
      if (total === 0) return;
      const pKnown = (known / total) * 100;
      const pLearning = (learning / total) * 100;
      el.style.background = `conic-gradient(
        var(--correct) 0% ${pKnown}%,
        var(--accent) ${pKnown}% ${pKnown + pLearning}%,
        var(--bg3) ${pKnown + pLearning}% 100%
      )`;
    }

    renderDonut(document.getElementById('stats-kanji-donut'), kStats);
    renderDonut(document.getElementById('stats-vocab-donut'), vStats);

    document.getElementById('stats-kanji-known').textContent = kStats.known;
    document.getElementById('stats-kanji-learning').textContent = kStats.learning;
    document.getElementById('stats-kanji-new').textContent = kStats.unseen;
    document.getElementById('stats-vocab-known').textContent = vStats.known;
    document.getElementById('stats-vocab-learning').textContent = vStats.learning;
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

    // --- Upcoming reviews ---
    const reviews = Progress.getUpcomingReviews(allIds);
    document.getElementById('stats-due-today').textContent = reviews.today;
    document.getElementById('stats-due-tomorrow').textContent = reviews.tomorrow;
    document.getElementById('stats-due-week').textContent = reviews.thisWeek;

    // --- Hardest items (top 10 by lowest easeFactor with at least 1 wrong) ---
    const hardest = studied
      .filter(d => d.incorrectCount > 0)
      .sort((a, b) => a.easeFactor - b.easeFactor || b.incorrectCount - a.incorrectCount)
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

    function renderItemList() {
      const typeFilter = document.getElementById('stats-type-filter').value;
      const statusFilter = document.getElementById('stats-status-filter').value;
      const sortBy = document.getElementById('stats-sort').value;

      let filtered = allItemsList;
      if (typeFilter !== 'all') filtered = filtered.filter(d => d.type === typeFilter);
      if (statusFilter === 'studied') {
        filtered = filtered.filter(d => d.lastSeen !== null);
      } else if (statusFilter !== 'all') {
        filtered = filtered.filter(d => d.status === statusFilter);
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
        const statusClass = `status-${d.status}`;
        const typeLabel = d.type === 'kanji' ? 'Kanji' : 'Vocab';
        return `<div class="item-row">
          <span class="item-row-char">${d.id}</span>
          <span class="item-row-name">${typeLabel}</span>
          <span class="item-row-status ${statusClass}">${d.status}</span>
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

  // ---- Mount the appropriate study module ----
  function _mountSession(mode, items, allItems) {
    updateNav('study');
    const onComplete = ({ correct, incorrect, total }) => {
      showSummary({ correct, incorrect, total, mode });
    };

    if (_studyMode === 'quiz') {
      if (allItems.length < 4) {
        alert('Quiz mode needs at least 4 items to generate choices. Falling back to flashcard mode.');
        const frag = cloneTemplate('tpl-flashcard');
        setView(frag);
        document.querySelector('[data-action="home"]')?.addEventListener('click', showHome);
        Flashcard.mount(mode, items, onComplete);
        return;
      }
      const frag = cloneTemplate('tpl-quiz');
      setView(frag);
      document.querySelector('[data-action="home"]')?.addEventListener('click', showHome);
      Quiz.mount(mode, items, allItems, onComplete);
    } else if (_studyMode === 'typing') {
      const frag = cloneTemplate('tpl-typing');
      setView(frag);
      document.querySelector('[data-action="home"]')?.addEventListener('click', showHome);
      Typing.mount(mode, items, _typingSubMode, onComplete);
    } else {
      const frag = cloneTemplate('tpl-flashcard');
      setView(frag);
      document.querySelector('[data-action="home"]')?.addEventListener('click', showHome);
      Flashcard.mount(mode, items, onComplete);
    }
  }

  // ---- Start SRS Review (only due items) ----
  function startSrsReview(mode) {
    _currentMode = mode;
    const { allItems, shuffled } = _prepareItems(mode, 'srs');

    if (shuffled.length === 0) {
      alert('No cards due for review right now. Check back later!');
      return;
    }

    _mountSession(mode, shuffled, allItems);
  }

  // ---- Start Study ----
  function startStudy(mode) {
    _currentMode = mode;
    const { allItems, shuffled } = _prepareItems(mode, _filterMode);

    if (shuffled.length === 0) {
      alert('No cards match the current filter. Try changing the filter setting.');
      return;
    }

    _mountSession(mode, shuffled, allItems);
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

    // Celebration for high scores
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
