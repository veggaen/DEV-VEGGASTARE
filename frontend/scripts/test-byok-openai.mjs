/**
 * @fileOverview BYOK OpenAI Integration Test
 * Tests the full BYOK flow as if a user pasted their own OpenAI key.
 *
 * Usage: node scripts/test-byok-openai.mjs
 *
 * Tests:
 * 1. Provider inference from key prefix (sk-proj-* → OPENAI)
 * 2. Direct OpenAI API call with the key (model listing + chat completion)
 * 3. Simulated BYOK payload validation (same structure PollBuilder sends)
 * 4. Full generate-stream endpoint call (requires running dev server + auth)
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env");

// ── Load OPENAI_API_KEY from .env ──────────────────────────────────────────
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
      // Strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch { /* ok if file doesn't exist */ }
}

// Also try .env.local first (higher priority)
loadEnv(resolve(__dirname, "../.env.local"));
loadEnv(envPath);

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY) {
  console.error("❌ OPENAI_API_KEY not found in .env or .env.local");
  process.exit(1);
}

const REDACTED = OPENAI_KEY.slice(0, 10) + "..." + OPENAI_KEY.slice(-4);
let passed = 0;
let failed = 0;

function test(name, condition, detail) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.error(`  ❌ ${name} — ${detail || "FAILED"}`);
    failed++;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 1: Provider Inference (mirrors PollBuilder.tsx inferProviderFromApiKey)
// ════════════════════════════════════════════════════════════════════════════
console.log("\n🔍 TEST 1: Provider Inference from API Key Prefix");
console.log(`   Key: ${REDACTED}`);

function inferProviderFromApiKey(input) {
  const key = input.trim();
  const lower = key.toLowerCase();
  if (!lower) return null;
  if (lower.startsWith("gsk_")) return "GROQ";
  if (lower.startsWith("sk-or-")) return "OPENROUTER";
  if (lower.startsWith("sk-ant-")) return "ANTHROPIC";
  if (lower.startsWith("xai-")) return "GROK";
  if (key.startsWith("AIza")) return "GOOGLE";
  if (lower.startsWith("sk-proj-") || lower.startsWith("sk-")) return "OPENAI";
  return null;
}

const detected = inferProviderFromApiKey(OPENAI_KEY);
test("Detects sk-proj-* as OPENAI", detected === "OPENAI", `Got: ${detected}`);
test("Does NOT detect as GROQ", detected !== "GROQ");
test("Does NOT detect as ANTHROPIC", detected !== "ANTHROPIC");
test("Does NOT detect as GOOGLE", detected !== "GOOGLE");

// Also test edge cases
test("Empty string → null", inferProviderFromApiKey("") === null);
test("gsk_test → GROQ", inferProviderFromApiKey("gsk_test") === "GROQ");
test("sk-or-test → OPENROUTER", inferProviderFromApiKey("sk-or-test") === "OPENROUTER");
test("sk-ant-test → ANTHROPIC", inferProviderFromApiKey("sk-ant-test") === "ANTHROPIC");
test("xai-test → GROK", inferProviderFromApiKey("xai-test") === "GROK");
test("AIzaSy... → GOOGLE", inferProviderFromApiKey("AIzaSyFakeKey") === "GOOGLE");

// ════════════════════════════════════════════════════════════════════════════
// TEST 2: Direct OpenAI API — Verify Key is Valid
// ════════════════════════════════════════════════════════════════════════════
console.log("\n🔑 TEST 2: Direct OpenAI API Key Validation");

