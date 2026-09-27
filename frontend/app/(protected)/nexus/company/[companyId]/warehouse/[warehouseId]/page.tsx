'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import ProgressBar from '@/components/bars/progress-bar';
import Link from 'next/link';
import Image from 'next/image';

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
    const [query, setQuery] = useState('');

    const inventory = warehouse?.inventory ?? [];

    const totals = useMemo(() => {
        const skuCount = inventory.length;
        const initialTotal = inventory.reduce((acc, item) => acc + (item.quantity ?? 0), 0);
        const currentTotal = inventory.reduce((acc, item) => acc + (item.stock ?? 0), 0);
        const ratio = initialTotal > 0 ? currentTotal / initialTotal : 0;
        return { skuCount, initialTotal, currentTotal, ratio };
    }, [inventory]);

    const filteredInventory = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return inventory;
        return inventory.filter((item) => {
            const title = item.product?.title?.toLowerCase() ?? '';
            const category = item.product?.category?.toLowerCase() ?? '';
            return title.includes(q) || category.includes(q);
        });
    }, [inventory, query]);

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


    const fmtNumber = (n: number) => new Intl.NumberFormat(undefined).format(n);
    const fmtPercent = (n: number) => `${Math.round(n * 100)}%`;

    return (
        <div className="min-h-screen w-full bg-background">
            <div className="mx-auto w-full max-w-screen-2xl px-4 py-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <Link
                                href={`/nexus/company/${companyId}`}
                                className="text-sm font-medium text-foreground hover:underline"
                            >
                                Back
                            </Link>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-sm text-muted-foreground">Warehouse</span>
                        </div>
                        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                            {warehouse.address}
                        </h1>
                        <p className="mt-1 text-sm text-foreground/80">
                            {warehouse.postalCode}, {warehouse.city}, {warehouse.country}
                        </p>
                    </div>
                    <Link
                        href={`/nexus/company/${companyId}/warehouse/${warehouseId}/orders`}
                        className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-500 transition-colors"
                    >
                        📦 Ordrekø
                    </Link>

                    <div className="w-full md:max-w-sm">
                        <label className="block text-xs font-medium text-foreground/80">Search inventory</label>
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search by title or category…"
                            className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none transition-[border-radius,box-shadow] focus:ring-2 focus:ring-brand-accent/30 dark:bg-muted/40 hover:rounded-2xl"
                        />
                    </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
                    <div className="rounded-lg border border-border bg-surface-1/50 p-4 transition-[border-radius,box-shadow] duration-200 hover:shadow-md hover:rounded-2xl dark:bg-muted/40">
                        <p className="text-xs font-medium text-foreground/80">SKUs</p>
                        <p className="mt-1 text-2xl font-semibold text-foreground">{fmtNumber(totals.skuCount)}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-surface-1/50 p-4 transition-[border-radius,box-shadow] duration-200 hover:shadow-md hover:rounded-2xl dark:bg-muted/40">
                        <p className="text-xs font-medium text-foreground/80">Initial Qty</p>
                        <p className="mt-1 text-2xl font-semibold text-foreground">{fmtNumber(totals.initialTotal)}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-surface-1/50 p-4 transition-[border-radius,box-shadow] duration-200 hover:shadow-md hover:rounded-2xl dark:bg-muted/40">
                        <p className="text-xs font-medium text-foreground/80">Current Stock</p>
                        <p className="mt-1 text-2xl font-semibold text-foreground">{fmtNumber(totals.currentTotal)}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-surface-1/50 p-4 transition-[border-radius,box-shadow] duration-200 hover:shadow-md hover:rounded-2xl dark:bg-muted/40">
                        <p className="text-xs font-medium text-foreground/80">Stock Ratio</p>
                        <p className="mt-1 text-2xl font-semibold text-foreground">{fmtPercent(totals.ratio)}</p>
                    </div>
                </div>

                <div className="mt-6 overflow-hidden rounded-lg border border-border bg-surface-1/50 dark:bg-muted/40">
                    <div className="flex items-center justify-between px-4 py-3">
                        <p className="text-sm font-semibold text-foreground">Inventory</p>
                        <p className="text-sm text-foreground/80">
                            Showing {fmtNumber(filteredInventory.length)} of {fmtNumber(warehouse.inventory.length)}
                        </p>
                    </div>
                    <div className="divide-y divide-border/50">
                        {filteredInventory.map((item: InventoryItem) => (
                            <div
                                key={item.id}
                                className="group grid grid-cols-1 gap-3 px-4 py-4 transition-[background-color] hover:bg-surface-1/60 md:grid-cols-[56px_1fr_220px] md:items-center"
                            >
                                <div className="relative h-14 w-14 overflow-hidden rounded-md border border-border bg-muted/40">
                                    <Image
                                        src={item.product?.image?.[0] || '/users/avatar.webp'}
                                        alt={item.product?.title || 'Product'}
                                        fill
                                        className="object-cover"
                                    />
                                </div>

                                <div className="min-w-0">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-foreground">
                                                {item.product?.title}
                                            </p>
                                            <p className="mt-0.5 text-xs text-foreground/80">
                                                {item.product?.category || 'Uncategorized'}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-foreground/80">Initial</p>
                                            <p className="text-sm font-semibold text-foreground">{fmtNumber(item.quantity)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-foreground/80">Current</p>
                                            <p className="text-sm font-semibold text-foreground">{fmtNumber(item.stock)}</p>
                                        </div>
                                    </div>
                                    <div className="mt-3">
                                        <ProgressBar value={item.stock} max={item.quantity} />
                                    </div>
                                </div>

                                <div className="flex items-center justify-end">
                                    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs font-medium text-foreground transition-[border-radius,background-color] group-hover:bg-muted group-hover:rounded-2xl dark:group-hover:bg-muted/40">
                                        {item.quantity > 0 ? fmtPercent(item.stock / item.quantity) : '—'}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {filteredInventory.length === 0 ? (
                            <div className="px-4 py-10 text-center text-sm text-foreground/80">
                                No inventory items match your search.
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WarehouseInventory;