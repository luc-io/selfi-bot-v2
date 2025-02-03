import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { Prisma } from '@prisma/client';

export interface StarsTransaction {
  amount: number;
  type: 'GENERATION' | 'TRAINING' | 'PURCHASE' | 'REFUND' | 'ADMIN_GRANT';
  metadata?: Prisma.JsonValue;
}

export class StarsService {
  static async updateStars(telegramId: string, transaction: StarsTransaction) {
    try {
      const { amount, type, metadata } = transaction;

      const [user, transactionRecord] = await prisma.$transaction([
        // Update user stars
        prisma.user.update({
          where: { telegramId },
          data: {
            stars: { increment: amount },
            totalSpentStars: amount < 0 ? { increment: Math.abs(amount) } : undefined,
            totalBoughtStars: amount > 0 && type === 'PURCHASE' ? { increment: amount } : undefined
          }
        }),
        // Create transaction record
        prisma.starTransaction.create({
          data: {
            user: { connect: { telegramId } },
            amount,
            type,
            metadata: metadata ?? Prisma.JsonNull
          }
        })
      ]);

      logger.info({
        telegramId,
        amount,
        type,
        newBalance: user.stars
      }, 'Stars updated successfully');

      return { user, transaction: transactionRecord };
    } catch (error) {
      logger.error('Error updating stars:', error);
      throw error;
    }
  }

  static async getBalance(telegramId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { telegramId },
        select: {
          stars: true,
          totalSpentStars: true,
          totalBoughtStars: true,
          starTransactions: {
            take: 10,
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      logger.error('Error getting stars balance:', error);
      throw error;
    }
  }

  static async checkBalance(telegramId: string, required: number) {
    try {
      const user = await prisma.user.findUnique({
        where: { telegramId },
        select: { stars: true }
      });

      if (!user) {
        logger.warn({ telegramId }, 'User not found when checking balance');
        return false;
      }

      return user.stars >= required;
    } catch (error) {
      logger.error('Error checking stars balance:', error);
      throw error;
    }
  }

  static async getTopSpenders(limit = 10) {
    try {
      return prisma.user.findMany({
        where: {
          totalSpentStars: { gt: 0 }
        },
        select: {
          telegramId: true,
          username: true,
          totalSpentStars: true
        },
        orderBy: {
          totalSpentStars: 'desc'
        },
        take: limit
      });
    } catch (error) {
      logger.error('Error getting top spenders:', error);
      throw error;
    }
  }
}