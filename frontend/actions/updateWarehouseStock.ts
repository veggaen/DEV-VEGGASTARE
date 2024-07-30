'use server'

import { dbPrisma } from '@/lib/db';
import { updateWarehouseInventory } from './updateWarehouse';
// frontend/src/actions/updateWarehouseStock.ts


export async function updateWarehouseStock(warehouseId: string, inventoryId: string, stock: number) {
  return await updateWarehouseInventory(warehouseId, inventoryId, stock);

}