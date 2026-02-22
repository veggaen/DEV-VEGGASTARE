/**
 * @fileOverview Multi-Provider BYOK Integration Test
 * Tests all 6 AI providers available in the BYOK flow.
 *
 * Usage:
 *   node scripts/test-byok-all-providers.mjs
 *
 * Set env vars to test real calls (all optional):
 *   GROQ_API_KEY=gsk_...
 *   OPENROUTER_API_KEY=sk-or-...
 *   ANTHROPIC_API_KEY=sk-ant-...
 *   GROK_API_KEY=xai-...
 *   GOOGLE_API_KEY=AIza...
 *   OPENAI_API_KEY=sk-proj-...  (or sk-...)
 *
 * Without real keys the script still:
 *   - Validates all provider inference logic
 *   - Confirms each API endpoint is reachable (expects 401/400 on invalid key)
 *   - Validates payload structure for every provider
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv(filePath) {
  try {
    const content = readFileSync(filePath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch { /* ok if file doesn't exist */ }
}

loadEnv(resolve(__dirname, "../.env.local"));
loadEnv(resolve(__dirname, "../.env"));

let passed = 0;
let failed = 0;
let skipped = 0;

function test(name, condition, detail) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.error(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

function skip(name, reason) {
  console.log(`  ⏭  ${name} — ${reason}`);
  skipped++;
}

// ── Provider inference (mirrors both PollBuilder.tsx and route.ts) ──────────
function inferProviderFromApiKey(input) {
  const key = input.trim();
  const lower = key.toLowerCase();
  if (!lower) return null;
  if (lower.startsWith("gsk_"))    return "GROQ";
  if (lower.startsWith("sk-or-"))  return "OPENROUTER";
  if (lower.startsWith("sk-ant-")) return "ANTHROPIC";
  if (lower.startsWith("xai-"))    return "GROK";
  if (key.startsWith("AIza"))      return "GOOGLE";
  if (lower.startsWith("sk-proj-") || lower.startsWith("sk-")) return "OPENAI";
  return null;
}

function isModelLikelyForProvider(provider, model) {
  const m = model.trim().toLowerCase();
  if (!m) return false;
  switch (provider) {
    case "GROQ":       return m.startsWith("llama-") || m.startsWith("mixtral-") || m.includes("qwen") || m.includes("gemma");
    case "OPENROUTER": return m.includes("/");
    case "ANTHROPIC":  return m.startsWith("claude");
    case "GROK":       return m.startsWith("grok-");
    case "GOOGLE":     return m.startsWith("gemini");
    case "OPENAI":     return m.startsWith("gpt-") || m.startsWith("o");
    default:           return false;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 1: Provider Inference
// ════════════════════════════════════════════════════════════════════════════
console.log("\n🔍 TEST 1: Provider Inference from API Key Prefix");

test("gsk_xxx         → GROQ",       inferProviderFromApiKey("gsk_abc123") === "GROQ");
test("sk-or-xxx       → OPENROUTER", inferProviderFromApiKey("sk-or-abc123") === "OPENROUTER");
test("sk-ant-xxx      → ANTHROPIC",  inferProviderFromApiKey("sk-ant-api03abc") === "ANTHROPIC");
test("xai-xxx         → GROK",       inferProviderFromApiKey("xai-abc123") === "GROK");
test("AIzaXxx         → GOOGLE",     inferProviderFromApiKey("AIzaSyFakeKeyHere") === "GOOGLE");
test("sk-proj-xxx     → OPENAI",     inferProviderFromApiKey("sk-proj-abcdef") === "OPENAI");
test("sk-xxx (legacy) → OPENAI",     inferProviderFromApiKey("sk-abcdef") === "OPENAI");
test("empty           → null",       inferProviderFromApiKey("") === null);
test("unknown prefix  → null",       inferProviderFromApiKey("notakey") === null);

// ════════════════════════════════════════════════════════════════════════════
// TEST 2: Model-Provider Validation
// ════════════════════════════════════════════════════════════════════════════
console.log("\n🔎 TEST 2: Model Validation per Provider");

test("GROQ  llama-3.3-70b-versatile", isModelLikelyForProvider("GROQ", "llama-3.3-70b-versatile"));
test("GROQ  llama-3.1-8b-instant",    isModelLikelyForProvider("GROQ", "llama-3.1-8b-instant"));
test("GROQ  mixtral-8x7b-32768",      isModelLikelyForProvider("GROQ", "mixtral-8x7b-32768"));
test("OPENROUTER openai/gpt-4o",      isModelLikelyForProvider("OPENROUTER", "openai/gpt-4o"));
test("OPENROUTER anthropic/claude-*", isModelLikelyForProvider("OPENROUTER", "anthropic/claude-sonnet-4-20250514"));
test("OPENROUTER google/gemini-*",    isModelLikelyForProvider("OPENROUTER", "google/gemini-2.5-pro-preview"));
test("ANTHROPIC claude-sonnet-4-*",   isModelLikelyForProvider("ANTHROPIC", "claude-sonnet-4-20250514"));
test("ANTHROPIC claude-opus-4-*",     isModelLikelyForProvider("ANTHROPIC", "claude-opus-4-20250514"));
test("ANTHROPIC claude-3-5-haiku-*",  isModelLikelyForProvider("ANTHROPIC", "claude-3-5-haiku-latest"));
test("GROK    grok-3",                isModelLikelyForProvider("GROK", "grok-3"));
test("GROK    grok-3-mini",           isModelLikelyForProvider("GROK", "grok-3-mini"));
test("GOOGLE  gemini-2.5-pro",        isModelLikelyForProvider("GOOGLE", "gemini-2.5-pro"));
test("GOOGLE  gemini-2.5-flash",      isModelLikelyForProvider("GOOGLE", "gemini-2.5-flash"));
test("GOOGLE  gemini-2.0-flash",      isModelLikelyForProvider("GOOGLE", "gemini-2.0-flash"));
test("OPENAI  gpt-4o",                isModelLikelyForProvider("OPENAI", "gpt-4o"));
test("OPENAI  gpt-4o-mini",           isModelLikelyForProvider("OPENAI", "gpt-4o-mini"));
test("OPENAI  gpt-4.1",               isModelLikelyForProvider("OPENAI", "gpt-4.1"));
test("OPENAI  o4-mini",               isModelLikelyForProvider("OPENAI", "o4-mini"));
// Cross-provider mismatch detection
test("GROQ   model rejects gpt-4o",   !isModelLikelyForProvider("GROQ", "gpt-4o"));
test("OPENAI model rejects grok-3",   !isModelLikelyForProvider("OPENAI", "grok-3"));
test("GROK   model rejects gemini-*", !isModelLikelyForProvider("GROK", "gemini-2.5-pro"));

// ════════════════════════════════════════════════════════════════════════════
// TEST 3: BYOK Payload Structure Validation
// ════════════════════════════════════════════════════════════════════════════
console.log("\n📦 TEST 3: BYOK Payload Structure per Provider");

const providerPayloads = {
  GROQ:       { mode: "one_time", provider: "GROQ",       model: "llama-3.3-70b-versatile",    apiKey: "gsk_fake" },
  OPENROUTER: { mode: "one_time", provider: "OPENROUTER", model: "openai/gpt-4o",               apiKey: "sk-or-fake" },
  ANTHROPIC:  { mode: "one_time", provider: "ANTHROPIC",  model: "claude-sonnet-4-20250514",    apiKey: "sk-ant-fake" },
  GROK:       { mode: "one_time", provider: "GROK",       model: "grok-3",                      apiKey: "xai-fake" },
  GOOGLE:     { mode: "one_time", provider: "GOOGLE",     model: "gemini-2.5-pro",              apiKey: "AIzaFake" },
  OPENAI:     { mode: "one_time", provider: "OPENAI",     model: "gpt-4o-mini",                 apiKey: "sk-proj-fake" },
};

for (const [provider, auth] of Object.entries(providerPayloads)) {
  const payload = { prompt: `Generate a 2-question quiz about ${provider} AI`, aiAuth: auth };
  test(`${provider}: payload has prompt`,        typeof payload.prompt === "string" && payload.prompt.length > 3);
  test(`${provider}: mode is one_time`,          payload.aiAuth.mode === "one_time");
  test(`${provider}: model matches provider`,    isModelLikelyForProvider(provider, payload.aiAuth.model));
  test(`${provider}: apiKey prefix infers right`, inferProviderFromApiKey(payload.aiAuth.apiKey) === provider);
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 4: API Endpoint Reachability (invalid key → expect auth error, not crash)
// ════════════════════════════════════════════════════════════════════════════
console.log("\n🌐 TEST 4: API Endpoint Reachability (dummy key → expects 401/400)");

const DUMMY_SYSTEM = "You are a quiz generator. Return JSON.";
const DUMMY_MSG    = [{ role: "system", content: DUMMY_SYSTEM }, { role: "user", content: "Hi" }];

async function pingEndpoint(label, fn) {
  try {
    const status = await fn();
    // Auth errors (401, 403, 400 for bad key) mean the endpoint IS reachable and working
    const isAuthError = [400, 401, 403].includes(status);
    test(`${label}: endpoint reachable (got ${status})`, isAuthError,
      isAuthError ? undefined : `Unexpected status ${status} — check endpoint URL`);
  } catch (err) {
    test(`${label}: endpoint reachable`, false, err.message.slice(0, 80));
  }
}

await pingEndpoint("GROQ", async () => {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer gsk_invalid_key_for_test" },
    body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: DUMMY_MSG, max_tokens: 10, response_format: { type: "json_object" } }),
    signal: AbortSignal.timeout(10000),
  });
  return r.status;
});

