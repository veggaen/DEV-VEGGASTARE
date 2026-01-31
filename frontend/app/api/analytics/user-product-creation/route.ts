import { dbPrisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { UserProductCreationAnalyticsResponseSchema } from '@/lib/types/analytics';

export async function GET(request: Request) {
  try {
    // Fetch all products from the database
    const products = await dbPrisma.product.findMany({
      select: {
        id: true,
        userId: true,
        companyId: true,
      },
    });

    // Check if products exist
    if (products.length === 0) {
      return NextResponse.json({ data: [], error: 'No products found' });
    }

    // Separate products into two categories
    const userProducts = products.filter((product) => !product.companyId); // Direct user products
    const companyProducts = products.filter((product) => product.companyId); // Company products

    // Count unique users for both categories
    const uniqueUserProductCount = new Set(userProducts.map((product) => product.userId)).size;
    const uniqueCompanyUserProductCount = new Set(companyProducts.map((product) => product.userId)).size;

    // Debug: Check total counts
    console.log('Total Products:', products.length);
    console.log('User Direct Products:', userProducts.length);
    console.log('Company Products:', companyProducts.length);

    // Prepare data for chart
    const chartData = [
      { label: 'Users ( Products )', count: userProducts.length }, // Count of user-created products
      { label: 'Company ( Products )', count: companyProducts.length }, // Count of company-created products
    ];

    // Send response
    const dto = { data: chartData };
    const parsed = UserProductCreationAnalyticsResponseSchema.safeParse(dto);
    if (!parsed.success) {
      console.error('Invalid analytics/user-product-creation DTO:', parsed.error.issues);
      return NextResponse.json(
        {
          error: 'Invalid response shape',
          issues: process.env.NODE_ENV === 'development' ? parsed.error.issues : undefined,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data);
  } catch (error) {
    console.error('Error fetching user product creation data:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}