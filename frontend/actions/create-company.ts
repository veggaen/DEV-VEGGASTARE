'use server';
import * as z from 'zod'

import { dbPrisma } from '@/lib/db';
import { companyCreationSchema } from '@/schemas';
import { EmployeeRole, Prisma, PrismaClient } from '@prisma/client';

interface EmployeeInput {
  userId: string;
  role: string;
  permissions?: any[]; // Define more specifically if possible
  // Include any other fields you want to pass when creating an employee
}

interface WarehouseLocationInput {
  address: string;
  postalCode: string;
  city: string;
  country: string;
  latitude?: number;
  longitude?: number;
  // Include any other fields you want to pass when creating a warehouse location
}

const MyGetCompanyAction = async () => {
  const response = await dbPrisma.product.findMany();
  const data = response;

  return data;
};

const MyCreateCompanyAction = async (values: z.infer<typeof companyCreationSchema>) => {
  const validateFields = companyCreationSchema.safeParse(values);

  if (!validateFields.success) {
    console.error('Validation failed', validateFields.error.format());
    const errorMessage = validateFields.error.issues.map(issue => `${issue.path.join('.')} - ${issue.message}`).join('; ');
    return { error: `Validation error: ${errorMessage}` };
  }

  const { name, description, websiteUrl, logo, bannerImage, colorScheme, creatorId, ownerId, employees, usesShipping, warehouseLocations } = validateFields.data;

  try {
    const userExists = await dbPrisma.user.findUnique({
        where: {
          id: creatorId, // or ownerId
        },
      });
      if (!userExists) {
        return { error: "Creator or owner does not exist." };
      }
    // Use Prisma's transaction to handle related operations atomically
    const createdCompany = await dbPrisma.$transaction(async (dbPrisma) => {
      // Create the company
      const company = await dbPrisma.company.create({
        data: {
          name,
          description,
          websiteUrl,
          logo,
          bannerImage,
          colorScheme,
          creatorId,
          ownerId,
          usesShipping,
        },
      });
      const typedEmployees: EmployeeInput[] = employees && employees.map(emp => ({
        ...emp,
        companyId: company.id,
        permissions: emp.permissions || [], // Default to an empty array if permissions are not specified
      })) || [];
    
      const typedWarehouseLocations: WarehouseLocationInput[] = warehouseLocations && warehouseLocations.map(loc => ({
        ...loc,
        companyId: company.id,
        // Assume all required fields are provided, so no need for defaults here
      })) || [];
      // If there are employees to be added
    if (employees && typedEmployees.length > 0) {
        await dbPrisma.employee.createMany({
            data: typedEmployees.map(emp => ({
                ...emp,
                companyId: company.id,
                permissions: emp.permissions || [],
                role: emp.role as EmployeeRole, // Add explicit type assertion for the role property
            })),
        });
    }

      // If there are warehouse locations to be added and shipping is used
      if (usesShipping && warehouseLocations && typedWarehouseLocations.length > 0) {
        await dbPrisma.warehouseLocation.createMany({
          data: typedWarehouseLocations.map(loc => ({
            ...loc,
            companyId: company.id,
          })),
        });
      }
      console.log('Created company:', company)
      return company;
    });

    // Return success response with created company's ID
    return { success: 'Company created successfully!', companyId: createdCompany.id };
  } catch (error) {
    // Log the error and provide a meaningful error message
    console.error('Error creating company:', error);
    let message = 'Failed to create the company. Please try again.';
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle specific Prisma errors here if needed
      message += ` Error Code: ${error.code}`;
    }
    return { error: message };
  }
};
    
export { MyGetCompanyAction, MyCreateCompanyAction };