import { NextApiRequest, NextApiResponse } from 'next';
import { dbPrisma } from '@/lib/db';

export async function GET(req: Request, res: Response) {
  try {
    const warehouses = await dbPrisma.warehouseLocation.findMany({
      include: {
        inventory: {
          include: {
            product: true,
          },
        },
      },
    });
    return new Response(JSON.stringify(warehouses), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch warehouses' }), { status: 500 });
  }
}