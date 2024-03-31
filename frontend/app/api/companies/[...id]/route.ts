import { dbPrisma } from '@/lib/db';
import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
    // Extract the company ID from the URL using Next.js's routing.
    const url = new URL(req.url);
    const paths = url.pathname.split('/');
    // The company ID should be the last part after splitting; adjust index accordingly if needed.
    const companyId = paths[paths.length - 1];

    console.log(`Fetching details for company ID: ${companyId}`);

    try {
        // Fetch the company details from the database using the extracted ID.
        const company = await dbPrisma.company.findUnique({
            where: { id: companyId },
            // You can include related models here if needed
            include: {
                creator: true, // Include creator details
                owner: true, 
                //employees: true,
                employees: {
                  include: {
                    user: true, // Include user information
                  },
                },
                warehouseLocations: true, // Make sure to include the related warehouse locations
            },
        });

        if (!company) {
            console.error(`Company not found with ID: ${companyId}`);
            return new Response(JSON.stringify({ error: 'Company not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        console.log(`Successfully found company: ${JSON.stringify(company.name)}`);
        return new Response(JSON.stringify(company), {
            status: 200, // Successfully found and returning the company data.
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error(`Failed to fetch details for company ID: ${companyId}`, error);
        return new Response(JSON.stringify({ error: 'Error fetching company details' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}