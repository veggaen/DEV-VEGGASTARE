'use server';
import * as z from 'zod'

import { MyProductCreateSchema } from '@/schemas'
import { dbPrisma } from '@/lib/db';


const MyGetProductsAction = async () => {
        const response = await dbPrisma.product.findMany();
        const data = response;
        return data;
};

const MyCreateProductAction = async (values: z.infer<typeof MyProductCreateSchema>) => {
        console.log('MyCreateProductAction', values);
        /* const { edgestore } = useEdgeStore(); */
        const validateFields = MyProductCreateSchema.safeParse(values);
        

        if (!validateFields.success){
                return { error: 'Invalid fields'} // todo: json
        }
        
        const { title, description, category, price, stock, image, specifications, shippingDetails, userId } = validateFields.data;

        // Adjust the structure for shippingDetails to match Prisma's expectations
        const shippingDetailsFormatted = shippingDetails ? {
                create: shippingDetails.map(details => ({
                price: details.price,
                method: details.method,
                regions: details.regions,
                }))
        } : undefined;

        await dbPrisma.product.create({
                // where: {id: dbUser.id},
                data: {
                    ...validateFields.data, // Spread operator to include all updated fields
                    stock: stock || 0, // Assign a default value of 0 if stock is undefined
                    image: image || '', // Assign an empty string if image is undefined
                    shippingDetails: shippingDetailsFormatted || undefined, // Cast shippingDetails to the correct type
                }
            });

        return { success: 'Product created!' };
};
    
export { MyGetProductsAction, MyCreateProductAction };