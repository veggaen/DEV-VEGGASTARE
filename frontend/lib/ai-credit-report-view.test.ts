import { describe, expect, it } from 'vitest';
import { creditReportFailure, parseCreditReport } from './ai-credit-report-view';

const report = () => ({
  environment: 'LIVE', generatedAt: '2026-09-25T12:00:00Z',
  accounts: { total: 1, available: 0, refundAdjustment: 0, recent: [{ userId: 'buyer', name: null, available: 0, refundAdjustment: 0, updatedAt: '2026-09-25T12:00:00Z' }] },
  usage: { completed: 9, chargedCredits: 96, pending: 0, reservedCredits: 0, refundedRequests: 0, costCeilingMicroUsd: 970000 },
  payments: { captures: 2, currencies: [{ currency: 'NOK', captures: 2, grossMinor: 3800, refundedMinor: 0 }] },
  platformToday: { day: '2026-09-25', reservedMicroUsd: 850000, limitMicroUsd: 5000000, requests: 2, requestLimit: 500 },
});
describe('private credit report display contract', () => {
  it.each(['LIVE', 'SANDBOX', 'DEMO'])('accepts the complete %s scope without changing ledger figures', environment => {
    const body = { ...report(), environment }; expect(parseCreditReport(body, environment)).toEqual(body);
  });
  it('accepts the deployment default only when no filter is requested', () => {
    expect(parseCreditReport(report(), null).environment).toBe('LIVE');
    expect(() => parseCreditReport(report(), '')).toThrow();
  });
  it.each(['SANDBOX', 'DEMO', 'ALL'])('rejects a Live response for requested %s', environment => {
    expect(() => parseCreditReport(report(), environment)).toThrow();
  });
  it.each([null, {}, [], '<html>error</html>'])('rejects missing reports rather than inventing zeros', body => {
    expect(() => parseCreditReport(body, null)).toThrow();
  });
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '0'])('rejects invalid financial values %s', value => {
    const body = report(); Object.assign(body.payments.currencies[0], { grossMinor: value }); expect(() => parseCreditReport(body, null)).toThrow();
  });
  it('rejects invalid timestamps before the formatter can crash', () => {
    expect(() => parseCreditReport({ ...report(), generatedAt: 'not-a-date' }, null)).toThrow();
  });
  it('bounds recent accounts and checks their required fields', () => {
    const body = report(); body.accounts.total = 51; body.accounts.recent = Array.from({length:51}, () => body.accounts.recent[0]);
    expect(() => parseCreditReport(body, null)).toThrow();
    expect(() => parseCreditReport({ ...report(), accounts: { ...report().accounts, recent: [{}] } }, null)).toThrow();
  });
  it('does not permit more displayed accounts than the reported total', () => {
    const body = report(); body.accounts.total = 0; expect(() => parseCreditReport(body, null)).toThrow();
  });
  it('strips unknown fields without displaying server error or credential text', () => {
    expect(parseCreditReport({ ...report(), secret: 'must-not-render' }, null)).not.toHaveProperty('secret');
  });
  it('gives bounded actionable errors without server response text', () => {
    expect(creditReportFailure(429)).toContain('Wait'); expect(creditReportFailure(400)).toContain('Choose');
    expect(creditReportFailure(500)).toBe(creditReportFailure(503));
  });
  it.each(['duplicate', 'wrong-count', 'over-refund', 'unsupported', 'legacy-shape'])('rejects invalid currency report: %s', kind => {
    const body = report();
    if (kind === 'duplicate') body.payments.currencies.push(body.payments.currencies[0]);
    if (kind === 'wrong-count') body.payments.captures++;
    if (kind === 'over-refund') body.payments.currencies[0].refundedMinor = 3801;
    if (kind === 'unsupported') body.payments.currencies[0].currency = 'JPY';
    if (kind === 'legacy-shape') Object.assign(body, { payments: { captures: 2, grossOre: 3800, refundedOre: 0 } });
    expect(() => parseCreditReport(body, null)).toThrow();
  });
});
