'use server';

import { dbPrisma } from "@/lib/db";
import { MyProductCreateSchema } from "@/schemas";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export const MyCreateProductAction = async (data: z.infer<typeof MyProductCreateSchema>, postalCodes: string[]) => {
  try {
    console.log('Server is Creating a product with data: ', data);
    const validatedData = MyProductCreateSchema.parse(data);

    const product = await dbPrisma.product.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        category: validatedData.category,
        price: validatedData.price,
        stock: 0,
        shipFromPostalId: validatedData.shipFromPostalId ?? '',
        image: validatedData.image,
        specifications: validatedData.specifications ? JSON.stringify(validatedData.specifications) : Prisma.JsonNull,
        userId: validatedData.userId,
        companyId: validatedData.companyId ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log('Product created: ', product);

    const quantityPerWarehouse = Math.floor(validatedData.quantity / postalCodes.length);
    const remainder = validatedData.quantity % postalCodes.length;

    console.log('Quantity per warehouse: ', quantityPerWarehouse, ' Remainder: ', remainder);

    for (let i = 0; i < postalCodes.length; i++) {
      const postalCode = postalCodes[i];
      
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
            userId: validatedData.userId,
            companyId: validatedData.companyId ?? null,
          },
        });
      }

      console.log('Warehouse for postal code ', postalCode, ': ', warehouse);

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