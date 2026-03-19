#!/usr/bin/env python3
"""
Extract vocabulary table from VocabListN1.pdf into vocab_raw.tsv.

The PDF has a 10-column table layout:
  col 0 or 1: Kanji
  col 4 or 5: Hiragana
  col 8:      English (may continue on next sub-row)
"""

import sys
import os

PDF_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "VocabListN1.pdf")
TSV_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "vocab_raw.tsv")


def cell(row, *indices):
    """Return first non-empty string from given indices in a row."""
    for i in indices:
        if i < len(row) and row[i] and str(row[i]).strip():
            return str(row[i]).strip()
    return ""


def extract_rows():
    import pdfplumber

    entries = []  # list of (kanji, hiragana, english)
    current = None  # (kanji, hiragana, english_parts)

    with pdfplumber.open(PDF_PATH) as pdf:
        total = len(pdf.pages)
        print(f"PDF loaded: {total} pages")

        for page_num, page in enumerate(pdf.pages):
            tables = page.extract_tables()
            if not tables:
                continue

            for table in tables:
                for row in table:
                    if not row or len(row) < 9:
                        continue

                    kanji = cell(row, 0, 1)
                    hiragana = cell(row, 4, 5)
                    # English column: index 8 for 10-col rows, index 7 for 9-col rows
                    english = cell(row, 8, 7)

                    # Skip pure separator / empty rows
                    if not kanji and not hiragana and not english:
                        continue

                    # Detect a new vocabulary entry: has Japanese content
                    has_japanese = any(
                        '\u3000' <= ch <= '\u9fff' or
                        '\u3040' <= ch <= '\u309f' or
                        '\u30a0' <= ch <= '\u30ff'
                        for ch in (kanji + hiragana)
                    )

                    if has_japanese and kanji:
                        # Save previous entry
                        if current:
                            entries.append((current[0], current[1], " ".join(current[2])))
                        current = (kanji, hiragana, [english] if english else [])
                    elif has_japanese and not kanji and hiragana:
                        # Kanji-less entry (hiragana-only word)
                        if current:
                            entries.append((current[0], current[1], " ".join(current[2])))
                        current = (hiragana, hiragana, [english] if english else [])
                    elif english and current:
                        # Continuation of English meaning from previous entry
                        current[2].append(english)

            if (page_num + 1) % 20 == 0:
                print(f"  Processed {page_num + 1}/{total} pages, {len(entries)} entries so far...")

        # Don't forget the last entry
        if current:
            entries.append((current[0], current[1], " ".join(current[2])))

    return entries


def main():
    if not os.path.exists(PDF_PATH):
        print(f"ERROR: PDF not found at {PDF_PATH}", file=sys.stderr)
        sys.exit(1)

    print("Extracting vocabulary from PDF...")
    entries = extract_rows()

    # Deduplicate while preserving order
    seen = set()
    unique = []
    for kanji, hiragana, english in entries:
        key = kanji
        if key not in seen:
            seen.add(key)
            unique.append((kanji, hiragana, english))

    print(f"\nTotal unique entries extracted: {len(unique)}")

    # Write TSV
    os.makedirs(os.path.dirname(TSV_PATH), exist_ok=True)
    with open(TSV_PATH, "w", encoding="utf-8") as f:
        f.write("Kanji\tHiragana\tEnglish\n")
        for kanji, hiragana, english in unique:
            # Sanitize tabs within fields
            english = english.replace("\t", " ")
            f.write(f"{kanji}\t{hiragana}\t{english}\n")

    print(f"Written to: {TSV_PATH}")

    print("\n--- First 10 rows ---")
    for kanji, hiragana, english in unique[:10]:
        print(f"  {kanji:12}  {hiragana:16}  {english[:60]}")


if __name__ == "__main__":
    main()
