'use server'

import * as z from 'zod'
import bcrypt from 'bcryptjs'

import { dbPrisma } from '@/lib/db'
import { MyAuthSettingsSchema } from '@/schemas'
import { getUserByEmail, getUserById } from '@/data/user'
import { MyLibUserAuth } from '@/lib/user-auth'
import { generateVerificationToken } from '@/lib/tokens'
import { sendVerificationEmail } from '@/lib/mail'
import { UserRole } from '@/generated/prisma/browser'

type SettingsResult = { error: string } | { success: string };

export const settings = async (values: z.infer<typeof MyAuthSettingsSchema>): Promise<SettingsResult> => {
    const user = await MyLibUserAuth() // Authenticate the user
    
    // Check if the user is authenticated
    if (!user?.id) {
        return { error: 'Not authorized!' }
    }

    const dbUser = await getUserById(user.id); // Retrieve the user from the database

    if (!dbUser){
        return { error: 'Not authorized!' } // Not authorized if the user doesn't exist in the database
    }

    // For OAuth users, ignore email and password fields as they are managed by the OAuth provider
    if (user.isOAuth) {
        values.email = undefined;
        values.password = undefined;
        values.newPassword = undefined;
        values.isTwoFactorEnabled = undefined;
    }

    // If email is being updated, check if it's already in use and send a verification email
    if (values.email && values.email !== user.email) {
        const existingUser = await getUserByEmail(values.email);
        

        // Check if the new email is already in use by another user
        if (existingUser && existingUser.id !== user.id) {
            return {error: 'Email already in use.'}
        }

        // Generate and send a verification email to the new email address
        const verificationToken = await generateVerificationToken(values.email);
        await sendVerificationEmail(verificationToken.email, verificationToken.token);

        return { success: 'Verification email sent.'}
    }

    // If updating the password, verify the current password and hash the new one
    if (values.password && values.newPassword && dbUser.password) {
        const passwordMatch = await bcrypt.compare(values.password, dbUser.password);

        // Check if the current password is correct
        if (!passwordMatch) {
            return { error: 'Incorrect password.'}
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(values.newPassword, 10);
        values.password = hashedPassword; // Replace the plain password with the hashed one
        values.newPassword = undefined; // Clear the newPassword field as it's no longer needed
    }

    // Restrict role update to ADMIN users
    if (user.role === UserRole.ADMIN && dbUser.role === UserRole.ADMIN) {
        console.log(`[USER: ${user.email} ][ADMIN-LOG] Updated Role to `, values.role, `from ${dbUser.role}`)
        values.role; // Update role if ADMIN!
    } else {
        
        values.role = dbUser.role; // Keep the role the same if not ADMIN
    }
    
    // Update the user in the database with the new values
    await dbPrisma.user.update({
        where: {id: dbUser.id},
        data: {
            ...values, // Spread operator to include all updated fields
        }
    })

    // Return success message
    return { success: 'Settings updated!'}
}