/** @fileOverview Warehouse read DTO regression for legacy incomplete addresses. @stability stable */
import { describe, expect, it } from 'vitest';
import { WarehousesListResponseSchema } from './warehouses';

const location = { id: 'warehouse-fixture', userId: null, companyId: null,
  postalCode: '0001', address: '', city: '', country: 'NO', latitude: null,
  longitude: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };

describe('warehouse read contract', () => {
  it('renders legacy incomplete addresses without turning the whole list into 500', () => {
    expect(WarehousesListResponseSchema.parse([location])[0].address).toBe('');
  });
  it('retains strict types and rejects undeclared inventory fields', () => {
    expect(WarehousesListResponseSchema.safeParse([{ ...location, city: 42 }]).success).toBe(false);
    expect(WarehousesListResponseSchema.safeParse([{ ...location, privateInventory: [] }]).success).toBe(false);
  });
});
