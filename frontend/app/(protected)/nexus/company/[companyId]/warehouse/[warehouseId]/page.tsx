'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ProgressBar from '@/components/bars/progress-bar';

export interface Product {
    id: string;
    title: string;
    description: string;
    category: string;
    price: number;
    stock: number;
    shipFromPostalId: string;
    image: string[];
    specifications?: Record<string, any>;
    userId: string;
    companyId?: string;
    createdAt: string;
    updatedAt: string;
}

export interface InventoryItem {
    id: string;
    quantity: number;
    stock: number;
    warehouseId: string;
    productId: string;
    product: Product;
    createdAt: string;
    updatedAt: string;
}

export interface Warehouse {
    id: string;
    companyId: string;
    postalCode: string;
    address: string;
    city: string;
    country: string;
    latitude?: number;
    longitude?: number;
    inventory: InventoryItem[];
    createdAt: string;
    updatedAt: string;
}


const WarehouseInventory = () => {
    const params = useParams();
    const { companyId, warehouseId } = params as { companyId: string; warehouseId: string };

    const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchWarehouseDetails = async () => {
            try {
                const response = await fetch(`/api/companies/${companyId}/warehouses/${warehouseId}`);
                if (!response.ok) {
                    throw new Error(`Failed to fetch warehouse details: ${response.statusText}`);
                }
                const data: Warehouse = await response.json();
                setWarehouse(data);
            } catch (error: any) {
                setError(error.message);
            } finally {
                setLoading(false);
            }
        };

        if (companyId && warehouseId) {
            fetchWarehouseDetails();
        }
    }, [companyId, warehouseId]);

    if (loading) return <div>Loading...</div>;
    if (error) return <div>{error}</div>;
    if (!warehouse) return <div>Warehouse not found.</div>;

    return (
        <div className="p-6 min-h-screen">
            <h1 className="text-2xl font-bold mb-4">{warehouse.address} | Inventory</h1>
            <ul className="space-y-4">
                {warehouse.inventory.map((item: InventoryItem) => (
                    <li key={item.id} className="bg-black/20 p-4 rounded-lg shadow-md">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="text-xl font-semibold">{item.product.title}</h2>
                            <div className="text-right px-2">
                                <p className="text-gray-400">Initial Quantity: {item.quantity}</p>
                                <p className="text-gray-400">Current Stock: {item.stock}</p>
                            </div>
                        </div>
                        <ProgressBar value={item.stock} max={item.quantity} />
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default WarehouseInventory;