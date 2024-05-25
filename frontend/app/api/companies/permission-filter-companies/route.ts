import { dbPrisma } from '@/lib/db';
import type { NextApiRequest, NextApiResponse } from 'next';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest, res: NextResponse) {
    try {

      const data = await req.json();
      const { companyId, userId, permissionTag } = data;
      console.log('PERMFILTER', data)
      console.log('Fetching companies with permission for user ID:', userId, 'and permission tag:', permissionTag);
  
      if (!userId || !permissionTag) {
        //return res.status(400).json({ error: 'User ID and permission tag are required' });
        return new Response(JSON.stringify({ error: 'User ID and permission tag are required' }), {
          status: 400, // Bad Request
          headers: {
              'Content-Type': 'application/json',
          },
        });
      }
  
      // Fetch companies where the user has the specific permission
      const companiesWithPermission = await dbPrisma.company.findMany({
        where: {
          employees: {
            some: {
              userId: userId,
              permissions: {
                path: [permissionTag],
                equals: true,
              },
            },
          },
        },
        include: {
          employees: {
            where: {
              userId: userId,
              permissions: {
                path: [permissionTag],
                equals: true,
              },
            },
          },
        },
      });
  
      console.log('Companies with permission fetched:', companiesWithPermission);
      //res.status(200).json(companiesWithPermission);
      
      const response = JSON.stringify(companiesWithPermission)
        console.log('Companies with permission fetched:', response)
        return new Response(JSON.stringify(companiesWithPermission), {
            status: 200, // OK
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
      console.error('Error fetching companies with permission:', error);
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: {
            'Content-Type': 'application/json',
        },
      });
    }
  }