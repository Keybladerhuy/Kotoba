# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

The app uses `fetch()` for JSON data, so it must be served over HTTP — opening `index.html` directly via `file://` will not work.

```bash
# Python (simplest)
python -m http.server 8080
# Then open http://localhost:8080

# Node.js alternative
npx serve .
```

There is no build step, no bundler, and no package manager.

## Architecture

Kotoba is a vanilla JS flashcard app for Japanese study across JLPT levels N1–N5. Scripts are loaded in order at the bottom of `index.html`:

| File | Role |
|------|------|
| `js/theme.js` | `Theme` module — dark/light toggle, persists to `localStorage` key `jp_theme`, applies `data-theme` attribute on `<html>` |
| `js/data.js` | `Data` module — fetches and caches level-specific JSON files (e.g. `data/n1-kanji.json`) via `Promise.all`; exposes `setLevel(level)` / `getLevel()` |
| `js/progress.js` | `Progress` module — reads/writes study progress to `localStorage` under key `jp_progress_<level>` (e.g. `jp_progress_n1`); tracks mastery level (0=unseen → 1=passed flashcard → 2=passed quiz → 3=mastered) and correct/incorrect counts per item |
| `js/session.js` | `Session` module — shared session state (deck, shuffle, index, scoring, repeat-wrong-cards always on); determines which study mode to use per card via `currentMode()` based on mastery level |
| `js/flashcard.js` | `Flashcard` module — card flip animation (CSS class `flipped`), keyboard shortcuts (Space/←/→), self-grading; renders current card from Session |
| `js/quiz.js` | `Quiz` module — multiple choice mode: 4 answer choices, auto-grading, keyboard (1-4), visual feedback; renders current card from Session |
| `js/typing.js` | `Typing` module — dual-input mode: user must type both meaning AND reading correctly; renders current card from Session |
| `js/emoji-fx.js` | `EmojiFx` module — wraps praise emojis in animated containers with CSS-driven effects (sparkle particles, fire flicker, bounce, spin, confetti, etc.) |
| `js/app.js` | View router — boots the app, manages navigation between Home / Stats / Study / Summary views; routes each card to the correct study module via `_showCurrentCard()` |

Views are defined as `<template>` tags in `index.html` (`tpl-home`, `tpl-stats`, `tpl-flashcard`, `tpl-quiz`, `tpl-typing`, `tpl-summary`) and injected into `<main id="view">` at runtime.

**Study flow:** Cards progress through 3 mastery levels within a single session:
1. **Level 0 → Flashcard** — self-grade flip card
2. **Level 1 → Quiz** — 4-choice multiple choice
3. **Level 2 → Typing** — must type both meaning and reading correctly
4. **Level 3 = Mastered** — archived, won't appear unless progress is reset

Correct answers advance the card's mastery level and re-insert it into the session deck for testing in the next mode. Wrong answers trigger repeat-wrong behavior (always on) — the card reappears at the same level.

**Data flow:** `app.js` calls `Data.loadAll()` → `startStudy()` → `Session.start()` → `_showCurrentCard()` checks `Session.currentMode()` and mounts the appropriate module → module calls `Session.recordAndAdvance()` → `Progress.recordResult()` updates mastery → card re-inserted into deck → `_showCurrentCard()` called again for next card → `onComplete` callback triggers `showSummary()`.

## Data Files

Files follow the pattern `data/<level>-<type>.json`. The unique ID for each item is `character` (kanji) or `word` (vocab). See `data/README.md` for the full JSON schema.

| File | Contents |
|------|----------|
| `data/n1-kanji.json` | N1 kanji — `character`, `readings.on[]`, `readings.kun[]`, `meanings[]`, `compounds[]` |
| `data/n1-vocabulary.json` | N1 vocab — `word`, `reading`, `meanings[]`, `pos`, `example.ja/en` |
| `data/n2-kanji.json` … `data/n5-kanji.json` | N2–N5 kanji (empty arrays, ready to populate) |
| `data/n2-vocabulary.json` … `data/n5-vocabulary.json` | N2–N5 vocab (empty arrays, ready to populate) |
| `data/davidluzgouveia-kanji.json` | External kanji dataset (reference only, not loaded by the app) |

## Claude Code Skills

```
/add-kanji <character>   # Add a kanji entry to data/n1-kanji.json (default) or specify level
/add-vocab <word>        # Add a vocabulary entry to data/n1-vocabulary.json (default) or specify level
```

Both commands check for duplicates first and append at the end of the array. To target a specific level, include it in your message, e.g. `/add-kanji N2 漢`.
