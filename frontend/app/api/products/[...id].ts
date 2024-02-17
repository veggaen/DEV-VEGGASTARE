// pages/api/products/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { dbPrisma } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const productId = req.query.id;

    switch (req.method) {
        case 'GET':
            const product = await dbPrisma.product.findUnique({
                where: { id: String(productId) },
            });
            res.json(product);
            break;
        case 'PUT':
            // Update logic here
            break;
        case 'DELETE':
            // Delete logic here
            break;
        default:
            res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
            res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}