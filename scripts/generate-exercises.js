#!/usr/bin/env node

/**
 * generate-exercises.js — JLPT Reading Comprehension Exercise Generator
 *
 * Generates bite-sized reading comprehension exercises (100–250 words, multiple
 * choice with 4 options) by calling an LLM, then appends them as JSON lines to
 * level-specific JSONL files in data/exercises/.
 *
 * How it works:
 *   1. Loads config from .env and CLI args
 *   2. Picks an unused topic from exercise-topics.json (with 30-day cooldown)
 *   3. Builds a JLPT-level-specific prompt and sends it to the chosen LLM
 *   4. Parses the response, checks for duplicate passages (SHA-256)
 *   5. Appends the exercise to data/exercises/<level>-exercises.jsonl
 *   6. Updates generation-state.json to track used topics and hashes
 *
 * Usage:
 *   node scripts/generate-exercises.js [options]
 *
 * Options:
 *   --level N1|N2|N3|N4|N5   JLPT level (default: N1, or EXERCISE_LEVEL env)
 *   --count <number>          Exercises to generate per run (default: 1)
 *   --provider gemini|haiku|ollama   LLM provider (default: gemini)
 *   --dry-run                 Build the prompt and print it, but don't call the LLM
 *
 * Environment variables (from .env in project root):
 *   GEMINI_API_KEY       — Google AI Studio API key (for Gemini Flash — free tier)
 *   ANTHROPIC_API_KEY    — Anthropic API key (for Claude Haiku — paid)
 *   OLLAMA_MODEL         — Local Ollama model name (default: qwen2.5:7b)
 *   OLLAMA_URL           — Ollama server URL (default: http://localhost:11434)
 *   EXERCISE_LEVEL       — Default JLPT level if --level not given
 *   EXERCISE_COUNT       — Default count if --count not given
 *   EXERCISE_PROVIDER    — Default provider if --provider not given
 *
 * File layout:
 *   scripts/exercise-topics.json   — topic pools per level (edit to add more)
 *   scripts/generation-state.json  — auto-managed: used topics + passage hashes
 *   data/exercises/n1-exercises.jsonl — one JSON object per line, append-only
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ============================================================
// Paths — all relative to the project root
// ============================================================

const ROOT = path.resolve(__dirname, "..");
const TOPICS_PATH = path.join(__dirname, "exercise-topics.json");
const STATE_PATH = path.join(__dirname, "generation-state.json");
const EXERCISES_DIR = path.join(ROOT, "data", "exercises");
const ENV_PATH = path.join(ROOT, ".env");

// How many days before a topic can be reused. Increase this if you have a large
// topic pool; decrease it if the pool is small and you run the generator daily.
const TOPIC_COOLDOWN_DAYS = 30;

// Delay between consecutive LLM calls (ms) — avoids rate-limit errors
const INTER_REQUEST_DELAY_MS = 2000;

// ============================================================
// .env loader — simple key=value parser, no npm dependencies
// Skips blank lines and comments (#). Handles KEY=VALUE and KEY="VALUE".
// ============================================================

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) return;
  const lines = fs.readFileSync(ENV_PATH, "utf-8").split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    // Strip surrounding quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Don't overwrite vars already set in the shell environment
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

// ============================================================
// Argument parsing — minimal CLI flag reader, no dependencies
// Supports: --flag value and --boolean-flag
// ============================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    level: process.env.EXERCISE_LEVEL || "N1",
    count: parseInt(process.env.EXERCISE_COUNT || "1", 10),
    provider: process.env.EXERCISE_PROVIDER || "gemini",
    dryRun: false,
  };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--level":
        opts.level = args[++i]?.toUpperCase();
        break;
      case "--count":
        opts.count = parseInt(args[++i], 10);
        break;
      case "--provider":
        opts.provider = args[++i]?.toLowerCase();
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      default:
        console.error(`Unknown option: ${args[i]}`);
        process.exit(1);
    }
  }
  // Validate
  const validLevels = ["N1", "N2", "N3", "N4", "N5"];
  if (!validLevels.includes(opts.level)) {
    console.error(`Invalid level "${opts.level}". Must be one of: ${validLevels.join(", ")}`);
    process.exit(1);
  }
  const validProviders = ["gemini", "haiku", "ollama"];
  if (!validProviders.includes(opts.provider)) {
    console.error(`Invalid provider "${opts.provider}". Must be one of: ${validProviders.join(", ")}`);
    process.exit(1);
  }
  if (isNaN(opts.count) || opts.count < 1) {
    console.error("--count must be a positive integer");
    process.exit(1);
  }
  return opts;
}

// ============================================================
// State management — persists used topics and passage hashes
//
// Shape of generation-state.json:
// {
//   "N1": {
//     "usedTopics": [ { "topic": "...", "usedAt": "2026-04-04" } ],
//     "passageHashes": [ "sha256hex1", "sha256hex2", ... ]
//   },
//   ...
// }
// ============================================================

function loadState() {
  if (!fs.existsSync(STATE_PATH)) return {};
  return JSON.parse(fs.readFileSync(STATE_PATH, "utf-8"));
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf-8");
}

/** Ensure the state has an entry for the given level */
function ensureLevelState(state, level) {
  if (!state[level]) {
    state[level] = { usedTopics: [], passageHashes: [] };
  }
  return state[level];
}

