import { dbPrisma } from '@/lib/db';
import type { NextApiRequest, NextApiResponse } from 'next';

export async function POST(req: NextApiRequest, res: NextApiResponse) {
    try {
      const { userId, permissionTag } = req.body;
  
      if (!userId || !permissionTag) {
        return res.status(400).json({ error: 'User ID and permission tag are required' });
      }
  
      // Adjust the query as needed based on your data model
      const companiesWithPermission = await dbPrisma.company.findMany({
        where: {
          employees: {
            some: {
              userId,
              permissions: {
                // Assuming permissions is stored in a format that allows this kind of query
                // This might need to be adjusted based on your actual database schema and how permissions are stored
                path: permissionTag,
                equals: true,
              },
            },
          },
        },
        include: {
          employees: {
            where: {
              userId,
              permissions: {
                // Adjust according to your schema
                path: permissionTag,
                equals: true,
              },
            },
          },
        },
      });
  
      console.log('Companies with permission fetched:', companiesWithPermission);
      res.status(200).json(companiesWithPermission);
    } catch (error) {
      console.error('Error fetching companies with permission:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }