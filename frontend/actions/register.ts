'use server';
import * as z from 'zod'
import bcrypt from 'bcryptjs'

import { MyAuthRegisterSchema } from '@/schemas'
import { dbPrisma } from '@/lib/db';
import { getUserByEmail } from '@/data/user';
import { generateVerificationToken } from '@/lib/tokens';
import { sendVerificationEmail } from '@/lib/mail';

export const MyRegisterAction = async (values: z.infer<typeof MyAuthRegisterSchema>) => {
    console.log('MyRegisterAction', values);
    const validateFields = MyAuthRegisterSchema.safeParse(values);

    if (!validateFields.success){
        return { error: 'Invalid fields'} // todo: json
    }

    const { email, password, name, referredBy } = validateFields.data;
    const hashedPassword = await bcrypt.hash(password, 10)
    
    const existingUser = await getUserByEmail(email);
    if (existingUser?.email === email){
        return {error: 'Email already exists'} // todo:
    }

    await dbPrisma.user.create({
        data: {
            name,
            email,
            password: hashedPassword,
            referredBy: referredBy
        }
    })

    // TODO: Send verification token email
    const verificationToken = await generateVerificationToken(email);
    await sendVerificationEmail(verificationToken.email, verificationToken.token);

    return { success: 'Confirmation email sent!' }
};