// ============================================================
// Topic selection
//
// Strategy: pick a random topic that hasn't been used within the cooldown
// window. If all topics are on cooldown, pick the least-recently-used one.
// After generation, record the topic + date in the state file.
// ============================================================

function selectTopic(level, state) {
  const topics = loadTopics(level);
  const levelState = ensureLevelState(state, level);
  const now = new Date();
  const cooldownMs = TOPIC_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

  // Build a set of topics still on cooldown
  const recentTopics = new Set();
  for (const entry of levelState.usedTopics) {
    const usedAt = new Date(entry.usedAt);
    if (now - usedAt < cooldownMs) {
      recentTopics.add(entry.topic);
    }
  }

  // Filter to topics not on cooldown
  const available = topics.filter((t) => !recentTopics.has(t));

  if (available.length > 0) {
    // Pick randomly from available topics
    return available[Math.floor(Math.random() * available.length)];
  }

  // All topics exhausted — pick the one used longest ago
  console.warn(
    `⚠ All ${topics.length} topics for ${level} are on cooldown. ` +
    `Reusing the oldest one. Consider adding more topics to exercise-topics.json.`
  );
  const sorted = [...levelState.usedTopics].sort(
    (a, b) => new Date(a.usedAt) - new Date(b.usedAt)
  );
  return sorted[0]?.topic || topics[0];
}

function loadTopics(level) {
  const all = JSON.parse(fs.readFileSync(TOPICS_PATH, "utf-8"));
  const topics = all[level];
  if (!topics || topics.length === 0) {
    console.error(`No topics found for level ${level} in ${TOPICS_PATH}`);
    process.exit(1);
  }
  return topics;
}

/** Record that a topic was used today */
function recordTopicUsage(state, level, topic) {
  const levelState = ensureLevelState(state, level);
  levelState.usedTopics.push({
    topic,
    usedAt: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
  });
}

/** Get the last N topics for prompt injection (helps the LLM avoid repeats) */
function getRecentTopicNames(state, level, n = 10) {
  const levelState = state[level];
  if (!levelState) return [];
  return levelState.usedTopics.slice(-n).map((e) => e.topic);
}

// ============================================================
// Deduplication — SHA-256 of the passage text
//
// Before saving, we hash the passage and check against all known hashes
// for that level. This catches exact (or near-exact) duplicates that could
// occur if the LLM produces the same text twice.
// ============================================================

function hashPassage(passage) {
  return crypto.createHash("sha256").update(passage, "utf-8").digest("hex");
}

function isDuplicate(passage, state, level) {
  const levelState = ensureLevelState(state, level);
  const hash = hashPassage(passage);
  return levelState.passageHashes.includes(hash);
}

function recordPassageHash(state, level, passage) {
  const levelState = ensureLevelState(state, level);
  levelState.passageHashes.push(hashPassage(passage));
}

// ============================================================
// LLM providers
//
// Each provider function takes (prompt, systemPrompt) and returns the
// raw text response from the model. Add new providers here — just make
// sure they follow the same signature.
// ============================================================

/**
 * Google Gemini Flash — free tier: 1500 requests/day, 1M tokens/day
 * Docs: https://ai.google.dev/gemini-api/docs
 */
async function callGemini(prompt, systemPrompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set. Add it to .env or your shell environment.");
  }

  // Model fallback chain: try gemini-2.0-flash-lite first (most likely to have
  // free quota), then gemini-1.5-flash, then the full 2.0-flash as last resort.
  const models = ["gemini-3.1-flash-lite-preview", "gemini-2.5-flash-lite", "gemini-1.5-flash", "gemini-2.0-flash"];

  for (const model of models) {
    try {
      return await callGeminiModel(model, apiKey, prompt, systemPrompt);
    } catch (err) {
      const isQuota = err.message.includes("quota") || err.message.includes("429");
      if (isQuota && model !== models[models.length - 1]) {
        console.log(`   ⚠ ${model} quota exceeded, trying next model...`);
        continue;
      }
      throw err;
    }
  }
}

