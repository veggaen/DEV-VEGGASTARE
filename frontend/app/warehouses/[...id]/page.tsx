import { notFound } from 'next/navigation';
import WarehouseWorkspace from '@/components/uicustom/warehouse-workspace';
export default async function WarehouseDetailsPage({ params }: { params: Promise<{ id: string[] }> }) {
  const { id } = await params;
  if (id.length !== 1) notFound();
  return <WarehouseWorkspace warehouseId={id[0]} />;
}
