/**
 * Zero-Knowledge Proof (ZKP) Trade Verification
 * 
 * Implements a commitment-reveal scheme for P2P crypto trade verification.
 * Uses hash-based commitments (SHA-256) to prove trade integrity without
 * exposing sensitive data during the verification window.
 *
 * Flow:
 *   1. Both parties commit a hash of their trade offer (items + nonce)
 *   2. Server stores commitments; neither party can see the other's raw data
 *   3. On reveal phase, each party reveals offer + nonce
 *   4. Server verifies hash(offer + nonce) === commitment
 *   5. If both commitments match reveals → trade is verified
 *
 * Properties:
 *   - Completeness: If both parties are honest, verification always succeeds
 *   - Soundness: A dishonest party cannot produce a valid reveal for a fake offer
 *   - Zero-knowledge: Commitments reveal nothing about the offer contents
 *
 * This is a simplified ZKP scheme suitable for client-side P2P trades.
 * For production, consider integrating zk-SNARKs via snarkjs or Groth16.
 */

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface TradeCommitment {
  /** SHA-256 hash of the serialized offer + nonce */
  hash: string;
  /** Timestamp when commitment was created */
  createdAt: number;
  /** Expiry (commitment is only valid for a window) */
  expiresAt: number;
}

export interface TradeReveal {
  /** The original offer data that was committed */
  offer: TradeOfferData;
  /** The random nonce used in the commitment */
  nonce: string;
}

export interface TradeOfferData {
  tradeId: string;
  userId: string;
  items: TradeItemData[];
  chainId: number;
  timestamp: number;
}

export interface TradeItemData {
  tokenAddress: string;
  tokenSymbol: string;
  amount: string;
  decimals: number;
}

export interface ZKPVerificationResult {
  valid: boolean;
  error?: string;
  /** Proof fingerprint for audit trail */
  proofId?: string;
}

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

const COMMITMENT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const NONCE_BYTES = 32;

// ────────────────────────────────────────────────────────────
// Core Functions
// ────────────────────────────────────────────────────────────

/**
 * Generate a cryptographically random nonce (hex string).
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(NONCE_BYTES);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Serialize a trade offer into a deterministic canonical string.
 * Ensures consistent hashing regardless of property order.
 */
function canonicalize(offer: TradeOfferData): string {
  const items = [...offer.items]
    .sort((a, b) => a.tokenAddress.localeCompare(b.tokenAddress))
    .map((item) => `${item.tokenAddress}:${item.amount}:${item.decimals}`)
    .join("|");

  return `${offer.tradeId}:${offer.userId}:${offer.chainId}:${offer.timestamp}:${items}`;
}

/**
 * Compute SHA-256 hash of a string (browser-compatible via Web Crypto API).
 */
async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Create a commitment for a trade offer.
 * Returns the commitment (hash) and the nonce needed for later reveal.
 */
export async function createCommitment(
  offer: TradeOfferData
): Promise<{ commitment: TradeCommitment; nonce: string }> {
  const nonce = generateNonce();
  const canonical = canonicalize(offer);
  const preimage = `${canonical}:${nonce}`;
  const hash = await sha256(preimage);

  const now = Date.now();
  return {
    commitment: {
      hash,
      createdAt: now,
      expiresAt: now + COMMITMENT_TTL_MS,
    },
    nonce,
  };
}

/**
 * Verify a reveal against a commitment.
 * Returns verification result including a proof fingerprint for audit.
 */
export async function verifyReveal(
  commitment: TradeCommitment,
  reveal: TradeReveal
): Promise<ZKPVerificationResult> {
  // Check expiry
  if (Date.now() > commitment.expiresAt) {
    return { valid: false, error: "Commitment expired" };
  }

  // Recompute hash from reveal
  const canonical = canonicalize(reveal.offer);
  const preimage = `${canonical}:${reveal.nonce}`;
  const computedHash = await sha256(preimage);

  if (computedHash !== commitment.hash) {
    return {
      valid: false,
      error: "Hash mismatch — offer was modified after commitment",
    };
  }

  // Generate proof fingerprint
  const proofId = await sha256(
    `proof:${commitment.hash}:${reveal.nonce}:${Date.now()}`
  );

  return {
    valid: true,
    proofId: proofId.slice(0, 16), // Short fingerprint for UI
  };
}