await pingEndpoint("OPENROUTER", async () => {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer sk-or-invalid-key-for-test",
      "HTTP-Referer": "https://veggat.com",
      "X-Title": "VeggaStare Test",
    },
    body: JSON.stringify({ model: "openai/gpt-4o-mini", messages: DUMMY_MSG, max_tokens: 10, response_format: { type: "json_object" } }),
    signal: AbortSignal.timeout(10000),
  });
  return r.status;
});

await pingEndpoint("ANTHROPIC", async () => {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": "sk-ant-invalid-key-for-test",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: "claude-3-5-haiku-latest", max_tokens: 10, system: DUMMY_SYSTEM, messages: [{ role: "user", content: "Hi" }] }),
    signal: AbortSignal.timeout(10000),
  });
  return r.status;
});

await pingEndpoint("GROK (xAI)", async () => {
  const r = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer xai-invalid-key-for-test" },
    body: JSON.stringify({ model: "grok-3-mini", messages: DUMMY_MSG, max_tokens: 10, response_format: { type: "json_object" } }),
    signal: AbortSignal.timeout(10000),
  });
  return r.status;
});

await pingEndpoint("GOOGLE (Gemini)", async () => {
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaInvalidKeyForTest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: "Hi" }] }], generationConfig: { maxOutputTokens: 10 } }),
    signal: AbortSignal.timeout(10000),
  });
  return r.status;
});

