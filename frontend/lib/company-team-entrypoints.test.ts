import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({ viewer: undefined as { id: string } | undefined, origin: 'https://www.veggat.com', limited: false, db: { $transaction: vi.fn(), employee: { findFirst: vi.fn(), update: vi.fn() } } }));
vi.mock('@/lib/db', () => ({ dbPrisma: state.db }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: async () => state.viewer }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ origin: state.origin, host: 'www.veggat.com' }) }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: async () => ({ success: !state.limited }) }));
import { editCompanyEmployeePermissionAction } from '@/actions/edit-company-employee-permission';
import { editEmployeeRoleAction } from '@/actions/edit-employee-role';
import { POST as add } from '@/app/api/companies/employees/add/route';
import { PATCH as permissions } from '@/app/api/companies/employees/edit/route';
import { POST as role } from '@/app/api/companies/employees/edit-role/route';
import { DELETE as remove } from '@/app/api/companies/employees/remove/route';

beforeEach(() => { vi.clearAllMocks(); state.viewer = undefined; state.origin = 'https://www.veggat.com'; state.limited = false; });
it('never authorizes the permission action using the browser-supplied actor', async () => {
  state.db.employee.findFirst.mockResolvedValue({ permissions: { CAN_EDIT_PERMISSION: true } });
  await editCompanyEmployeePermissionAction({ clientUser: { id: 'owner' }, company: { id: 'company' }, selectedEmployee: { id: 'foreign-employee' }, permissions: { CAN_EDIT_PERMISSION: true } } as never);
  expect(state.db.employee.findFirst).not.toHaveBeenCalled();
  expect(state.db.employee.update).not.toHaveBeenCalled();
  expect(state.db.$transaction).not.toHaveBeenCalled();
});
for (const [label, setup, expected] of [
  ['anonymous', () => {}, 401],
  ['demo', () => { state.viewer = { id: 'demo_fixture' }; }, 403],
  ['foreign origin', () => { state.viewer = { id: 'owner' }; state.origin = 'https://attacker.test'; }, 403],
  ['missing origin', () => { state.viewer = { id: 'owner' }; state.origin = ''; }, 403],
  ['rate limited', () => { state.viewer = { id: 'owner' }; state.limited = true; }, 429],
  ['invalid payload', () => { state.viewer = { id: 'owner' }; }, 400],
] as const) {
  it(`all team entry points reject ${label} before database writes`, async () => {
    setup();
    expect(await editCompanyEmployeePermissionAction({})).toMatchObject({ success: false, status: expected });
    expect(await editEmployeeRoleAction({})).toMatchObject({ success: false, status: expected });
    for (const route of [add, permissions, role, remove]) {
      const response = await route(new Request('https://www.veggat.com/api/companies/employees/qa', { method: 'POST', body: '{}' }));
      expect(response.status).toBe(expected); expect(response.headers.get('cache-control')).toBe('private, no-store');
    }
    expect(state.db.$transaction).not.toHaveBeenCalled();
  });
}
