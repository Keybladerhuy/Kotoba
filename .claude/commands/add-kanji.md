Add a kanji entry to the current JLPT level's kanji file for the character: $ARGUMENTS

## Steps

1. **Determine the target file**: Use `data/n1-kanji.json` by default. If the user specifies a level (e.g. "add N2 kanji 漢"), use `data/n2-kanji.json`, etc.
2. **Read** the target file and search for an entry where `character` equals the argument.
3. **If found**: Report "Already exists" and display the current entry. Stop.
4. **If not found**: Look up the kanji and append a new entry with the following schema:

```json
{
  "character": "覚",
  "readings": { "on": ["カク"], "kun": ["おぼ.える", "さ.める"] },
  "meanings": ["memorize", "learn", "remember"],
  "examples": ["感覚", "覚悟", "目覚める"]
}
```

## Field rules

- `character`: the single kanji character (string)
- `readings.on`: array of on-readings in katakana (use dot notation for okurigana if applicable)
- `readings.kun`: array of kun-readings in hiragana (use dot notation to mark where okurigana begins, e.g. `おぼ.える`)
- `meanings`: array of concise English meanings
- `examples`: array of 2–4 common compound words or expressions using this kanji

## Notes

- Maintain valid JSON — the file is a top-level array `[...]`
- Append the new entry at the end of the array
- Do not alter any existing entries
- If you are uncertain about readings or meanings, state your best answer and flag it for the user to confirm
