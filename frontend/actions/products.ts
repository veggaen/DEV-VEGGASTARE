'use server'

import { dbPrisma } from "@/lib/db";
import { MyProductCreateSchema } from "@/schemas";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export const MyCreateProductAction = async (data: z.infer<typeof MyProductCreateSchema>, postalCodes: string[]) => {
  try {
    console.log('Server is Creating a product with data: ', data);
    // Validate data
    const validatedData = MyProductCreateSchema.parse(data);

    // Create the product
    const product = await dbPrisma.product.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        category: validatedData.category,
        price: validatedData.price,
        stock: 0, // Set initial stock to 0, we'll update it based on inventory
        shipFromPostalId: validatedData.shipFromPostalId ?? '', // Ensure it's a string
        image: validatedData.image,
        specifications: validatedData.specifications ? JSON.stringify(validatedData.specifications) : Prisma.JsonNull, // Use Prisma.JsonNull for nullable JSON
        userId: validatedData.userId,
        companyId: validatedData.companyId ?? null, // Ensure it's nullable
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log('Product created: ', product);

    // Calculate stock per warehouse
    const quantityPerWarehouse = Math.floor(validatedData.quantity / postalCodes.length);
    const remainder = validatedData.quantity % postalCodes.length;

    console.log('Quantity per warehouse: ', quantityPerWarehouse, ' Remainder: ', remainder);

    // Create inventory entries for each warehouse
    for (let i = 0; i < postalCodes.length; i++) {
      const postalCode = postalCodes[i];
      
      // Fetch or create warehouse location by postal code
      let warehouse = await dbPrisma.warehouseLocation.findFirst({
        where: { postalCode },
      });

      if (!warehouse) {
        warehouse = await dbPrisma.warehouseLocation.create({
          data: {
            postalCode,
            address: '',
            city: '',
            country: 'Norway',
            companyId: validatedData.companyId ?? '', // Ensure companyId is passed
          },
        });
      }

      console.log('Warehouse for postal code ', postalCode, ': ', warehouse);

      // Create inventory entry
      const inventory = await dbPrisma.inventory.create({
        data: {
          quantity: i === 0 ? quantityPerWarehouse + remainder : quantityPerWarehouse,
          stock: i === 0 ? quantityPerWarehouse + remainder : quantityPerWarehouse,
          warehouseId: warehouse.id,
          productId: product.id,
        },
      });

      console.log('Inventory created: ', inventory);
    }

    return { success: "Product created successfully with inventory distributed among warehouses." };
  } catch (error) {
    console.error('Error creating product: ', error);
    return { error: "Failed to create product." };
  }
};