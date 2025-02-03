import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PaymentData {
  telegramId: string;  // Changed from userId
  amount: number;
  stars: number;
  telegramPaymentChargeId: string;
}

export function createInvoice(stars: number): number {
  // 1:1 ratio (1 star = 1 XTR)
  return stars;
}

export async function createPayment(data: PaymentData): Promise<void> {
  try {
    // Create transaction entry in the database
    await prisma.starTransaction.create({
      data: {
        user: { connect: { telegramId: data.telegramId } },
        amount: data.amount,
        type: 'PURCHASE',
        telegramPaymentChargeId: data.telegramPaymentChargeId,
        status: 'COMPLETED',
      },
    });

    // Update user's star balance
    await prisma.user.update({
      where: { telegramId: data.telegramId },
      data: {
        stars: { increment: data.stars },
        totalBoughtStars: { increment: data.stars },
      },
    });
  } catch (err) {
    const error = err as Error;
    throw new Error(`Payment creation failed: ${error?.message || 'Unknown error'}`);
  }
}