await pingEndpoint("OPENAI", async () => {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer sk-invalid-key-for-test" },
    body: JSON.stringify({ model: "gpt-4o-mini", messages: DUMMY_MSG, max_tokens: 10, response_format: { type: "json_object" } }),
    signal: AbortSignal.timeout(10000),
  });
  return r.status;
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 5: Real API Key Tests (only if keys are in env)
// ════════════════════════════════════════════════════════════════════════════
console.log("\n🔑 TEST 5: Real API Key Tests (skipped if key not in env)");

const QUIZ_PROMPT = "Generate a minimal 1-question quiz about the color of the sky. Return JSON: { title, questions: [{ questionText, type, options: [{ text }], correctAnswer }] }";

// GROQ
const groqKey = process.env.GROQ_API_KEY;
if (groqKey) {
  console.log("  [GROQ]");
  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: QUIZ_PROMPT }], max_tokens: 512, response_format: { type: "json_object" } }),
      signal: AbortSignal.timeout(20000),
    });
    test("GROQ real call (200)", r.status === 200, `Status: ${r.status}`);
    if (r.ok) {
      const d = await r.json();
      const content = d.choices?.[0]?.message?.content;
      test("GROQ returns content", !!content);
      if (content) { try { JSON.parse(content); test("GROQ returns valid JSON", true); } catch { test("GROQ returns valid JSON", false, "JSON parse failed"); } }
    }
  } catch (err) { test("GROQ real call", false, err.message); }
} else {
  skip("GROQ real call", "GROQ_API_KEY not set");
}

// ANTHROPIC
const anthropicKey = process.env.ANTHROPIC_API_KEY;
if (anthropicKey) {
  console.log("  [ANTHROPIC]");
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-3-5-haiku-latest", max_tokens: 512, system: "Return only valid JSON.", messages: [{ role: "user", content: QUIZ_PROMPT }] }),
      signal: AbortSignal.timeout(20000),
    });
    test("ANTHROPIC real call (200)", r.status === 200, `Status: ${r.status}`);
    if (r.ok) {
      const d = await r.json();
      const content = d?.content?.find(i => i?.type === "text")?.text;
      test("ANTHROPIC returns content", !!content);
      if (content) {
        const stripped = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
        try { JSON.parse(stripped); test("ANTHROPIC returns parseable JSON", true); } catch { test("ANTHROPIC returns parseable JSON", false, "JSON parse failed"); }
      }
    }
  } catch (err) { test("ANTHROPIC real call", false, err.message); }
} else {
  skip("ANTHROPIC real call", "ANTHROPIC_API_KEY not set");
}

