/** @fileOverview Warehouse read failures preserve only authorized, validated snapshots. @stability stable */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readWarehouseLocations, WarehouseReadError } from './warehouse-read';
const location={id:'warehouse-a',userId:null,companyId:null,postalCode:'0123',address:'',city:'',country:'NO',latitude:null,longitude:null,createdAt:'2026-09-24T00:00:00Z',updatedAt:'2026-09-24T00:00:00Z'};
afterEach(()=>vi.unstubAllGlobals());
describe('warehouse read policy',()=>{
  it.each([401,403,404])('discards saved rows on HTTP %s',async status=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{status})));
    await expect(readWarehouseLocations('/api/warehouses',false,new AbortController().signal)).rejects.toMatchObject({discardSaved:true});
  });
  it.each([429,500,503])('retains the last valid rows on temporary HTTP %s',async status=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{status})));
    await expect(readWarehouseLocations('/api/warehouses',false,new AbortController().signal)).rejects.toMatchObject({discardSaved:false});
  });
  it('passes cancellation and forbids the browser HTTP cache',async()=>{
    const fetcher=vi.fn().mockResolvedValue(Response.json([location])); vi.stubGlobal('fetch',fetcher);
    const signal=new AbortController().signal;
    expect(await readWarehouseLocations('/api/warehouses',false,signal)).toEqual([location]);
    expect(fetcher).toHaveBeenCalledWith('/api/warehouses',{signal,cache:'no-store'});
  });
  it('validates the detail envelope instead of trusting an arbitrary warehouse object',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({warehouse:location,products:[]})).mockResolvedValueOnce(Response.json({warehouse:{id:'broken'},products:[]})));
    expect(await readWarehouseLocations('/api/warehouses/warehouse-a',true,new AbortController().signal)).toEqual([location]);
    await expect(readWarehouseLocations('/api/warehouses/broken',true,new AbortController().signal)).rejects.not.toBeInstanceOf(WarehouseReadError);
  });
});
