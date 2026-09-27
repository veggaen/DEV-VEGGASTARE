import { describe, expect, it } from 'vitest';
import { verifyItemsAgainstTxs, verifyTransfersOnChain, type TxFacts } from './onchain-verify';

const A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const HEX = '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39';
const NATIVE = '0x0000000000000000000000000000000000000000';
const hash = (n: number) => `0x${n.toString(16).padStart(64, '0')}`;

const erc20Tx = (value: bigint, from = A, to = B, status: TxFacts['status'] = 'success'): TxFacts => ({
  hash: hash(1), status, from, to: HEX, value: BigInt(0), transfers: [{ token: HEX.toLowerCase(), from, to, value }],
});
const nativeTx = (value: bigint): TxFacts => ({ hash: hash(2), status: 'success', from: A, to: B, value, transfers: [] });

describe('verifyItemsAgainstTxs', () => {
  it('accepts exact ERC-20 and native coverage, summed across transactions', () => {
    const items = [{ tokenAddress: HEX, amount: '300', symbol: 'HEX' }, { tokenAddress: NATIVE, amount: '5', symbol: 'ETH' }];
    const r = verifyItemsAgainstTxs(items, A, B, [erc20Tx(BigInt(100)), erc20Tx(BigInt(200)), nativeTx(BigInt(5))]);
    expect(r).toEqual({ ok: true, problems: [] });
  });
  it('rejects short amounts, wrong direction, wrong recipient and reverted transactions', () => {
    const items = [{ tokenAddress: HEX, amount: '300', symbol: 'HEX' }];
    expect(verifyItemsAgainstTxs(items, A, B, [erc20Tx(BigInt(299))]).ok).toBe(false);
    expect(verifyItemsAgainstTxs(items, A, B, [erc20Tx(BigInt(300), B, A)]).ok).toBe(false);
    expect(verifyItemsAgainstTxs(items, A, B, [erc20Tx(BigInt(300), A, '0xcccccccccccccccccccccccccccccccccccccccc')]).ok).toBe(false);
    const reverted = verifyItemsAgainstTxs(items, A, B, [erc20Tx(BigInt(300), A, B, 'reverted')]);
    expect(reverted.ok).toBe(false);
    expect(reverted.problems[0]).toMatch(/reverted/);
  });
  it('is case-insensitive about addresses and needs nothing for an empty offer', () => {
    expect(verifyItemsAgainstTxs([{ tokenAddress: HEX.toLowerCase(), amount: '1' }], A.toUpperCase(), B, [erc20Tx(BigInt(1))]).ok).toBe(true);
    expect(verifyItemsAgainstTxs([], A, B, []).ok).toBe(true);
  });
});

describe('verifyTransfersOnChain', () => {
  it('reports unknown hashes and bad hash shapes without touching the chain for them', async () => {
    const lookup = async (_c: number, h: `0x${string}`) => (h === hash(1) ? erc20Tx(BigInt(300)) : null);
    const ok = await verifyTransfersOnChain({ chainId: 1, from: A, to: B, items: [{ tokenAddress: HEX, amount: '300' }], hashes: [hash(1)], lookup });
    expect(ok.ok).toBe(true);
    const pending = await verifyTransfersOnChain({ chainId: 1, from: A, to: B, items: [{ tokenAddress: HEX, amount: '300' }], hashes: [hash(9)], lookup });
    expect(pending.ok).toBe(false);
    expect(pending.problems.join(' ')).toMatch(/not confirmed/);
    const junk = await verifyTransfersOnChain({ chainId: 1, from: A, to: B, items: [], hashes: ['nope'], lookup });
    expect(junk.problems[0]).toMatch(/not a transaction hash/);
  });
});
