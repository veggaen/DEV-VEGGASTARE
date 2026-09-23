/** @fileOverview Public warehouse notifications must not disclose inventory. @stability stable */
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ trigger: vi.fn() }));
vi.mock('@/lib/pusher', () => ({ pusherServer: { trigger: mocks.trigger } }));
import { publishWarehouseInvalidation } from './warehouse-events';

beforeEach(() => vi.clearAllMocks());
it('publishes only an invalidation marker, not a warehouse or stock DTO', async () => {
  await publishWarehouseInvalidation('fixture');
  expect(mocks.trigger).toHaveBeenCalledExactlyOnceWith('WarehouseChannel_fixture', 'my-event-warehouse', {
    type: 'INVENTORY_INVALIDATED',
  });
});
it('surfaces delivery failure for the mutation caller to handle', async () => {
  mocks.trigger.mockRejectedValueOnce(new Error('Provider unavailable'));
  await expect(publishWarehouseInvalidation('fixture')).rejects.toThrow('Provider unavailable');
});