async function callGeminiModel(model, apiKey, prompt, systemPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.9, // Some creativity for varied passages
      maxOutputTokens: 2048,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${text}`);
  }

  const data = await res.json();
  // Gemini response shape: { candidates: [{ content: { parts: [{ text }] } }] }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error(`Unexpected Gemini response shape: ${JSON.stringify(data).slice(0, 500)}`);
  }
  return text;
}

/**
 * Anthropic Claude Haiku — cheap and capable for Japanese content
 * Docs: https://docs.anthropic.com/en/api
 */
async function callHaiku(prompt, systemPrompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set. Add it to .env or your shell environment.");
  }

  const url = "https://api.anthropic.com/v1/messages";

  const body = {
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: prompt }],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${text}`);
  }

  const data = await res.json();
  // Anthropic response shape: { content: [{ type: "text", text: "..." }] }
  const text = data.content?.[0]?.text;
  if (!text) {
    throw new Error(`Unexpected Anthropic response shape: ${JSON.stringify(data).slice(0, 500)}`);
  }
  return text;
}

/**
 * Ollama — local LLM server, completely free
 * Requires Ollama running locally: https://ollama.com
 * Default model: qwen2.5:7b (good at Japanese, reasonable size)
 */
async function callOllama(prompt, systemPrompt) {
  const model = process.env.OLLAMA_MODEL || "qwen2.5:7b";
  const baseUrl = process.env.OLLAMA_URL || "http://localhost:11434";
  const url = `${baseUrl}/api/chat`;

  const body = {
    model,
    stream: false,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
  };

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(
      `Cannot connect to Ollama at ${baseUrl}. Is it running? (ollama serve)\n${err.message}`
    );
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.message?.content || "";
}

