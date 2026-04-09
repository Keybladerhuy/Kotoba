# Plan: 3-Stage Typing Quiz Overhaul

## Context

The current study flow uses 3 different UI modules (Flashcard flip -> Multiple-choice Quiz -> Typing) mapped to mastery levels 0/1/2. This feels disjointed. The new design replaces all three with a **single typing-based module** that uses a progressive hint system across 3 stages, making the experience more intuitive and consistent. Both kanji and vocabulary will use this new flow.

## New Study Flow

**Stage 1 (mastery 0 -> 1):** Type answers with **full hints** shown (faded). As each answer is typed correctly, its hint unfades.  
**Stage 2 (mastery 1 -> 2):** Type answers with **partial hints** (first half of characters + "...").  
**Stage 3 (mastery 2 -> 3):** Type answers with **no hints**.  
**On failure:** Mastery resets to 0, card re-enters deck at Stage 1.

### Kanji: 3 fields
- **On Reading** — at least 1 correct On reading required  (field skipped if none exist)
- **Kun Reading** — at least 1 correct Kun reading required (field skipped if none exist)
- **Meaning** — at least 1 correct meaning required
- **Compounds** shown at all times

### Vocab: 2 fields
- **Reading** — must type the correct reading
- **Meaning** — at least 1 correct meaning required

## Files to Modify

### 1. `js/progress.js` — Add `resetMastery(id)`

Add a new function after `recordResult()` (~line 83):

```js
function resetMastery(id) {
  const all = _load();
  if (!all[id]) return;
  all[id].masteryLevel = 0;
  all[id].lastSeen = new Date().toISOString();
  all[id].incorrectCount += 1;
  _save(all);
}
```

Expose in return object on line 126.

### 2. `js/session.js` — Route all cards to new module

**`currentMode()` (lines 55-65):** Return `'staged-typing'` for levels 0/1/2, `null` for 3. Remove the kanji/vocab mode branching — both use the same module now.

**Add `currentStage()`:** Returns the current card's mastery level (0, 1, or 2) so the typing module knows which hint level to use.

**`recordAndAdvance()` (lines 138-146, incorrect branch):** Call `Progress.resetMastery(id)` instead of `Progress.recordResult(id, false)`. Also reset the `_repeatMap` entry's `correctNeeded` to 0 since the mastery reset is already the punishment.

Expose `currentStage` in return object.

### 3. `index.html` — New template + script tag

**Add `<template id="tpl-staged-typing">`** after the existing typing template (~line 217). Structure:
- Standard quiz-header (back button, counter, progress bar, score)
- Prompt area showing the character/word + stage badge
- Dynamic input fields container (populated by JS based on kanji vs vocab)
- Each field: label, text input, hint container div
- Compounds section (kanji only, always visible)
- Submit button
- Feedback area

**Add script tag:** `<script src="js/staged-typing.js"></script>` after `typing.js` (line 333).

### 4. `js/staged-typing.js` — New module (largest change)

Single IIFE module `StagedTyping` with:

- **Normalization:** Duplicate `_kataToHira()` and `_normalize()` from typing.js (4 lines each, avoids touching existing code)
- **Hint generation:** `_getHintText(answer, stage)` — stage 0: full text, stage 1: first half + "...", stage 2: empty
- **Field config builder:** Based on `Session.mode()`, builds array of field definitions:
  - Kanji: `[{id:'on', label:'On Reading', answers: item.readings.on}, {id:'kun', ...}, {id:'meaning', ...}]` — skip kun if empty array
  - Vocab: `[{id:'reading', label:'Reading', answers: [item.reading]}, {id:'meaning', label:'Meaning', answers: item.meanings}]`
- **Render:** Build inputs + hint containers dynamically from field config. Render compounds for kanji.
- **Live hint updates:** On `input` event for each field (stages 0 and 1), check typed value against accepted answers and toggle matched hints from `hint-faded` to `hint-matched`
- **Submit/grade:** Check each field — at least 1 match per field required. Overall correct = all fields valid. Call `Session.recordAndAdvance(isCorrect)`.
- **Feedback:** Show correct/incorrect per field with visual styling. On wrong, show the expected answers.
- **Keyboard:** Enter to submit, Enter again to advance after feedback.

### 5. `css/styles.css` — New styles

Add after the existing typing styles:
- `.staged-typing-view` — layout container
- `.st-field` — individual field wrapper (label + input + hints)
- `.st-hints` — flex-wrap container for hint chips
- `.st-hint` — individual hint chip (base style)
- `.st-hint-faded` — `opacity: 0.35`
- `.st-hint-matched` — `opacity: 1; color: var(--correct); font-weight: 600`
- `.st-compounds` — compounds list, subtle styling, always visible
- `.st-stage-badge` — stage indicator ("Stage 1/3")
- Input correct/wrong states reuse existing `.input-correct` / `.input-wrong` classes

### 6. `js/app.js` — Update routing

**`_showCurrentCard()` (~line 288):** Replace the 3 existing branches (flashcard/quiz/typing) with a single `'staged-typing'` branch:
```js
if (studyMode === 'staged-typing') {
  const frag = cloneTemplate('tpl-staged-typing');
  setView(frag);
  _addModeBadge(`Stage ${Session.currentStage() + 1}/3`);
  document.querySelector('[data-action="home"]')?.addEventListener('click', showHome);
  StagedTyping.mount(_currentMode, _showCurrentCard);
}
```

**Cleanup points:** Add `StagedTyping.unmount()` alongside existing unmount calls in `setView()`, `showSummary()`.

**Note:** `flashcard.js`, `quiz.js`, and `typing.js` become unused but are left in place (no deletion, avoids risk).

## Edge Cases

- **Kanji with empty `kun` array** (e.g. 鬱): Skip the Kun field entirely. Grading requires only On + Meaning.
- **Kanji with empty `on` array** (if any exist): Same treatment — skip On field.
- **Compounds format:** N1 uses strings, N5 uses `{word, meaning}` objects. Handle both in render.
- **Existing progress data:** Mastery levels 0-3 map directly to stages 0-2 + mastered. Backward compatible.
- **Dot notation in readings** (e.g. "うれ.える"): Display with dots in hints, strip dots for matching via `_normalize()`.

## Implementation Order

1. `progress.js` — add `resetMastery()` (smallest, no deps)
2. `session.js` — modify `currentMode()`, `recordAndAdvance()`, add `currentStage()`
3. `index.html` — add template + script tag
4. `js/staged-typing.js` — create new module
5. `css/styles.css` — add new styles
6. `js/app.js` — update routing and cleanup

## Verification

1. Start the HTTP server: `python -m http.server 8080`
2. Open http://localhost:8080, select a JLPT level with kanji data (N1 or N5)
3. Start studying kanji:
   - Stage 1: Verify all answers shown as faded hints, typing correct answer unfades it, compounds visible
   - Submit correct: card advances to Stage 2 and reappears with partial hints
   - Stage 2: Verify hints show first half only
   - Submit correct: card advances to Stage 3, no hints
   - Submit correct: card mastered, removed from deck
   - Submit wrong at any stage: verify card reappears at Stage 1 with full hints
4. Start studying vocabulary:
   - Verify 2 fields (Reading + Meaning) with same 3-stage hint progression
5. Check Stats page still shows correct mastery counts
6. Check edge case: kanji with no Kun readings (e.g. 鬱) — Kun field should not appear
