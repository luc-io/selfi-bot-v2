import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export type StarTransactionType = 'GENERATION' | 'TRAINING' | 'PURCHASE' | 'REFUND' | 'ADMIN_GRANT';

interface StarTransaction {
  userId: string;
  amount: number;
  type: StarTransactionType;
  metadata?: Record<string, unknown>;
}

export class StarsService {
  /**
   * Add or remove stars from a user's balance
   */
  static async updateStars(telegramId: string, amount: number, type: StarTransactionType, metadata?: Record<string, unknown>) {
    try {
      const user = await prisma.user.findUnique({
        where: { telegramId },
        select: {
          databaseId: true,
          telegramId: true,
          stars: true
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Check for negative balance if removing stars
      if (amount < 0 && (user.stars + amount) < 0) {
        throw new Error('Insufficient stars balance');
      }

      // Update user balance and create transaction record
      const [updatedUser, transaction] = await prisma.$transaction([
        prisma.user.update({
          where: { telegramId },
          data: {
            stars: {
              increment: amount
            }
          }
        }),
        prisma.starTransaction.create({
          data: {
            amount,
            type,
            metadata,
            user: {
              connect: {
                telegramId
              }
            }
          }
        })
      ]);

      logger.info({
        telegramId,
        type,
        amount,
        newBalance: updatedUser.stars
      }, 'Stars balance updated');

      return {
        user: updatedUser,
        transaction
      };
    } catch (error) {
      logger.error({
        error,
        telegramId,
        amount,
        type
      }, 'Failed to update stars');
      throw error;
    }
  }

  /**
   * Check if a user has enough stars for an operation
   */
  static async hasEnoughStars(telegramId: string, required: number): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { stars: true }
    });

    // If user doesn't exist or stars is undefined, they don't have enough stars
    if (!user?.stars) {
      return false;
    }

    return user.stars >= required;
  }

  /**
   * Get a user's current star balance
   */
  static async getBalance(telegramId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { stars: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user.stars ?? 0;
  }

  /**
   * Get a list of a user's star transactions
   */
  static async getTransactions(telegramId: string, limit = 10, offset = 0) {
    const user = await prisma.user.findUnique({
      where: { telegramId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    return prisma.starTransaction.findMany({
      where: {
        user: { telegramId }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: offset
    });
  }
}