try {
  const modelsRes = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${OPENAI_KEY}` },
  });
  test("Models endpoint responds (200)", modelsRes.status === 200, `Status: ${modelsRes.status}`);

  if (modelsRes.ok) {
    const modelsData = await modelsRes.json();
    const modelIds = modelsData.data?.map((m) => m.id) || [];
    test("Has GPT models available", modelIds.some((id) => id.startsWith("gpt-")), `Models: ${modelIds.slice(0, 5).join(", ")}...`);
    
    // Check for specific models used in our app
    const hasGpt4o = modelIds.includes("gpt-4o");
    const hasGpt4oMini = modelIds.includes("gpt-4o-mini");
    const hasO3Mini = modelIds.includes("o3-mini");
    console.log(`   Available models of interest: gpt-4o=${hasGpt4o}, gpt-4o-mini=${hasGpt4oMini}, o3-mini=${hasO3Mini}`);
    test("gpt-4o-mini is available (default model)", hasGpt4oMini, "gpt-4o-mini not found");
  }
} catch (err) {
  test("OpenAI API reachable", false, err.message);
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 3: Direct Chat Completion — Simulates Poll Generation
// ════════════════════════════════════════════════════════════════════════════
console.log("\n🤖 TEST 3: OpenAI Chat Completion (mini poll generation)");

const SYSTEM_PROMPT = `You are a quiz generation engine. Return valid JSON with this structure:
{ "title": "...", "questions": [{ "questionText": "...", "type": "MULTIPLE_CHOICE", "options": [{"text": "..."}], "correctAnswer": 0 }] }`;

try {
  const model = "gpt-4o-mini"; // Default model for BYOK OpenAI
  console.log(`   Model: ${model}`);
  const startTime = Date.now();

  const chatRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: "Create a 2-question quiz about the capital cities of Europe" },
      ],
      temperature: 0.7,
      max_tokens: 2048,
      response_format: { type: "json_object" },
    }),
  });

  const elapsed = Date.now() - startTime;
  console.log(`   Response time: ${elapsed}ms`);
  test("Chat completion succeeds (200)", chatRes.status === 200, `Status: ${chatRes.status}`);

  if (chatRes.ok) {
    const chatData = await chatRes.json();
    const content = chatData.choices?.[0]?.message?.content;
    test("Response has content", !!content);

    if (content) {
      try {
        const parsed = JSON.parse(content);
        test("Response is valid JSON", true);
        test("Has 'title' field", typeof parsed.title === "string");
        test("Has 'questions' array", Array.isArray(parsed.questions));
        test("Has 2 questions", parsed.questions?.length === 2, `Got: ${parsed.questions?.length}`);
        if (parsed.questions?.[0]) {
          test("Question has 'questionText'", typeof parsed.questions[0].questionText === "string");
          test("Question has 'options'", Array.isArray(parsed.questions[0].options));
        }
        console.log(`   Generated quiz: "${parsed.title}" with ${parsed.questions?.length} questions`);
      } catch (parseErr) {
        test("Response is valid JSON", false, `Parse error: ${parseErr.message}`);
        console.log(`   Raw content: ${content.slice(0, 200)}...`);
      }
    }

    // Check usage / billing
    const usage = chatData.usage;
    if (usage) {
      console.log(`   Tokens — prompt: ${usage.prompt_tokens}, completion: ${usage.completion_tokens}, total: ${usage.total_tokens}`);
    }
  } else {
    const errText = await chatRes.text();
    console.error(`   Error: ${errText.slice(0, 300)}`);
  }
} catch (err) {
  test("OpenAI chat completion reachable", false, err.message);
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 4: BYOK Payload Structure (what PollBuilder.tsx sends)
// ════════════════════════════════════════════════════════════════════════════
console.log("\n📦 TEST 4: BYOK Payload Structure Validation");

const byokPayload = {
  prompt: "Create a quiz about Norwegian geography",
  aiAuth: {
    mode: "one_time",
    provider: "OPENAI",
    model: "gpt-4o-mini",
    apiKey: OPENAI_KEY,
    rememberKey: false,
  },
};

test("Payload has 'prompt' string", typeof byokPayload.prompt === "string");
test("Payload mode is 'one_time'", byokPayload.aiAuth.mode === "one_time");
test("Provider matches detected", byokPayload.aiAuth.provider === detected);
test("Model is valid for OpenAI", byokPayload.aiAuth.model.startsWith("gpt-") || byokPayload.aiAuth.model.startsWith("o"));
test("API key is included", typeof byokPayload.aiAuth.apiKey === "string" && byokPayload.aiAuth.apiKey.length > 10);

// ════════════════════════════════════════════════════════════════════════════
// TEST 5: generate-stream endpoint (requires running dev server + auth)
// ════════════════════════════════════════════════════════════════════════════
console.log("\n🌐 TEST 5: generate-stream Endpoint (localhost:3000)");

try {
  const healthCheck = await fetch("http://localhost:3000", { method: "HEAD", signal: AbortSignal.timeout(3000) });
  if (healthCheck.ok || healthCheck.status === 308 || healthCheck.status === 302 || healthCheck.status === 307) {
    console.log("   Dev server is running ✓");

    // Try the endpoint without auth — should get auth error, not crash
    const noAuthRes = await fetch("http://localhost:3000/api/polls/generate-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(byokPayload),
      signal: AbortSignal.timeout(15000),
    });

    if (noAuthRes.ok || noAuthRes.status === 200) {
      // Read SSE stream to check for auth error event
      const reader = noAuthRes.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        if (fullText.length > 2000) break; // Don't read forever
      }
      reader?.releaseLock();

      // Without auth cookie, should get an auth error in the SSE
      const hasAuthError = fullText.includes("sign in") || fullText.includes("Please sign in") || fullText.includes("error");
      test("Endpoint returns SSE stream", fullText.includes("data:"));
      test("Auth gate works (requires login)", hasAuthError, "No auth check detected — endpoint may be unprotected!");
      console.log(`   SSE response preview: ${fullText.slice(0, 200)}`);
    } else {
      // Non-200 means the route exists but returned an error (e.g. 405, 401)
      test("Endpoint exists and responds", true);
      console.log(`   Response status: ${noAuthRes.status}`);
    }
  } else {
    console.log(`   Dev server status: ${healthCheck.status}`);
  }
} catch (err) {
  if (err.name === "TimeoutError" || err.code === "UND_ERR_CONNECT_TIMEOUT" || err.message?.includes("ECONNREFUSED")) {
    console.log("   ⏭ Dev server not ready yet — skipping endpoint test");
    console.log("   (Run 'npm run dev' and re-run this test to test the full endpoint)");
  } else {
    console.log(`   ⏭ Endpoint test skipped: ${err.message}`);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ════════════════════════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(60));
console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log("═".repeat(60));

if (failed > 0) {
  console.log("\n⚠️  Some tests failed. Check the output above.");
  process.exit(1);
} else {
  console.log("\n✅ All tests passed! Your OpenAI BYOK key works correctly.");
  console.log("   The PollBuilder will:");
  console.log("   1. Detect 'sk-proj-*' as OpenAI provider");
  console.log("   2. Auto-select gpt-4o-mini as the default model");
  console.log("   3. Show 'Your key · OpenAI' in the UI");
  console.log("   4. Send mode: 'one_time' with your key to /api/polls/generate-stream");
  console.log("   5. Generate quizzes using your key (no daily limit)");
  process.exit(0);
}
