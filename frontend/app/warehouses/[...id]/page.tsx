'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

const WarehouseInventory = () => {
    const router = useRouter();
    const { companyId, warehouseId } = router.query;

    const [warehouse, setWarehouse] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchWarehouseDetails = async () => {
            try {
                const response = await fetch(`/api/companies/warehouses/${companyId}/${warehouseId}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch warehouse details');
                }
                const data = await response.json();
                setWarehouse(data);
            } catch (error) {
                console.error('Error fetching warehouse details:', error);
            } finally {
                setLoading(false);
            }
        };

        if (companyId && warehouseId) {
            fetchWarehouseDetails();
        }
    }, [companyId, warehouseId]);

    if (loading) return <div>Loading...</div>;
    if (!warehouse) return <div>Warehouse not found.</div>;

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">{warehouse.title} Inventory</h1>
            <ul>
                {warehouse.inventory.map(item => (
                    <li key={item.id} className="mb-2">
                        <p>Product: {item.product.title}</p>
                        <p>Initial Quantity: {item.quantity}</p>
                        <p>Current Stock: {item.stock}</p>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default WarehouseInventory;