'use client';
/** @fileOverview Shared responsive warehouse list/detail with protected, explicit stock actions. @stability experimental */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Package, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useWarehouseRead } from '@/hooks/useWarehouseRead';
import usePusher from '@/hooks/usePusher';
import { updateWarehouseInventory } from '@/actions/updateWarehouse';

export default function WarehouseWorkspace({ warehouseId }: { warehouseId?: string }) {
  const user = useCurrentUser();
  const detail = Boolean(warehouseId);
  const endpoint = warehouseId ? `/api/warehouses/${encodeURIComponent(warehouseId)}?id=${encodeURIComponent(warehouseId)}` : '/api/warehouses';
  const resource = useWarehouseRead(endpoint, detail, user?.id ? `${user.id}:${user.role}` : null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const writeLock = useRef(false);
  const canReadStock = user?.role === 'ADMIN' || user?.role === 'OWNER';
  const activeWarehouse = warehouseId ?? expanded;
  usePusher(canReadStock && activeWarehouse ? `WarehouseChannel_${activeWarehouse}` : '', 'my-event-warehouse', resource.refresh);
  useEffect(() => {
    if (resource.data && !resource.loading && !resource.error) { setBlocked(false); setActionError(null); }
  }, [resource.data, resource.loading, resource.error]);

  async function adjustStock(locationId: string, inventoryId: string, action: 'add' | 'subtract') {
    if (writeLock.current || blocked || resource.loading || resource.error) return;
    writeLock.current = true; setPending(true); setActionError(null);
    try {
      const response = await updateWarehouseInventory(locationId, inventoryId, action);
      if (response.status !== 200) throw new Error('Unconfirmed stock adjustment');
      resource.refresh();
    } catch {
      setBlocked(true); setActionError('The stock update was not confirmed. Refresh the stock before trying again.');
    } finally { writeLock.current = false; setPending(false); }
  }

  return <section aria-labelledby="warehouse-title" className="mx-auto w-full min-w-0 max-w-7xl space-y-6 px-4 py-8 text-foreground sm:px-6 lg:px-8">
    <header className="space-y-4">
      {detail && <Link href="/warehouses" className="inline-flex min-h-11 items-center underline underline-offset-4 focus-visible:outline focus-visible:outline-2">Back to warehouses</Link>}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Experimental · logistics workspace</p><h1 id="warehouse-title" className="mt-2 text-balance text-2xl font-semibold tracking-tight sm:text-3xl">{detail ? 'Warehouse Details' : 'Warehouse Overview'}</h1><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{detail ? 'Location details and authorized inventory. Refresh before making a stock adjustment.' : 'Browse warehouse locations. Stock is shown only to authorized warehouse administrators.'}</p></div>
        <Button variant="outline" className="min-h-11 shrink-0 gap-2" disabled={resource.loading || pending} onClick={resource.refresh}><RefreshCw aria-hidden="true" className={`size-4 ${resource.loading ? 'motion-safe:animate-spin' : ''}`} />Refresh Now</Button>
      </div>
    </header>
    {resource.error && <div role="alert" className="space-y-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm leading-6"><p>{resource.error}</p>{Boolean(resource.data?.length) && <p>Previously loaded locations remain below and may be out of date.</p>}<Link href={`/auth/login?callbackUrl=${encodeURIComponent(warehouseId ? `/warehouses/${warehouseId}` : '/warehouses')}`} className="inline-flex min-h-11 items-center underline underline-offset-4">Sign in</Link></div>}
    {actionError && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm leading-6">{actionError}</p>}
    {resource.loading && !resource.data && <div role="status" aria-label={detail ? 'Loading warehouse' : 'Loading warehouses'} className="space-y-4">{[0,1].slice(0,detail?1:2).map(index=><div key={index} className="min-h-44 space-y-4 rounded-xl border border-border bg-card p-5"><div className="h-6 w-2/3 rounded bg-muted motion-safe:animate-pulse"/><div className="h-4 w-1/2 rounded bg-muted motion-safe:animate-pulse"/><div className="h-11 w-32 rounded bg-muted motion-safe:animate-pulse"/></div>)}</div>}
    {resource.loading && resource.data && <p role="status" className="sr-only">Refreshing saved locations…</p>}
    {!resource.error && resource.data?.length === 0 && <div className="rounded-xl border border-border bg-card p-6 text-center sm:p-10"><Package aria-hidden="true" className="mx-auto mb-4 size-8 text-muted-foreground"/><h2 className="text-lg font-semibold">No warehouses available.</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Locations will appear here when they are configured. Digital purchases do not require a shipping warehouse.</p><Button variant="outline" asChild className="mt-5 min-h-11"><Link href="/products">Browse products</Link></Button></div>}
    <div className="space-y-4">{resource.data?.map(location => {
      const showInventory = canReadStock && (detail || expanded === location.id);
      const title = [location.address,location.city,location.country].filter(Boolean).join(', ');
      return <article key={location.id} className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-6">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 basis-56"><h2 className="break-words text-lg font-semibold [overflow-wrap:anywhere]">{title}</h2><p className="mt-2 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">Postal code: {location.postalCode}</p>{(!location.address || !location.city) && <p className="mt-2 text-sm text-muted-foreground">Address incomplete · not ready for shipping</p>}{detail && !canReadStock && <p className="mt-3 text-sm leading-6 text-muted-foreground">Inventory is visible to authorized warehouse administrators. You can browse basic location details in this account.</p>}</div>
          <div className="flex max-w-full flex-wrap gap-2">{!detail && <Button variant="outline" asChild className="min-h-11"><Link href={`/warehouses/${location.id}`} aria-label={`View details for ${title}`}>View Details</Link></Button>}{canReadStock && !detail && <Button variant="outline" className="min-h-11" aria-controls={`stock-${location.id}`} aria-expanded={showInventory} onClick={()=>setExpanded(showInventory?null:location.id)}>{showInventory?'Hide inventory':'Show inventory'}</Button>}</div>
        </div>
        {showInventory && <section id={`stock-${location.id}`} aria-label={`Inventory for ${title}`} className="mt-5 border-t border-border pt-5"><h3 className="font-semibold">Inventory</h3>{!location.inventory?.length ? <p className="mt-3 text-sm text-muted-foreground">No stock records for this location.</p> : <ul className="mt-2 divide-y divide-border">{location.inventory.map(item=><li key={item.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0 flex-1 basis-48"><p className="break-words font-medium [overflow-wrap:anywhere]">{item.product.title}</p><p className="mt-1 text-sm tabular-nums text-muted-foreground">Stock: {item.stock.toLocaleString()}</p></div>{user?.role==='ADMIN' && <div className="flex gap-2"><Button variant="outline" className="size-11" disabled={pending||blocked||resource.loading||Boolean(resource.error)} aria-label={`Increase stock for ${item.product.title}`} onClick={()=>void adjustStock(location.id,item.id,'add')}>+</Button><Button variant="outline" className="size-11" disabled={pending||blocked||resource.loading||Boolean(resource.error)||item.stock<=0} aria-label={`Decrease stock for ${item.product.title}`} onClick={()=>void adjustStock(location.id,item.id,'subtract')}>−</Button></div>}</li>)}</ul>}</section>}
      </article>;
    })}</div>
  </section>;
}
