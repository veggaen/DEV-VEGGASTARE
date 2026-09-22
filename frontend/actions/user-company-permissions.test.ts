/** @fileOverview Employee permissions are private to the authenticated identity. @stability stable */
import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ auth: vi.fn(), employee: vi.fn() }));
vi.mock('@/auth', () => ({ auth: m.auth }));
vi.mock('@/lib/db', () => ({ dbPrisma: { employee: { findFirst: m.employee } } }));
import { fetchUserEmployeePermissions } from './user-company-permissions';

describe('employee permission reads', () => {
  beforeEach(() => { vi.resetAllMocks(); });
  it.each([null, { user: { id: 'another-user' } }, { user: { id: 'demo_visitor' } }])('rejects untrusted identity without querying employees', async session => {
    m.auth.mockResolvedValue(session);
    const id = session?.user.id === 'demo_visitor' ? 'demo_visitor' : 'claimed-user';
    expect(await fetchUserEmployeePermissions({ id }, 'company')).toHaveProperty('success', false);
    expect(m.employee).not.toHaveBeenCalled();
  });
  it('queries only the signed-in user', async () => {
    m.auth.mockResolvedValue({ user: { id: 'actual-user' } });
    m.employee.mockResolvedValue({ role: 'EMPLOYEE', permissions: { CAN_EDIT_PRODUCT_POSITION_PERMISSION: true } });
    expect(await fetchUserEmployeePermissions({ id: 'actual-user' }, 'company')).toHaveProperty('success', true);
    expect(m.employee).toHaveBeenCalledWith({ where: { userId: 'actual-user', companyId: 'company' } });
  });
});
