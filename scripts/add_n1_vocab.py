"""Batch-add N1 vocabulary entries to data/vocabulary.json, skipping duplicates."""
import json, os

VOCAB_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'vocabulary.json')

NEW_ENTRIES = [
    ("齎す", "もたらす", ["to bring about", "to cause", "to produce"], "verb",
     "この政策は大きな変化を齎した。", "This policy brought about major changes."),
    ("瞬く", "またたく", ["to blink", "to twinkle", "to flicker"], "verb",
     "星が瞬いている。", "The stars are twinkling."),
    ("翻す", "ひるがえす", ["to turn over", "to reverse", "to wave (flag)"], "verb",
     "彼は自分の決定を翻した。", "He reversed his decision."),
    ("蔑む", "さげすむ", ["to scorn", "to despise", "to look down on"], "verb",
     "他人を蔑むべきではない。", "You should not look down on others."),
    ("嘲る", "あざける", ["to ridicule", "to mock", "to jeer at"], "verb",
     "失敗した人を嘲るのは卑劣だ。", "It is cowardly to mock those who have failed."),
    ("怯える", "おびえる", ["to be frightened", "to cower", "to tremble with fear"], "verb",
     "子供は雷に怯えていた。", "The child was frightened by the thunder."),
    ("慄く", "おののく", ["to tremble", "to shudder", "to shiver with fear"], "verb",
     "恐怖で慄いた。", "I trembled with fear."),
    ("儚い", "はかない", ["fleeting", "transient", "ephemeral"], "adjective",
     "人生は儚いものだ。", "Life is a fleeting thing."),
    ("疎い", "うとい", ["distant", "estranged", "unfamiliar with"], "adjective",
     "私は機械に疎い。", "I am unfamiliar with machines."),
    ("逞しい", "たくましい", ["sturdy", "robust", "strong-willed"], "adjective",
     "彼は逞しい体つきをしている。", "He has a sturdy build."),
    ("呆れる", "あきれる", ["to be astonished", "to be dumbfounded", "to be exasperated"], "verb",
     "彼の無礼さに呆れた。", "I was dumbfounded by his rudeness."),
    ("媚びる", "こびる", ["to flatter", "to fawn on", "to curry favor"], "verb",
     "上司に媚びるのは嫌いだ。", "I dislike fawning on my superiors."),
    ("拗ねる", "すねる", ["to sulk", "to pout", "to be peevish"], "verb",
     "子供が拗ねてしまった。", "The child started sulking."),
    ("窘める", "たしなめる", ["to admonish", "to warn", "to rebuke gently"], "verb",
     "母は子供を窘めた。", "The mother gently admonished the child."),
    ("塞ぐ", "ふさぐ", ["to block", "to close up", "to obstruct"], "verb",
     "穴を塞いでください。", "Please block the hole."),
    ("弄ぶ", "もてあそぶ", ["to toy with", "to trifle with", "to play with"], "verb",
     "人の感情を弄んではいけない。", "You must not toy with people's feelings."),
    ("罵る", "ののしる", ["to abuse verbally", "to curse at", "to revile"], "verb",
     "彼は相手を罵った。", "He verbally abused his opponent."),
    ("僻む", "ひがむ", ["to be prejudiced", "to be envious", "to take offense"], "verb",
     "そう僻まないでください。", "Please don't take it the wrong way."),
    ("蝕む", "むしばむ", ["to eat into", "to erode", "to undermine"], "verb",
     "汚染が環境を蝕んでいる。", "Pollution is eroding the environment."),
    ("侮る", "あなどる", ["to despise", "to underestimate", "to look down on"], "verb",
     "敵を侮ってはならない。", "You must not underestimate the enemy."),
    ("顧みる", "かえりみる", ["to reflect on", "to look back", "to take into consideration"], "verb",
     "過去を顧みることは大切だ。", "It is important to reflect on the past."),
    ("揶揄", "やゆ", ["ridicule", "mockery", "teasing"], "noun",
     "彼の発言は揶揄に満ちていた。", "His remarks were full of mockery."),
    ("矜持", "きょうじ", ["pride", "dignity", "self-respect"], "noun",
     "職人としての矜持を持っている。", "He has pride as a craftsman."),
    ("刹那", "せつな", ["moment", "instant", "split second"], "noun",
     "刹那の判断が命を救った。", "A split-second decision saved a life."),
    ("杞憂", "きゆう", ["groundless fear", "needless anxiety", "unfounded worry"], "noun",
     "それは杞憂に過ぎなかった。", "It was nothing but a groundless fear."),
    ("逡巡", "しゅんじゅん", ["hesitation", "indecision", "vacillation"], "noun",
     "彼は逡巡の末に決断した。", "He made a decision after much hesitation."),
    ("慟哭", "どうこく", ["wailing", "lamentation", "bitter weeping"], "noun",
     "彼女は慟哭した。", "She wailed bitterly."),
    ("邂逅", "かいこう", ["chance meeting", "unexpected encounter"], "noun",
     "旧友との邂逅に驚いた。", "I was surprised by the chance meeting with an old friend."),
    ("忌憚", "きたん", ["reserve", "hesitation", "restraint"], "noun",
     "忌憚のないご意見をお聞かせください。", "Please give us your frank opinion."),
    ("瓦解", "がかい", ["collapse", "downfall", "disintegration"], "noun",
     "組織が瓦解した。", "The organization collapsed."),
    ("恣意", "しい", ["arbitrariness", "wilfulness", "capriciousness"], "noun",
     "恣意的な判断は避けるべきだ。", "Arbitrary decisions should be avoided."),
    ("怠惰", "たいだ", ["laziness", "sloth", "indolence"], "na-adjective",
     "怠惰な生活を送っている。", "He is leading an indolent life."),
    ("貪欲", "どんよく", ["greed", "avarice", "rapacity"], "na-adjective",
     "知識に対して貪欲であるべきだ。", "One should be greedy for knowledge."),
    ("寡黙", "かもく", ["taciturn", "reticent", "quiet"], "na-adjective",
     "彼は寡黙な人だ。", "He is a taciturn person."),
    ("傲慢", "ごうまん", ["arrogance", "haughtiness", "insolence"], "na-adjective",
     "傲慢な態度は嫌われる。", "An arrogant attitude is disliked."),
    ("狡猾", "こうかつ", ["cunning", "sly", "crafty"], "na-adjective",
     "狡猾な手段を使った。", "He used cunning means."),
    ("辛辣", "しんらつ", ["bitter", "harsh", "scathing"], "na-adjective",
     "辛辣な批評を受けた。", "He received scathing criticism."),
    ("荘厳", "そうごん", ["solemn", "sublime", "majestic"], "na-adjective",
     "荘厳な雰囲気に包まれた。", "It was enveloped in a solemn atmosphere."),
    ("安堵", "あんど", ["relief", "reassurance"], "noun",
     "合格の知らせに安堵した。", "I felt relief at the news of passing."),
    ("惰性", "だせい", ["inertia", "habit", "momentum"], "noun",
     "惰性で続けているだけだ。", "I am just continuing out of inertia."),
    ("葛藤", "かっとう", ["conflict", "discord", "inner struggle"], "noun",
     "心の中で葛藤が続いている。", "An inner struggle continues in my heart."),
    ("憤慨", "ふんがい", ["indignation", "resentment", "outrage"], "noun",
     "不正に対して憤慨した。", "I was indignant at the injustice."),
    ("懸念", "けねん", ["concern", "worry", "apprehension"], "noun",
     "安全性に対する懸念が高まっている。", "Concerns about safety are growing."),
    ("脆弱", "ぜいじゃく", ["fragile", "vulnerable", "frail"], "na-adjective",
     "このシステムは脆弱だ。", "This system is vulnerable."),
    ("潤沢", "じゅんたく", ["abundant", "ample", "plentiful"], "na-adjective",
     "潤沢な資金がある。", "There are ample funds."),
    ("稀有", "けう", ["rare", "extraordinary", "uncommon"], "na-adjective",
     "稀有な才能の持ち主だ。", "He is a person of rare talent."),
    ("凄惨", "せいさん", ["ghastly", "gruesome", "appalling"], "na-adjective",
     "凄惨な事件が起きた。", "A gruesome incident occurred."),
    ("喧噪", "けんそう", ["noise", "clamor", "tumult"], "noun",
     "都会の喧噪から離れたい。", "I want to get away from the clamor of the city."),
    ("疲弊", "ひへい", ["exhaustion", "impoverishment", "depletion"], "noun",
     "長期の戦争で国が疲弊した。", "The country was exhausted by the long war."),
    ("躊躇", "ちゅうちょ", ["hesitation", "indecision", "wavering"], "noun",
     "躊躇なく行動した。", "I acted without hesitation."),
]

def main():
    with open(VOCAB_PATH, 'r', encoding='utf-8') as f:
        vocab = json.load(f)

    existing = {e['word'] for e in vocab}
    added = 0
    skipped = 0

    for word, reading, meanings, pos, ex_ja, ex_en in NEW_ENTRIES:
        if word in existing:
            skipped += 1
            continue
        vocab.append({
            "word": word,
            "reading": reading,
            "meanings": meanings,
            "pos": pos,
            "example": {"ja": ex_ja, "en": ex_en}
        })
        existing.add(word)
        added += 1

    with open(VOCAB_PATH, 'w', encoding='utf-8') as f:
        json.dump(vocab, f, ensure_ascii=False, indent=2)

    print(f"Done: {added} added, {skipped} skipped (duplicate)")

if __name__ == '__main__':
    main()
