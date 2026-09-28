import { describe, expect, it } from 'vitest';
import { describeSendError, formatTokenAmount, looksLikeAddress, parseSendAmount, sameAddress } from './send-stacks';

describe('formatTokenAmount', () => {
  it('reads like a balance, not like a big integer', () => {
    expect(formatTokenAmount('1998999873999999853000', 18)).toBe('1,998.999873');
    expect(formatTokenAmount(BigInt('1000000000000000000'), 18)).toBe('1');
    expect(formatTokenAmount('1500000', 6)).toBe('1.5');
    expect(formatTokenAmount('1', 18)).toBe('0.000001');
    expect(formatTokenAmount('0', 18)).toBe('0');
    expect(formatTokenAmount('junk', 18)).toBe('0');
  });
});

describe('parseSendAmount', () => {
  const max = BigInt('1500000'); // 1.5 USDC (6 decimals)
  it('accepts a normal amount and a comma decimal', () => {
    expect(parseSendAmount('1.25', 6, max)).toBe(BigInt('1250000'));
    expect(parseSendAmount('1,5', 6, max)).toBe(BigInt('1500000'));
  });
  it('rejects empty, junk, zero and over-balance input', () => {
    expect(parseSendAmount('', 6, max)).toBeNull();
    expect(parseSendAmount('abc', 6, max)).toBeNull();
    expect(parseSendAmount('0', 6, max)).toBeNull();
    expect(parseSendAmount('1.500001', 6, max)).toBeNull();
    expect(parseSendAmount('1e5', 6, max)).toBeNull();
  });
});

describe('describeSendError', () => {
  it('turns wallet codes and RPC phrases into plain sentences', () => {
    expect(describeSendError({ code: 4001, message: 'User rejected the request.' })).toMatch(/cancelled/);
    expect(describeSendError(new Error('insufficient funds for gas * price + value'))).toMatch(/gas/);
    expect(describeSendError(new Error('execution reverted: ERC20: transfer amount exceeds balance'))).toMatch(/no longer holds/);
    expect(describeSendError({ cause: { code: -32002 }, message: 'x' })).toMatch(/already open/);
    expect(describeSendError({ shortMessage: 'Short one', message: 'Long one that goes on' })).toBe('Short one');
  });
});

describe('address helpers', () => {
  it('compares case-insensitively and validates shape', () => {
    expect(sameAddress('0xAbC', '0xabc')).toBe(true);
    expect(sameAddress(undefined, '0xabc')).toBe(false);
    expect(looksLikeAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(true);
    expect(looksLikeAddress('vitalik.eth')).toBe(false);
  });
});
