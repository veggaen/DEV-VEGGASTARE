/** @fileOverview Inventory writes preserve location binding and nonnegative stock. @stability stable */
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ role: vi.fn(), read: vi.fn(), update: vi.fn(), event: vi.fn() }));
vi.mock('@/lib/user-auth', () => ({ MyLibRoleAuth: mocks.role }));
vi.mock('@/lib/warehouse-events', () => ({ publishWarehouseInvalidation: mocks.event }));
vi.mock('@/lib/db', () => ({ dbPrisma: { $transaction: (callback: (db: unknown) => unknown) => callback({ inventory: { findUnique: mocks.read, update: mocks.update } }) } }));
import { updateWarehouseInventory } from './updateWarehouse';
const row = { id: 'inventory-a', version: 2, stock: 0, warehouseId: 'warehouse-a' };
beforeEach(() => { vi.resetAllMocks(); mocks.role.mockResolvedValue('ADMIN'); mocks.read.mockResolvedValue(row); mocks.update.mockResolvedValue(row); });

describe('stock adjustment boundary', () => {
  it('does not subtract from zero stock', async () => {
    expect((await updateWarehouseInventory('warehouse-a', 'inventory-a', 'subtract')).status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.event).not.toHaveBeenCalled();
  });
  it('does not update a stock row from a different warehouse', async () => {
    expect((await updateWarehouseInventory('warehouse-b', 'inventory-a', 'add')).status).toBe(404);
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.event).not.toHaveBeenCalled();
  });
  it.each([null,'USER','OWNER'])('keeps stock mutations admin-only for role %s', async role => {
    mocks.role.mockResolvedValue(role);
    expect((await updateWarehouseInventory('warehouse-a','inventory-a','add')).status).toBe(403);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it('rejects runtime action tampering before a database read',async()=>{
    expect((await updateWarehouseInventory('warehouse-a','inventory-a','reset' as never)).status).toBe(400);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it('binds a successful increment to both the location and read version',async()=>{
    expect((await updateWarehouseInventory('warehouse-a','inventory-a','add')).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({where:{id_version:{id:'inventory-a',version:2},warehouseId:'warehouse-a'},data:{stock:1,version:3}});
    expect(mocks.event).toHaveBeenCalledExactlyOnceWith('warehouse-a');
  });
  it('rejects stock overflow and absent rows',async()=>{
    mocks.read.mockResolvedValueOnce({...row,stock:2_147_483_647});
    expect((await updateWarehouseInventory('warehouse-a','inventory-a','add')).status).toBe(409);
    mocks.read.mockResolvedValueOnce(null);
    expect((await updateWarehouseInventory('warehouse-a','inventory-a','add')).status).toBe(404);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each(['P2025','P2034'])('does not silently retry a concurrent adjustment (%s)',async code=>{
    mocks.update.mockRejectedValue({code});
    expect((await updateWarehouseInventory('warehouse-a','inventory-a','add')).status).toBe(409);
    expect(mocks.update).toHaveBeenCalledTimes(1); expect(mocks.event).not.toHaveBeenCalled();
  });
  it('does not report a saved stock adjustment as failed when notification delivery fails',async()=>{
    mocks.event.mockRejectedValue(new Error('Fixture notification failure'));
    expect((await updateWarehouseInventory('warehouse-a','inventory-a','add')).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });
});