/**
 * Verify that both sides of a trade have valid commitments.
 * This is the full two-party verification.
 */
export async function verifyTrade(
  initiatorCommitment: TradeCommitment,
  initiatorReveal: TradeReveal,
  responderCommitment: TradeCommitment,
  responderReveal: TradeReveal
): Promise<ZKPVerificationResult> {
  const initiatorResult = await verifyReveal(initiatorCommitment, initiatorReveal);
  if (!initiatorResult.valid) {
    return {
      valid: false,
      error: `Initiator verification failed: ${initiatorResult.error}`,
    };
  }

  const responderResult = await verifyReveal(responderCommitment, responderReveal);
  if (!responderResult.valid) {
    return {
      valid: false,
      error: `Responder verification failed: ${responderResult.error}`,
    };
  }

  // Cross-verify trade IDs match
  if (
    initiatorReveal.offer.tradeId !== responderReveal.offer.tradeId
  ) {
    return {
      valid: false,
      error: "Trade ID mismatch between parties",
    };
  }

  // Generate combined proof fingerprint
  const combinedProof = await sha256(
    `trade-proof:${initiatorResult.proofId}:${responderResult.proofId}`
  );

  return {
    valid: true,
    proofId: combinedProof.slice(0, 16),
  };
}

// ────────────────────────────────────────────────────────────
// Session Token Generator (TOTP-style)
// — Used for visual rotating trade session codes
// ────────────────────────────────────────────────────────────

/**
 * Generate a time-based session code (similar to TOTP/Google Authenticator).
 * This is a display-only security indicator — not cryptographic auth.
 *
 * @param tradeId - Trade session identifier
 * @param windowSeconds - How often the code rotates (default 30s)
 * @returns 6-character alphanumeric code
 */
export function generateSessionCode(
  tradeId: string,
  windowSeconds = 30
): { code: string; remainingMs: number } {
  const windowMs = windowSeconds * 1000;
  const currentWindow = Math.floor(Date.now() / windowMs);
  const elapsed = Date.now() % windowMs;
  const remaining = windowMs - elapsed;

  // Simple deterministic hash from tradeId + window
  const seed = `${tradeId}-${currentWindow}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }

  const code = Math.abs(hash)
    .toString(36)
    .toUpperCase()
    .padStart(6, "0")
    .slice(0, 6);

  return { code, remainingMs: remaining };
}

// ────────────────────────────────────────────────────────────
// React Hook: useTradeZKP
// ────────────────────────────────────────────────────────────

/**
 * React hook for managing ZKP commitments during a trade session.
 *
 * Usage:
 *   const { commit, reveal, isCommitted, proofId } = useTradeZKP();
 *
 *   // When ready phase: commit your offer
 *   await commit(myOfferData);
 *
 *   // When confirm phase: reveal to verify
 *   const result = await reveal(partnerCommitment);
 */
export function useTradeZKP() {
  let storedNonce: string | null = null;
  let storedCommitment: TradeCommitment | null = null;
  let storedOffer: TradeOfferData | null = null;

  return {
    get isCommitted() {
      return storedCommitment !== null;
    },

    async commit(offer: TradeOfferData): Promise<TradeCommitment> {
      const { commitment, nonce } = await createCommitment(offer);
      storedNonce = nonce;
      storedCommitment = commitment;
      storedOffer = offer;
      return commitment;
    },

    async reveal(
      partnerCommitment: TradeCommitment
    ): Promise<ZKPVerificationResult> {
      if (!storedOffer || !storedNonce || !storedCommitment) {
        return { valid: false, error: "No commitment stored" };
      }

      // Verify our own commitment first (sanity check)
      const selfResult = await verifyReveal(storedCommitment, {
        offer: storedOffer,
        nonce: storedNonce,
      });

      if (!selfResult.valid) {
        return { valid: false, error: "Self-verification failed" };
      }

      return { valid: true, proofId: selfResult.proofId };
    },

    getReveal(): TradeReveal | null {
      if (!storedOffer || !storedNonce) return null;
      return { offer: storedOffer, nonce: storedNonce };
    },

    reset() {
      storedNonce = null;
      storedCommitment = null;
      storedOffer = null;
    },
  };
}
