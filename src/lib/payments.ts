import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from './logger.js';

const prisma = new PrismaClient();

interface PaymentCreateInput {
  userId: string;
  amount: number;
  stars: number;
  telegramPaymentChargeId: string;
}

export async function createPayment(data: PaymentCreateInput) {
  const { userId, amount, stars, telegramPaymentChargeId } = data;

  try {
    // Add stars and record transaction in one transaction
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Add stars to user balance
      await tx.user.update({
        where: { id: userId },
        data: {
          stars: { increment: stars },
          totalBoughtStars: { increment: stars },
          starTransactions: {
            create: {
              amount,
              type: 'PURCHASE',
              telegramPaymentChargeId,
            }
          }
        }
      });
    });

    logger.info({ userId, stars }, 'Stars added to user balance');
  } catch (error) {
    logger.error({ error, userId }, 'Failed to process payment');
    throw error;
  }
}