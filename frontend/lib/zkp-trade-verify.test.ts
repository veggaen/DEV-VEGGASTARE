import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  createCommitment,
  verifyReveal,
  verifyTrade,
  generateSessionCode,
  type TradeOfferData,
} from './zkp-trade-verify';

const baseOffer = (overrides: Partial<TradeOfferData> = {}): TradeOfferData => ({
  tradeId: 'trade_1',
  userId: 'user_1',
  chainId: 1,
  timestamp: 1736000000000,
  items: [
    { tokenAddress: '0xabc', tokenSymbol: 'ETH', amount: '1000000000000000000', decimals: 18 },
  ],
  ...overrides,
});

afterEach(() => {
  vi.useRealTimers();
});

describe('zkp-trade-verify', () => {
  it('creates and verifies a valid commitment/reveal pair', async () => {
    const offer = baseOffer();
    const { commitment, nonce } = await createCommitment(offer);

    const result = await verifyReveal(commitment, { offer, nonce });

    expect(result.valid).toBe(true);
    expect(result.proofId).toBeTypeOf('string');
    expect(result.proofId?.length).toBeGreaterThan(0);
  });

  it('rejects reveal if offer is tampered after commitment', async () => {
    const offer = baseOffer();
    const { commitment, nonce } = await createCommitment(offer);

    const tamperedOffer = baseOffer({
      items: [{ tokenAddress: '0xabc', tokenSymbol: 'ETH', amount: '2000000000000000000', decimals: 18 }],
    });

    const result = await verifyReveal(commitment, { offer: tamperedOffer, nonce });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Hash mismatch');
  });

  it('rejects two-party verification when trade IDs mismatch', async () => {
    const initiatorOffer = baseOffer({ tradeId: 'trade_a', userId: 'user_a' });
    const responderOffer = baseOffer({ tradeId: 'trade_b', userId: 'user_b' });

    const initiatorCommit = await createCommitment(initiatorOffer);
    const responderCommit = await createCommitment(responderOffer);

    const result = await verifyTrade(
      initiatorCommit.commitment,
      { offer: initiatorOffer, nonce: initiatorCommit.nonce },
      responderCommit.commitment,
      { offer: responderOffer, nonce: responderCommit.nonce },
    );

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Trade ID mismatch');
  });

  it('generates a stable 6-char session code inside the same time window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-25T12:00:00.000Z'));

    const first = generateSessionCode('trade_session_1', 30);
    vi.setSystemTime(new Date('2026-02-25T12:00:10.000Z'));
    const second = generateSessionCode('trade_session_1', 30);

    expect(first.code).toHaveLength(6);
    expect(second.code).toHaveLength(6);
    expect(first.code).toBe(second.code);
    expect(second.remainingMs).toBeLessThan(first.remainingMs);
  });
});