/** Route to the correct provider */
async function callLLM(provider, prompt, systemPrompt) {
  switch (provider) {
    case "gemini":
      return callGemini(prompt, systemPrompt);
    case "haiku":
      return callHaiku(prompt, systemPrompt);
    case "ollama":
      return callOllama(prompt, systemPrompt);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// ============================================================
// Prompt construction
//
// The system prompt defines the exercise format and constraints.
// The user prompt specifies the level, topic, and recent topics to avoid.
//
// Each JLPT level gets tailored instructions for passage complexity,
// vocabulary difficulty, and question style to match the real exam.
// ============================================================

/**
 * Level-specific prompt guidance. These descriptions shape the LLM's output
 * to match authentic JLPT reading comprehension style and difficulty.
 */
const LEVEL_PROFILES = {
  N1: {
    passageStyle:
      "Write an opinion piece, editorial, or academic essay. Use formal written Japanese " +
      "(である調 or mixed styles). Include abstract concepts, nuanced arguments, and " +
      "compound sentences. Vocabulary should include low-frequency literary/academic words.",
    questionStyle:
      "Ask about the author's main argument (筆者の主張), implied meaning (どういうことか), " +
      "logical structure, or what can be inferred. Questions should require understanding " +
      "nuance and reading between the lines — not just surface-level facts.",
    wordRange: "200–250 words (Japanese characters count as 1 word each)",
    sentenceRange: "7–10 sentences",
  },
  N2: {
    passageStyle:
      "Write an informational or explanatory text — like a magazine article or textbook " +
      "excerpt. Use polite-formal style (です・ます調 or mixed). Include cause-and-effect " +
      "reasoning and some specialized vocabulary, but keep the argument structure clear.",
    questionStyle:
      "Ask about the main idea, reasons/causes, specific details mentioned in the text, " +
      "or what the author recommends. Questions should test comprehension of the logical " +
      "flow, not just vocabulary knowledge.",
    wordRange: "180–230 words",
    sentenceRange: "7–10 sentences",
  },
  N3: {
    passageStyle:
      "Write a personal narrative, blog post, or simple informational text. Use polite " +
      "style (です・ます調). Sentences should be straightforward with common grammar " +
      "patterns (N3 level). Include everyday vocabulary with occasional new words that " +
      "can be understood from context.",
    questionStyle:
      "Ask about who did what, when/where something happened, the writer's feelings or " +
      "opinion, or what happened as a result. Keep questions concrete and factual.",
    wordRange: "150–200 words",
    sentenceRange: "6–9 sentences",
  },
  N4: {
    passageStyle:
      "Write a simple story, diary entry, or short description of daily life. Use basic " +
      "polite style (です・ます調). Keep sentences short and use only common vocabulary " +
      "and basic grammar (て-form, たい, から, etc.).",
    questionStyle:
      "Ask simple factual questions: who, what, where, when. Each question should be " +
      "answerable from a single sentence in the passage.",
    wordRange: "100–150 words",
    sentenceRange: "5–8 sentences",
  },
  N5: {
    passageStyle:
      "Write a very simple text — a self-introduction, short message, or basic description. " +
      "Use only N5 grammar (は, が, を, に, で, も, etc.) and the most common vocabulary. " +
      "Keep sentences very short (under 15 characters each). Use hiragana heavily, with " +
      "kanji only for the most basic characters (日, 本, 人, 大, etc.).",
    questionStyle:
      "Ask very basic questions about stated facts. Use simple Japanese in the questions " +
      "themselves. Each question should map directly to one sentence in the passage.",
    wordRange: "80–120 words",
    sentenceRange: "5–7 sentences",
  },
};

function buildSystemPrompt() {
  return [
    "You are a JLPT reading comprehension exercise generator. You produce exercises",
    "in Japanese, formatted as JSON. Your output must be ONLY valid JSON — no markdown",
    "fences, no commentary before or after the JSON object.",
    "",
    "Output schema (strict):",
    "{",
    '  "passage": "the reading passage in Japanese",',
    '  "questions": [',
    "    {",
    '      "question": "the question in Japanese",',
    '      "options": ["A", "B", "C", "D"],',
    '      "correct": 0,  // 0-indexed: 0=A, 1=B, 2=C, 3=D',
    '      "explanation": "brief explanation in Japanese of why the answer is correct"',
    "    }",
    "  ]",
    "}",
    "",
    "Rules:",
    "- The passage MUST be entirely in Japanese (no English translations in the passage)",
    "- Questions and options MUST be in Japanese",
    "- Explanations should be in Japanese",
    "- Always provide exactly 4 options per question",
    "- The correct answer index must be 0, 1, 2, or 3",
    "- Generate 2–3 questions per passage",
    "- Make wrong answers plausible — they should require careful reading to eliminate",
    "- Do not repeat the passage text verbatim in the options",
  ].join("\n");
}

function buildUserPrompt(level, topic, recentTopics) {
  const profile = LEVEL_PROFILES[level];
  const lines = [
    `Generate a JLPT ${level} reading comprehension exercise about: "${topic}"`,
    "",
    `Passage requirements:`,
    `- ${profile.passageStyle}`,
    `- Length: ${profile.wordRange}, approximately ${profile.sentenceRange}`,
    "",
    `Question requirements:`,
    `- ${profile.questionStyle}`,
    `- 2–3 multiple choice questions, 4 options each`,
    "",
  ];

  // Inject recent topics so the LLM can avoid similar content
  if (recentTopics.length > 0) {
    lines.push(
      "For reference, these topics were recently used — make sure your passage",
      "takes a fresh angle and does not overlap with these:",
      ...recentTopics.map((t) => `  - ${t}`),
      ""
    );
  }

  lines.push("Respond with ONLY the JSON object. No other text.");
  return lines.join("\n");
}

// ============================================================
// Response parsing and validation
//
// The LLM should return pure JSON, but sometimes wraps it in markdown
// code fences or adds commentary. We try to extract the JSON object
// robustly, then validate its shape.
// ============================================================

function parseExerciseResponse(raw) {
  // Strip markdown fences if present (```json ... ``` or ``` ... ```)
  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // Try to find a JSON object in the response
  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("No JSON object found in LLM response");
  }
  cleaned = cleaned.slice(jsonStart, jsonEnd + 1);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Invalid JSON from LLM: ${err.message}\nRaw: ${cleaned.slice(0, 500)}`);
  }

  // Validate required fields
  if (typeof parsed.passage !== "string" || parsed.passage.length < 20) {
    throw new Error("Passage is missing or too short");
  }
  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error("No questions found in response");
  }
  for (let i = 0; i < parsed.questions.length; i++) {
    const q = parsed.questions[i];
    if (!q.question || !Array.isArray(q.options) || q.options.length !== 4) {
      throw new Error(`Question ${i + 1} is malformed (needs question + 4 options)`);
    }
    if (typeof q.correct !== "number" || q.correct < 0 || q.correct > 3) {
      throw new Error(`Question ${i + 1} has invalid correct index: ${q.correct}`);
    }
  }

  return parsed;
}

// ============================================================
// Exercise ID generation
//
// Format: <level>-<YYYYMMDD>-<4-digit-sequence>
// e.g., n1-20260404-0003 (third exercise generated for N1 on that date)
//
// The sequence number is determined by counting existing exercises
// for this level+date in the JSONL file.
// ============================================================

function generateId(level) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `${level.toLowerCase()}-${date}`;

  // Count how many exercises already exist with this prefix today
  const filePath = getExerciseFilePath(level);
  let seq = 1;
  if (fs.existsSync(filePath)) {
    const lines = fs.readFileSync(filePath, "utf-8").split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const ex = JSON.parse(line);
        if (ex.id && ex.id.startsWith(prefix)) seq++;
      } catch {
        // skip malformed lines
      }
    }
  }

  return `${prefix}-${String(seq).padStart(4, "0")}`;
}

// ============================================================
// Storage — JSONL (one JSON object per line, append-only)
//
// JSONL is ideal here because:
// - Appending doesn't require parsing the whole file
// - Each line is independently valid JSON
// - Easy to stream/process line by line for large files
// - Human-readable with `cat` or simple scripts
// ============================================================

function getExerciseFilePath(level) {
  return path.join(EXERCISES_DIR, `${level.toLowerCase()}-exercises.jsonl`);
}

function saveExercise(exercise) {
  // Ensure the exercises directory exists
  if (!fs.existsSync(EXERCISES_DIR)) {
    fs.mkdirSync(EXERCISES_DIR, { recursive: true });
  }
  const filePath = getExerciseFilePath(exercise.level);
  const line = JSON.stringify(exercise) + "\n";
  fs.appendFileSync(filePath, line, "utf-8");
}

// ============================================================
// Main — orchestrates the generation loop
// ============================================================

async function main() {
  loadEnv();
  const opts = parseArgs();

  console.log(`\n📖 JLPT ${opts.level} Reading Exercise Generator`);
  console.log(`   Provider: ${opts.provider} | Count: ${opts.count}`);
  if (opts.dryRun) console.log("   ⚡ DRY RUN — will print prompts but not call the LLM\n");

  const state = loadState();
  const systemPrompt = buildSystemPrompt();
  let generated = 0;

  for (let i = 0; i < opts.count; i++) {
    const exerciseNum = i + 1;
    console.log(`\n--- Exercise ${exerciseNum}/${opts.count} ---`);

    // 1. Pick a topic
    const topic = selectTopic(opts.level, state);
    const recentTopics = getRecentTopicNames(state, opts.level);
    console.log(`   Topic: "${topic}"`);

    // 2. Build prompts
    const userPrompt = buildUserPrompt(opts.level, topic, recentTopics);

    if (opts.dryRun) {
      console.log("\n[System Prompt]");
      console.log(systemPrompt);
      console.log("\n[User Prompt]");
      console.log(userPrompt);
      continue;
    }

    // 3. Call the LLM
    console.log(`   Calling ${opts.provider}...`);
    let rawResponse;
    try {
      rawResponse = await callLLM(opts.provider, userPrompt, systemPrompt);
    } catch (err) {
      console.error(`   ✗ LLM call failed: ${err.message}`);
      continue; // Skip this one, try the next
    }

    // 4. Parse and validate the response
    let parsed;
    try {
      parsed = parseExerciseResponse(rawResponse);
    } catch (err) {
      console.error(`   ✗ Parse error: ${err.message}`);
      continue;
    }

    // 5. Check for duplicate passages
    if (isDuplicate(parsed.passage, state, opts.level)) {
      console.warn(`   ⚠ Duplicate passage detected — skipping`);
      continue;
    }

    // 6. Build the full exercise object and save it
    const exercise = {
      id: generateId(opts.level),
      level: opts.level,
      topic,
      generated_at: new Date().toISOString(),
      passage: parsed.passage,
      questions: parsed.questions,
    };

    saveExercise(exercise);
    recordTopicUsage(state, opts.level, topic);
    recordPassageHash(state, opts.level, parsed.passage);
    generated++;

    console.log(`   ✓ Saved: ${exercise.id} (${parsed.questions.length} questions)`);

    // Rate-limit delay between requests (skip after the last one)
    if (i < opts.count - 1) {
      await new Promise((r) => setTimeout(r, INTER_REQUEST_DELAY_MS));
    }
  }

  // Persist state (used topics + hashes) after all exercises are done
  saveState(state);

  console.log(`\n✅ Done. Generated ${generated}/${opts.count} exercises.`);
  if (generated > 0) {
    console.log(`   Saved to: ${getExerciseFilePath(opts.level)}`);
  }
}

// Run it
main().catch((err) => {
  console.error(`\n❌ Fatal error: ${err.message}`);
  process.exit(1);
});
