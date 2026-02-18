'use server';

import * as z from 'zod';
import { auth } from '@/auth';
import { dbPrisma } from '@/lib/db';
import { companyCreationSchema } from '@/schemas';
import { EmployeeRole, Prisma, Product } from '@/generated/prisma/client';
import { lookupNorwegianOrganization, normalizeNorwegianOrgNumber } from '@/lib/norway-org';
import { sendCompanyOrgVerificationEmail } from '@/lib/mail';

type GetCompanyResult = Product[];
type CreateCompanyResult = { error: string } | { success: string; companyId: string };

const MyGetCompanyAction = async (): Promise<GetCompanyResult> => {
  const response = await dbPrisma.product.findMany();
  return response;
};

const MyCreateCompanyAction = async (values: z.infer<typeof companyCreationSchema>): Promise<CreateCompanyResult> => {
  // --- AUTH CHECK (CRITICAL) ---
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Unauthorized — you must be logged in to create a company.' };
  }
  const sessionUserId = session.user.id;

  console.log('MyCreateCompanyAction() Creating company with values:', values);
  
  const validateFields = companyCreationSchema.safeParse(values);
  console.log('Validating fields:', validateFields);

  if (!validateFields.success) {
    console.error('Validation failed', validateFields.error.format());
    const errorMessage = validateFields.error.issues.map(issue => `${issue.path.join('.')} - ${issue.message}`).join('; ');
    return { error: `Validation error: ${errorMessage}` };
  }

  const {
    name,
    description,
    websiteUrl,
    logo,
    bannerImage,
    colorScheme,
    orgType,
    orgNumber,
    employmentNoticeDays,
    creatorId,
    ownerId,
    employees,
    usesShipping,
    warehouseLocations,
  } = validateFields.data;

  const normalizedOrgNumber = normalizeNorwegianOrgNumber(orgNumber);
  const wantsOrgVerification = /^\d{9}$/.test(normalizedOrgNumber);

  // Override client-supplied IDs with verified session user
  // (prevents IDOR — callers cannot create companies owned by another user)
  if (creatorId !== sessionUserId || ownerId !== sessionUserId) {
    console.warn(`[create-company] ID mismatch: client sent creator=${creatorId}, owner=${ownerId}, session is ${sessionUserId}. Overriding.`);
  }
  const safeCreatorId = sessionUserId;
  const safeOwnerId = sessionUserId;

  try {
    const orgLookup = wantsOrgVerification
      ? await lookupNorwegianOrganization(normalizedOrgNumber)
      : null;

    const userExists = await dbPrisma.user.findUnique({
      where: { id: safeCreatorId },
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
          // Org metadata only gets linked after official email confirmation.
          orgType: null,
          orgNumber: null,
          employmentNoticeDays,
          creatorId: safeCreatorId,
          ownerId: safeOwnerId,
          usesShipping,
        },
      });

      // If org lookup found a valid legal entity with an official email,
      // create pending verification record and wait for email confirmation.
      if (
        orgLookup?.found &&
        orgLookup.orgNumber &&
        orgLookup.officialEmail
      ) {
        await dbPrisma.companyOrgVerification.create({
          data: {
            companyId: company.id,
            orgNumber: orgLookup.orgNumber,
            orgType: orgLookup.suggestedOrgType ?? orgType ?? null,
            legalName: orgLookup.legalName ?? null,
            officialEmail: orgLookup.officialEmail ?? null,
            officialWebsite: orgLookup.websiteUrl ?? null,
            officialAddress: orgLookup.address?.address ?? null,
            status: 'PENDING',
            token: crypto.randomUUID(),
            expires: new Date(Date.now() + 48 * 60 * 60 * 1000),
          },
        });
      }

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

    if (orgLookup?.found && orgLookup.officialEmail) {
      const pending = await dbPrisma.companyOrgVerification.findUnique({
        where: { companyId: createdCompany.id },
      });

      if (pending?.token) {
        try {
          await sendCompanyOrgVerificationEmail(orgLookup.officialEmail, {
            companyName: createdCompany.name,
            orgNumber: pending.orgNumber,
            legalName: pending.legalName,
            token: pending.token,
            expiresHours: 48,
          });
        } catch (mailErr) {
          console.error('[create-company] failed to send org verification email', mailErr);
        }
      }
    }

    return {
      success:
        orgLookup?.found && orgLookup.officialEmail
          ? 'Company created. Organization link is pending email confirmation.'
          : 'Company created successfully!',
      companyId: createdCompany.id,
    };
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