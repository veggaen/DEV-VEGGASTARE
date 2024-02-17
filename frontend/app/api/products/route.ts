
// pages/api/products/products.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { dbPrisma } from '../../../lib/db'; // Adjust the import path as needed

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const products = await dbPrisma.product.findMany(); // Adjust 'product' to match your Prisma model name
      res.status(200).json(products);
    } catch (error) {
      console.error('Failed to fetch products:', error);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}