/** @fileOverview Product action authorization regressions. @stability active */
import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ auth: vi.fn(), product: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
  employee: { findFirst: vi.fn(), findUnique: vi.fn() }, user: { findUnique: vi.fn() }, company: { findUnique: vi.fn() },
  rate: vi.fn(), refresh: vi.fn(), query: vi.fn(), headers: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/auth', () => ({ auth: m.auth }));
vi.mock('next/headers', () => ({ headers: m.headers }));
vi.mock('next/cache', () => ({ revalidatePath: m.refresh }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: m.rate }));
vi.mock('@/lib/db', () => {
  const tx = { product: m.product, employee: m.employee, user: m.user, company: m.company, $queryRaw: m.query };
  return { dbPrisma: { ...tx, $transaction: async (work: (client: typeof tx) => unknown) => work(tx) } };
});
import { MyUpdateProductAction, MySetProductVisibilityAction, MyDeleteProductAction } from './products';
import { GET as readRepo, POST as saveRepo } from '@/app/api/products/[productId]/repo-access/route';
import { NextRequest } from 'next/server';
const internalSpec = { key: '__repo_access', value: JSON.stringify({ owner: 'qa', repo: 'private', mode: 'COLLABORATOR', permission: 'pull', notes: 'Private fixture note' }) };
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ user: { id: 'author', role: 'USER', sessionVersion: 0 } });
  m.user.findUnique.mockResolvedValue({ id: 'author', role: 'USER', tokenVersion: 0 });
  m.headers.mockResolvedValue(new Headers({ origin: 'http://localhost:3000', host: 'localhost:3000' }));
  m.rate.mockResolvedValue({ success: true });
  m.company.findUnique.mockResolvedValue({ ownerId: 'company-owner' });
  m.product.findUnique.mockResolvedValue({ id: 'product', title: 'Company file', userId: 'author', companyId: 'company', Company: { ownerId: 'company-owner' } });
  m.employee.findFirst.mockResolvedValue(null); m.employee.findUnique.mockResolvedValue(null);
  m.product.update.mockResolvedValue({ id: 'product', title: 'Company file' });
  m.product.findUniqueOrThrow.mockResolvedValue({ specifications: [internalSpec, { key: 'Format', value: 'PNG' }] });
});
it.each(['edit', 'hide', 'archive'] as const)('removed company author cannot %s their old company listing', async operation => {
  const result = operation === 'edit' ? await MyUpdateProductAction('product', { title: 'Hijacked' }) :
    operation === 'hide' ? await MySetProductVisibilityAction('product', 'HIDDEN') : await MyDeleteProductAction('product');
  expect(result).toHaveProperty('error'); expect(m.product.update).not.toHaveBeenCalled();
});
it('edit permission does not authorize archival', async () => {
  m.auth.mockResolvedValue({ user: { id: 'editor', role: 'USER', sessionVersion: 0 } });
  m.user.findUnique.mockResolvedValue({ id: 'editor', role: 'USER', tokenVersion: 0 });
  const employee = { permissions: { CAN_EDIT_PRODUCT_POSITION_PERMISSION: true } };
  m.employee.findFirst.mockResolvedValue(employee); m.employee.findUnique.mockResolvedValue(employee);
  expect(await MyDeleteProductAction('product')).toHaveProperty('error'); expect(m.product.update).not.toHaveBeenCalled();
});
it('a stale platform admin session cannot grant product management', async () => {
  m.auth.mockResolvedValue({ user: { id: 'former-admin', role: 'ADMIN', sessionVersion: 0 } });
  m.user.findUnique.mockResolvedValue({ id: 'former-admin', role: 'USER', tokenVersion: 0 });
  expect(await MyDeleteProductAction('product')).toHaveProperty('error'); expect(m.product.update).not.toHaveBeenCalled();
});
it.each([null, { id: 'demo_qa', sessionVersion: 0 }, { id: 'author', isDemo: true, sessionVersion: 0 },
  { id: 'author', sessionVersion: 0, impersonatingFromId: 'owner' }, { id: 'author' }])('denies missing, demo, impersonated or unversioned session %j', async user => {
  m.auth.mockResolvedValue({ user }); expect(await MyDeleteProductAction('product')).toHaveProperty('error'); expect(m.product.update).not.toHaveBeenCalled();
});
it('denies revoked tokens, foreign origins and rate limits', async () => {
  m.user.findUnique.mockResolvedValue({ id: 'author', role: 'OWNER', tokenVersion: 1 });
  expect(await MyDeleteProductAction('product')).toHaveProperty('error');
  m.headers.mockResolvedValue(new Headers({ origin: 'https://foreign.invalid', host: 'localhost:3000' }));
  expect(await MyDeleteProductAction('product')).toHaveProperty('error');
  m.headers.mockResolvedValue(new Headers({ origin: 'http://localhost:3000', host: 'localhost:3000' }));
  m.rate.mockResolvedValue({ success: false });
  expect(await MyDeleteProductAction('product')).toHaveProperty('error'); expect(m.product.update).not.toHaveBeenCalled();
});
it.each(['owner', 'editor', 'visibility', 'archive', 'personal'] as const)('permits only the actor’s operation: %s', async kind => {
  m.company.findUnique.mockResolvedValue({ ownerId: kind === 'owner' ? 'author' : 'company-owner' });
  m.employee.findUnique.mockResolvedValue({ permissions: {
    CAN_EDIT_PRODUCT_POSITION_PERMISSION: kind === 'editor', CAN_MANAGE_PRODUCT_VISIBILITY: kind === 'visibility', CAN_DELETE_PRODUCT: kind === 'archive',
  } });
  if (kind === 'personal') m.product.findUnique.mockResolvedValue({ id: 'product', userId: 'author', companyId: null, title: 'Personal file' });
  const results = [await MyUpdateProductAction('product', { title: 'Updated' }), await MySetProductVisibilityAction('product', 'HIDDEN'), await MyDeleteProductAction('product')];
  expect(results.map(result => !!result.success)).toEqual(kind === 'owner' || kind === 'personal' ? [true, true, true] : [kind === 'editor', kind === 'visibility', kind === 'archive']);
  for (const [query] of m.product.update.mock.calls) expect(query.data).not.toHaveProperty('downloadsEnabled');
});
it('returns success after committed save even if cache refresh fails', async () => {
  m.company.findUnique.mockResolvedValue({ ownerId: 'author' });
  m.refresh.mockImplementation(() => { throw new Error('cache unavailable'); });
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  try { expect(await MyDeleteProductAction('product')).toHaveProperty('success'); } finally { error.mockRestore(); }
});
it.each([{ price: -1 }, { price: Infinity }, { image: [] }, { image: ['javascript:alert(1)'] }, { userId: 'outsider' }, { specifications: [internalSpec] }])('rejects invalid update %j', async patch => {
  expect(await MyUpdateProductAction('product', patch as never)).toHaveProperty('error'); expect(m.product.update).not.toHaveBeenCalled();
});
it('ordinary product edits preserve private delivery settings', async () => {
  m.company.findUnique.mockResolvedValue({ ownerId: 'author' });
  expect(await MyUpdateProductAction('product', { specifications: [{ key: 'Format', value: 'JPG' }] })).toHaveProperty('success');
  expect(JSON.parse(m.product.update.mock.calls[0][0].data.specifications)).toEqual([{ key: 'Format', value: 'JPG' }, internalSpec]);
});
it.each(['removed', 'editor', 'owner'] as const)('repository settings require current seller ownership: %s', async role => {
  m.company.findUnique.mockResolvedValue({ ownerId: role === 'owner' ? 'author' : 'company-owner' });
  m.employee.findUnique.mockResolvedValue(role === 'editor' ? { permissions: { CAN_EDIT_PRODUCT_POSITION_PERMISSION: true } } : null);
  const context = { params: Promise.resolve({ productId: 'product' }) };
  const request = new NextRequest('http://localhost:3000/api/products/product/repo-access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: false }) });
  const read = await readRepo(request, context), write = await saveRepo(request, context);
  expect(read.status).toBe(role === 'owner' ? 200 : 403); expect(write.status).toBe(role === 'owner' ? 200 : 403);
  expect(read.headers.get('cache-control')).toBe('private, no-store');
  if (role !== 'owner') expect(m.product.update).not.toHaveBeenCalled();
  else expect(m.product.update.mock.calls[0][0].data.specifications).toEqual([{ key: 'Format', value: 'PNG' }]);
});
