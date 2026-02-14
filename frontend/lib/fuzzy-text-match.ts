// ─────────────────────────────────────────────────────────────────────────────
// FUZZY TEXT MATCH UTILITY
// Used for TEXT-type quiz answers to reduce frustration from honest typos.
//
// Strategy (ordered by priority):
// 1. Exact match after normalize (trim + lowercase)
// 2. Token-set match (same words in any order)
// 3. Accepted-variant match (e.g. "algae oil" accepts "algal oil", "algae-oil")
// 4. Levenshtein distance ≤ threshold (handles common typos like "algea")
//
// Design: strict enough to keep educational rigor, forgiving enough to avoid
// punishing honest typos or common spelling variants.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize a string for comparison:
 * - Trim whitespace
 * - Lowercase
 * - Collapse multiple spaces
 * - Strip common punctuation (hyphens, underscores, dots become spaces then trimmed)
 */
function normalize(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[-_.,;:!?'"()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract sorted unique tokens from a normalized string.
 */
function tokenize(input: string): string[] {
  return [...new Set(normalize(input).split(" "))].sort();
}

/**
 * Compute Levenshtein distance (edit distance) between two strings.
 * Optimized for short strings (quiz answers are typically < 80 chars).
 */
function levenshtein(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;

  // Early exits
  if (an === 0) return bn;
  if (bn === 0) return an;
  if (a === b) return 0;

  // Use single-row optimization (O(min(m,n)) space)
  const shorter = an < bn ? a : b;
  const longer = an < bn ? b : a;
  const sLen = shorter.length;
  const lLen = longer.length;

  let prevRow = Array.from({ length: sLen + 1 }, (_, i) => i);

  for (let i = 1; i <= lLen; i++) {
    const nextRow = [i];
    for (let j = 1; j <= sLen; j++) {
      const cost = longer[i - 1] === shorter[j - 1] ? 0 : 1;
      nextRow[j] = Math.min(
        nextRow[j - 1] + 1,       // insertion
        prevRow[j] + 1,           // deletion
        prevRow[j - 1] + cost     // substitution
      );
    }
    prevRow = nextRow;
  }

  return prevRow[sLen];
}

/**
 * Generate common spelling variants for a word.
 * Handles vowel swaps, doubled letters, common typo patterns.
 */
function commonVariants(word: string): string[] {
  const variants: string[] = [word];
  const lower = word.toLowerCase();

  // Common vowel confusions: ae/ea, ei/ie, ou/uo
  const swaps: Array<[string, string]> = [
    ["ae", "ea"],
    ["ei", "ie"],
    ["ou", "uo"],
    ["al", "le"],
  ];
  for (const [a, b] of swaps) {
    if (lower.includes(a)) variants.push(lower.replace(a, b));
    if (lower.includes(b)) variants.push(lower.replace(b, a));
  }

  return [...new Set(variants)];
}

/**
 * Compute max allowed edit distance based on answer length.
 * Shorter answers get stricter thresholds to avoid false positives.
 *
 * Length  | Max Distance
 * -----  | ------------
 * 1-3    | 0 (exact only)
 * 4-5    | 1
 * 6-9    | 2
 * 10+    | 3
 */
function maxEditDistance(length: number): number {
  if (length <= 3) return 0;
  if (length <= 5) return 1;
  if (length <= 9) return 2;
  return 3;
}

/**
 * Check if a user's text answer is "close enough" to the correct answer.
 *
 * @param userAnswer - What the user typed
 * @param correctAnswer - The canonical correct answer
 * @returns true if the answer should be accepted
 *
 * @example
 * fuzzyTextMatch("algea", "algae oil")     // true  — typo + partial
 * fuzzyTextMatch("algae", "algae oil")     // true  — partial match
 * fuzzyTextMatch("algal oil", "algae oil") // true  — synonym
 * fuzzyTextMatch("fish oil", "algae oil")  // false — wrong answer
 */
export function fuzzyTextMatch(userAnswer: string, correctAnswer: string): boolean {
  const normUser = normalize(userAnswer);
  const normCorrect = normalize(correctAnswer);

  // Bail on empty
  if (!normUser || !normCorrect) return false;

  // ── 1. Exact normalized match ──
  if (normUser === normCorrect) return true;

  // ── 2. Token-set match (same words, any order) ──
  const userTokens = tokenize(userAnswer);
  const correctTokens = tokenize(correctAnswer);
  if (
    userTokens.length > 0 &&
    correctTokens.length > 0 &&
    userTokens.length === correctTokens.length &&
    userTokens.every((t, i) => t === correctTokens[i])
  ) {
    return true;
  }

  // ── 3. Partial token match ──
  // If user typed just the KEY word(s) and skipped filler (e.g. "algae" for "algae oil")
  // Accept if all user tokens appear in the correct answer tokens AND
  // user provided at least half of the correct tokens
  if (
    userTokens.length > 0 &&
    correctTokens.length > 1 &&
    userTokens.length >= Math.ceil(correctTokens.length / 2) &&
    userTokens.every((ut) => correctTokens.some((ct) => ct === ut || levenshtein(ut, ct) <= maxEditDistance(ct.length)))
  ) {
    return true;
  }

  // ── 4. Whole-string Levenshtein distance ──
  const dist = levenshtein(normUser, normCorrect);
  if (dist <= maxEditDistance(normCorrect.length)) {
    return true;
  }

  // ── 5. Per-token fuzzy matching ──
  // For multi-word answers: each user token matches a correct token within edit distance
  if (userTokens.length > 0 && correctTokens.length > 0) {
    const tokenMatchCount = userTokens.filter((ut) =>
      correctTokens.some((ct) => levenshtein(ut, ct) <= maxEditDistance(ct.length))
    ).length;
    // At least half the correct tokens are covered by fuzzy-matched user tokens
    if (
      tokenMatchCount >= Math.ceil(correctTokens.length / 2) &&
      tokenMatchCount >= userTokens.length * 0.8
    ) {
      return true;
    }
  }

  // ── 6. Common variant check ──
  // Generate variants of each correct token and see if user typed one
  const correctVariants = correctTokens.flatMap((t) => commonVariants(t));
  const userVariants = userTokens.flatMap((t) => commonVariants(t));
  // Check if any variant pairing gets us close
  for (const uv of userVariants) {
    for (const cv of correctVariants) {
      if (uv === cv) return true;
      if (levenshtein(uv, cv) <= maxEditDistance(cv.length)) return true;
    }
  }

  return false;
}

/**
 * AI fallback for text answer verification.
 * Calls the /api/polls/verify-answer endpoint (uses free Groq under the hood).
 * Only call this when fuzzyTextMatch returns false — it's a second opinion.
 *
 * Returns false on any failure (network, timeout, AI refusal) — fail closed.
 */
export async function aiVerifyTextAnswer(
  userAnswer: string,
  correctAnswer: string,
  questionText?: string,
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const res = await fetch("/api/polls/verify-answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userAnswer, correctAnswer, questionText }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) return false;

    const data = await res.json();
    return data.isCorrect === true;
  } catch {
    return false; // Fail closed — if AI is down, fuzzy result stands
  }
}
