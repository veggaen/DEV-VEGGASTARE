import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { companyId: string } }) {
  try {
    const { companyId } = params;
    console.log('Fetching details for company ID:', companyId);

    if (!companyId) {
      console.error('Invalid request parameters:', { companyId });
      return NextResponse.json({ message: 'Invalid request parameters' }, { status: 400 });
    }

    const company = await dbPrisma.company.findUnique({
      where: { id: companyId },
      include: {
        creator: true,
        owner: true,
        employees: {
          include: {
            user: true,
          },
        },
        warehouseLocations: {
          include: {
            inventory: {
              include: {
                product: true,
              },
            },
          },
        },
        // ✅ NEW: include wallets so checkout can find a default receiver
        wallets: {
          orderBy: { isDefault: 'desc' },
        },
      },
    });

    if (!company) {
      console.error('Company not found for ID:', companyId);
      return NextResponse.json({ message: 'Company not found' }, { status: 404 });
    }

    console.log('Successfully found company:', company.name);
    return NextResponse.json(company, { status: 200 });
  } catch (error) {
    console.error('Error fetching company details:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