// GROK
const grokKey = process.env.GROK_API_KEY;
if (grokKey) {
  console.log("  [GROK]");
  try {
    const r = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${grokKey}` },
      body: JSON.stringify({ model: "grok-3-mini", messages: [{ role: "user", content: QUIZ_PROMPT }], max_tokens: 512, response_format: { type: "json_object" } }),
      signal: AbortSignal.timeout(20000),
    });
    test("GROK real call (200)", r.status === 200, `Status: ${r.status}`);
    if (r.ok) {
      const d = await r.json();
      const content = d.choices?.[0]?.message?.content;
      test("GROK returns content", !!content);
      if (content) { try { JSON.parse(content); test("GROK returns valid JSON", true); } catch { test("GROK returns valid JSON", false, "JSON parse failed"); } }
    }
  } catch (err) { test("GROK real call", false, err.message); }
} else {
  skip("GROK real call", "GROK_API_KEY not set");
}

// GOOGLE
const googleKey = process.env.GOOGLE_API_KEY;
if (googleKey) {
  console.log("  [GOOGLE]");
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: QUIZ_PROMPT }] }], generationConfig: { maxOutputTokens: 512, responseMimeType: "application/json" } }),
      signal: AbortSignal.timeout(20000),
    });
    test("GOOGLE real call (200)", r.status === 200, `Status: ${r.status}`);
    if (r.ok) {
      const d = await r.json();
      const content = d?.candidates?.[0]?.content?.parts?.[0]?.text;
      test("GOOGLE returns content", !!content);
      if (content) { try { JSON.parse(content); test("GOOGLE returns valid JSON", true); } catch { test("GOOGLE returns valid JSON", false, "JSON parse failed"); } }
    }
  } catch (err) { test("GOOGLE real call", false, err.message); }
} else {
  skip("GOOGLE real call", "GOOGLE_API_KEY not set");
}

// OPENROUTER
const openrouterKey = process.env.OPENROUTER_API_KEY;
if (openrouterKey) {
  console.log("  [OPENROUTER]");
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openrouterKey}`, "HTTP-Referer": "https://veggat.com", "X-Title": "VeggaStare" },
      body: JSON.stringify({ model: "meta-llama/llama-3.3-70b-instruct:free", messages: [{ role: "user", content: QUIZ_PROMPT }], max_tokens: 512 }),
      signal: AbortSignal.timeout(20000),
    });
    test("OPENROUTER real call (200)", r.status === 200, `Status: ${r.status}`);
    if (r.ok) {
      const d = await r.json();
      const content = d.choices?.[0]?.message?.content;
      test("OPENROUTER returns content", !!content);
    }
  } catch (err) { test("OPENROUTER real call", false, err.message); }
} else {
  skip("OPENROUTER real call", "OPENROUTER_API_KEY not set");
}

// OPENAI
const openaiKey = process.env.OPENAI_API_KEY;
if (openaiKey) {
  console.log("  [OPENAI]");
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: QUIZ_PROMPT }], max_tokens: 512, response_format: { type: "json_object" } }),
      signal: AbortSignal.timeout(20000),
    });
    test("OPENAI real call (200)", r.status === 200, `Status: ${r.status}`);
    if (r.ok) {
      const d = await r.json();
      const content = d.choices?.[0]?.message?.content;
      test("OPENAI returns content", !!content);
      if (content) { try { JSON.parse(content); test("OPENAI returns valid JSON", true); } catch { test("OPENAI returns valid JSON", false, "JSON parse failed"); } }
    }
  } catch (err) { test("OPENAI real call", false, err.message); }
} else {
  skip("OPENAI real call", "OPENAI_API_KEY not set");
}

// ════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ════════════════════════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(60));
console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${skipped} skipped`);
console.log("═".repeat(60));

if (failed > 0) {
  console.log("\n⚠️  Some tests failed. Check output above.");
  process.exit(1);
} else {
  console.log("\n✅ All tests passed!");
  if (skipped > 0) {
    console.log(`   ${skipped} provider(s) skipped — set API key env vars to test them:`);
    console.log("   GROQ_API_KEY / ANTHROPIC_API_KEY / GROK_API_KEY / GOOGLE_API_KEY / OPENROUTER_API_KEY / OPENAI_API_KEY");
  }
  process.exit(0);
}
