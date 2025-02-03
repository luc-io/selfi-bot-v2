import { prisma } from './prisma.js';
import { TelegramId } from '../types/ids.js';

/**
 * Data required to process a payment
 */
interface PaymentData {
  /** Telegram user ID */
  telegramId: TelegramId;
  /** Payment amount in XTR */
  amount: number;
  /** Number of stars purchased */
  stars: number;
  /** Telegram payment charge ID for reference */
  telegramPaymentChargeId: string;
}

/**
 * Calculate invoice amount for star purchase (1:1 ratio)
 * @param stars - Number of stars to purchase
 * @returns Amount in XTR
 */
export function createInvoice(stars: number): number {
  return stars; // 1:1 ratio (1 star = 1 XTR)
}

/**
 * Process star purchase and update user balance
 * @param data - Payment details including telegramId and stars
 * @throws Error if user not found or payment processing fails
 */
export async function createPayment(data: PaymentData): Promise<void> {
  try {
    // Find user by telegramId
    const user = await prisma.user.findUnique({
      where: { telegramId: data.telegramId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Create transaction entry in the database
    await prisma.starTransaction.create({
      data: {
        userId: user.id,  // Use internal ID for relation
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