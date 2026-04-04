"""
Populate kanji example compounds from Jisho.org's public API.

Usage:
    python scripts/populate_examples.py [--level n1]

Fetches up to 3 common compound words for each kanji that has an empty
examples array. Progress is tracked in a checkpoint file so the script
can be safely interrupted and resumed.
"""

import argparse
import json
import os
import sys
import time
import urllib.request
import urllib.error
import urllib.parse

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
JISHO_API = "https://jisho.org/api/v1/search/words"
REQUEST_DELAY = 1.5        # seconds between requests
MAX_RETRIES = 4            # retries per kanji on failure
RETRY_BACKOFF = [3, 6, 15, 30]  # wait times for each retry
MAX_EXAMPLES = 3           # examples to keep per kanji


def fetch_examples(kanji):
    """Query Jisho for compound words containing `kanji`. Returns list of strings."""
    url = f"{JISHO_API}?keyword=*{urllib.parse.quote(kanji)}*"
    req = urllib.request.Request(url, headers={"User-Agent": "KotobaStudyApp/1.0"})

    resp = urllib.request.urlopen(req, timeout=15)
    body = json.loads(resp.read().decode("utf-8"))

    results = []
    for entry in body.get("data", []):
        # prefer common words
        if not entry.get("is_common", False):
            continue
        word = entry.get("japanese", [{}])[0].get("word", "")
        # skip if no kanji form, or if it's just the kanji by itself
        if not word or word == kanji:
            continue
        # must actually contain our kanji (wildcard can be loose)
        if kanji not in word:
            continue
        results.append(word)
        if len(results) >= MAX_EXAMPLES:
            break

    # if we didn't get enough common words, accept uncommon ones
    if len(results) < MAX_EXAMPLES:
        for entry in body.get("data", []):
            if entry.get("is_common", False):
                continue  # already processed
            word = entry.get("japanese", [{}])[0].get("word", "")
            if not word or word == kanji or kanji not in word:
                continue
            if word in results:
                continue
            results.append(word)
            if len(results) >= MAX_EXAMPLES:
                break

    return results


def load_checkpoint(path):
    """Load set of already-processed kanji characters."""
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return set(json.load(f))
    return set()


def save_checkpoint(path, done_set):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(sorted(done_set), f, ensure_ascii=False)


def main():
    parser = argparse.ArgumentParser(description="Populate kanji examples from Jisho")
    parser.add_argument("--level", default="n1", help="JLPT level (default: n1)")
    args = parser.parse_args()

    level = args.level.lower()
    data_path = os.path.join(PROJECT_DIR, "data", f"{level}-kanji.json")
    checkpoint_path = os.path.join(SCRIPT_DIR, f".examples_checkpoint_{level}.json")

    if not os.path.exists(data_path):
        print(f"Error: {data_path} not found")
        sys.exit(1)

    # Load data
    with open(data_path, "r", encoding="utf-8") as f:
        kanji_list = json.load(f)

    done = load_checkpoint(checkpoint_path)
    total = len(kanji_list)
    need = sum(1 for k in kanji_list if not k.get("examples") and k["character"] not in done)
    already = sum(1 for k in kanji_list if k.get("examples"))

    print(f"Level: {level.upper()}")
    print(f"Total kanji: {total}")
    print(f"Already have examples: {already}")
    print(f"Checkpointed (fetched this run or prior): {len(done)}")
    print(f"Remaining to fetch: {need}")
    print(f"Estimated time: {need * REQUEST_DELAY / 60:.1f} minutes")
    print()

    updated = 0
    failed = []

    for i, entry in enumerate(kanji_list):
        char = entry["character"]

        # Skip if already has examples or already checkpointed
        if entry.get("examples"):
            continue
        if char in done:
            # Apply cached — re-read from the file isn't needed since
            # checkpoint only marks "done", the data file has the results.
            continue

        # Fetch with retries
        examples = None
        for attempt in range(MAX_RETRIES + 1):
            try:
                examples = fetch_examples(char)
                break
            except (urllib.error.HTTPError, urllib.error.URLError, OSError) as e:
                if attempt < MAX_RETRIES:
                    wait = RETRY_BACKOFF[attempt]
                    print(f"  Retry {attempt + 1}/{MAX_RETRIES} for {char} "
                          f"({e}) — waiting {wait}s")
                    time.sleep(wait)
                else:
                    print(f"  FAILED {char} after {MAX_RETRIES} retries: {e}")
                    failed.append(char)

        if examples is not None:
            entry["examples"] = examples
            done.add(char)
            updated += 1
            status = ", ".join(examples) if examples else "(no compounds found)"
            print(f"[{updated}/{need}] {char} → {status}")

            # Save data + checkpoint every 10 entries
            if updated % 10 == 0:
                with open(data_path, "w", encoding="utf-8") as f:
                    json.dump(kanji_list, f, ensure_ascii=False, indent=2)
                save_checkpoint(checkpoint_path, done)

            time.sleep(REQUEST_DELAY)

    # Final save
    with open(data_path, "w", encoding="utf-8") as f:
        json.dump(kanji_list, f, ensure_ascii=False, indent=2)
    save_checkpoint(checkpoint_path, done)

    print()
    print(f"Done! Updated {updated} entries.")
    if failed:
        print(f"Failed ({len(failed)}): {', '.join(failed)}")
    print(f"Checkpoint saved to {checkpoint_path}")
    print(f"Data saved to {data_path}")


if __name__ == "__main__":
    main()
