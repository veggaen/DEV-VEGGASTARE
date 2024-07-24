'use client'

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Product {
  id: string;
  title: string;
  stock: number;
}

interface Inventory {
  product: Product;
  quantity: number;
}

interface Warehouse {
  id: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  inventory: Inventory[];
}

const WarehouseOverview = () => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const response = await fetch('/api/warehouses');
        const data = await response.json();
        setWarehouses(data);
      } catch (error) {
        console.error('Failed to fetch warehouses:', error);
      }
    };
    fetchWarehouses();
  }, []);

  return (
    <div>
      <h1>Warehouse Overview</h1>
      {warehouses.map((warehouse) => (
        <div key={warehouse.id}>
          <h2>{warehouse.address}, {warehouse.city}, {warehouse.country}</h2>
          <ul>
            {warehouse.inventory.map((item) => (
              <li key={item.product.id}>
                {item.product.title} - Quantity: {item.quantity}
              </li>
            ))}
          </ul>
          <Link href={`/warehouses/${warehouse.id}`}>
            <div>View Details</div>
          </Link>
        </div>
      ))}
    </div>
  );
};

export default WarehouseOverview;