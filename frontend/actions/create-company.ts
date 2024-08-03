'use server';

import * as z from 'zod';
import { dbPrisma } from '@/lib/db';
import { companyCreationSchema } from '@/schemas';
import { EmployeeRole, Prisma } from '@prisma/client';

const MyGetCompanyAction = async () => {
  const response = await dbPrisma.product.findMany();
  return response;
};

const MyCreateCompanyAction = async (values: z.infer<typeof companyCreationSchema>) => {
  console.log('MyCreateCompanyAction() Creating company with values:', values);
  
  const validateFields = companyCreationSchema.safeParse(values);
  console.log('Validating fields:', validateFields);

  if (!validateFields.success) {
    console.error('Validation failed', validateFields.error.format());
    const errorMessage = validateFields.error.issues.map(issue => `${issue.path.join('.')} - ${issue.message}`).join('; ');
    return { error: `Validation error: ${errorMessage}` };
  }

  const { name, description, websiteUrl, logo, bannerImage, colorScheme, creatorId, ownerId, employees, usesShipping, warehouseLocations } = validateFields.data;

  try {
    const userExists = await dbPrisma.user.findUnique({
      where: { id: creatorId },
    });
    
    if (!userExists) {
      return { error: "Creator or owner does not exist." };
    }

    const createdCompany = await dbPrisma.$transaction(async (dbPrisma) => {
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

      const typedEmployees = employees?.map(emp => ({
        ...emp,
        companyId: company.id,
        permissions: emp.permissions || {},
      })) || [];

      const typedWarehouseLocations = warehouseLocations?.map(loc => ({
        ...loc,
        companyId: company.id,
        postalCode: loc.postalCode || '', // Ensure postalCode is not undefined
        address: loc.address || '', // Ensure address is not undefined
        city: loc.city || '', // Ensure city is not undefined
        country: loc.country || '', // Ensure country is not undefined
        latitude: loc.latitude ?? 0, // Ensure latitude is not undefined, use nullish coalescing operator to check for null or undefined
        longitude: loc.longitude ?? 0, // Ensure longitude is not undefined, use nullish coalescing operator to check for null or undefined
      })) || [];

      if (employees && typedEmployees.length > 0) {
        await dbPrisma.employee.createMany({
          data: typedEmployees.map(emp => ({
            ...emp,
            companyId: company.id,
            permissions: emp.permissions || {},
            role: emp.role as EmployeeRole,
          })),
        });
      }

      if (usesShipping && warehouseLocations && typedWarehouseLocations.length > 0) {
        await dbPrisma.warehouseLocation.createMany({
          data: typedWarehouseLocations,
        });
      }

      console.log('Created company:', company.name);
      return company;
    });

    return { success: 'Company created successfully!', companyId: createdCompany.id };
  } catch (error) {
    console.error('Error creating company:', error);
    let message = 'Failed to create the company. Please try again.';
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      message += ` Error Code: ${error.code}`;
    }
    return { error: message };
  }
};

export { MyGetCompanyAction, MyCreateCompanyAction };