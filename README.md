# Kotoba - Japanese N1 Study App

A flashcard and quiz app for studying JLPT N1 kanji and vocabulary, built with vanilla JavaScript.

## Features

- **Flashcard mode** — flip cards to reveal readings, meanings, and examples, then self-grade
- **Multiple choice quiz** — test yourself with 4 answer choices and automatic grading
- **Typing mode** — type the meaning or reading for each card
- **Spaced repetition (SRS)** — SM-2 algorithm with learning steps schedules reviews based on your performance
- **Repeat wrong cards** — missed cards reappear later in the session so you must answer them correctly
- **Progress tracking** — cards progress through new, learning, and known stages
- **Configurable sessions** — adjust quiz size, card filters, study mode, and SRS parameters

## Getting Started

The app needs to be served over HTTP (no build step required).

```bash
cd C:\Code\Claude\JapaneseN1
python -m http.server 8080
# Open http://localhost:8080
```

## Data

- `data/kanji.json` — kanji with readings, meanings, and example words
- `data/vocabulary.json` — vocabulary with readings, meanings, part of speech, and example sentences

See `data/README.md` for the JSON schema.

## Spaced Repetition (SRS)

The app uses a modified **SM-2 algorithm** with two phases: learning steps and long-term SRS.

### How it works

1. **New card** — starts at learning step 0
2. **Learning phase** — each correct answer advances the card through the learning steps (default: 1 day, 3 days). A wrong answer resets the card back to step 0.
3. **Graduation** — after completing all learning steps, the card enters full SRS with a graduate interval (default: 6 days)
4. **Full SRS** — each correct answer multiplies the interval by the card's ease factor. Wrong answers reset the card back to the learning phase.
5. **Repeat wrong cards** — when enabled, cards you get wrong are re-inserted later in the current session. Each wrong answer requires one additional correct answer before the card is cleared.

Cards are scheduled for review based on their interval. The "Review Due" button on the home screen shows only cards whose review date has arrived.

### SRS Settings

All SRS parameters can be configured from the **SRS Settings** panel on the home screen (click to expand). Changes are saved automatically and persist across sessions.

| Setting | Default | Description |
|---------|---------|-------------|
| Repeat wrong cards | On | Re-queue missed cards within a session so you must answer them correctly |
| Learning steps | 1, 3 | Comma-separated intervals in days for new cards before they graduate to full SRS |
| Graduate interval | 6 | First full SRS interval (in days) after completing all learning steps |
| Default ease | 2.5 | Starting ease factor for new cards — higher means longer intervals grow faster |
| Minimum ease | 1.3 | Ease factor floor — prevents intervals from growing too slowly |
| Ease bonus | 0.1 | Added to ease factor on each correct answer (capped at default ease) |
| Ease penalty | 0.2 | Subtracted from ease factor on each wrong answer |
| Correct to "known" | 3 | Number of total correct answers needed to promote a card from "learning" to "known" |

To reset all SRS settings to their defaults, click **Reset to Defaults** at the bottom of the SRS Settings panel.
