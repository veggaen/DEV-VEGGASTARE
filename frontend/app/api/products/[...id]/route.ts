// frontend/app/api/products/[...id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { dbPrisma } from '../../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  console.log('frontend/app/app/products/[...id].ts', req)
  switch (req.method) {
    case 'GET':
      try {
        const products = await dbPrisma.product.findMany();
        res.status(200).json(products);
      } catch (error) {
        console.error('Failed to fetch products:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
      }
      break;
    default:
      res.setHeader('Allow', ['GET']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}