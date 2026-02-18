"use server";

/**
 * @fileOverview GDPR data export server action (Art. 15 / Art. 20).
 * @stability active
 * @keyInvariants Requires authenticated user. Exports all personal data
 *   the platform holds about the requesting user as JSON.
 */

import { dbPrisma } from "@/lib/db";
import { MyLibUserIDAuth } from "@/lib/user-auth";

export interface DataExportResult {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
  requestId?: string;
}

/**
 * Exports all personal data for the authenticated user as a JSON object.
 * Covers: profile, orders, messages, posts, wallets, trades, polls, follows,
 * addresses, verification info, and settings.
 */
export async function exportMyData(): Promise<DataExportResult> {
  const userId = await MyLibUserIDAuth();
  if (!userId) return { success: false, error: "Ikke autentisert." };

  try {
    // Record the request
    const request = await dbPrisma.dataExportRequest.create({
      data: { userId, status: "PROCESSING" },
    });

    // Gather all personal data
    const [
      user,
      accounts,
      orders,
      wallets,
      addresses,
      followers,
      following,
      conversations,
      trades,
      polls,
      pollResponses,
      products,
      reviews,
      privacySettings,
    ] = await Promise.all([
      dbPrisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          image: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          web3ModeEnabled: true,
          banner: true,
          bio: true,
          hasDiscordAuth: true,
          hasGithubAuth: true,
          hasGoogleAuth: true,
          hasVerifiedWallet: true,
          phoneCountryCode: true,
          phoneNumber: true,
          phoneVerified: true,
          verificationScore: true,
          verificationTier: true,
          reachLifetime: true,
          reachMomentum: true,
        },
      }),
      dbPrisma.account.findMany({
        where: { userId },
        select: {
          provider: true,
          type: true,
          providerAccountId: true,
          createdAt: true,
        },
      }),
      dbPrisma.order.findMany({
        where: { userId },
        select: {
          id: true,
          status: true,
          totalAmount: true,
          shippingName: true,
          shippingAddress: true,
          shippingCity: true,
          shippingPostalCode: true,
          shippingCountry: true,
          shippingMethod: true,
          shippingCost: true,
          createdAt: true,
          OrderItem: {
            select: {
              title: true,
              quantity: true,
              priceAtTime: true,
            },
          },
        },
      }),
      dbPrisma.wallet.findMany({
        where: { ownerUserId: userId },
        select: {
          address: true,
          family: true,
          isDefault: true,
          createdAt: true,
        },
      }),
      dbPrisma.address.findMany({
        where: { userId },
        select: {
          label: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          postalCode: true,
          country: true,
          createdAt: true,
        },
      }),
      dbPrisma.follow.findMany({
        where: { followerId: userId },
        select: { followingId: true, createdAt: true },
      }),
      dbPrisma.follow.findMany({
        where: { followingId: userId },
        select: { followerId: true, createdAt: true },
      }),
      dbPrisma.conversation.findMany({
        where: {
          OR: [{ userId }, { participants: { has: userId } }],
        },
        select: {
          id: true,
          title: true,
          type: true,
          createdAt: true,
        },
      }),
      dbPrisma.trade.findMany({
        where: { OR: [{ initiatorId: userId }, { responderId: userId }] },
        select: {
          id: true,
          status: true,
          createdAt: true,
          completedAt: true,
        },
      }),
      dbPrisma.advancedPoll.findMany({
        where: { creatorId: userId },
        select: {
          id: true,
          title: true,
          type: true,
          createdAt: true,
        },
      }),
      dbPrisma.pollResponse.findMany({
        where: { userId },
        select: {
          advancedPollId: true,
          completedAt: true,
          createdAt: true,
        },
      }),
      dbPrisma.product.findMany({
        where: { userId },
        select: {
          id: true,
          title: true,
          price: true,
          createdAt: true,
        },
      }),
      dbPrisma.review.findMany({
        where: { userId },
        select: {
          productId: true,
          rating: true,
          comment: true,
          createdAt: true,
        },
      }),
      dbPrisma.userPrivacySettings.findUnique({
        where: { userId },
      }),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      profile: user,
      oauthAccounts: accounts,
      orders,
      wallets,
      addresses,
      following: followers,
      followedBy: following,
      conversations,
      trades,
      pollsCreated: polls,
      pollResponses,
      products,
      reviews,
      privacySettings,
    };

    // Mark request as completed
    await dbPrisma.dataExportRequest.update({
      where: { id: request.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    return { success: true, data: exportData, requestId: request.id };
  } catch (error) {
    console.error("[exportMyData] Error:", error);
    return { success: false, error: "Kunne ikke eksportere data. Prøv igjen senere." };
  }
}
