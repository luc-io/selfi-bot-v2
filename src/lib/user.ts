import { prisma } from './prisma.js';
import { logger } from './logger.js';
import { TransactionType } from '@prisma/client';

export class UserService {
  static async createUser(telegramId: string, username?: string) {
    try {
      // Create user with default stars
      const user = await prisma.user.create({
        data: {
          telegramId,   // This is from Telegram
          username,
          stars: 3      // Starting bonus
        }
      });

      logger.info({ telegramId: user.telegramId }, 'New user created');

      // Record the bonus stars transaction
      await prisma.starTransaction.create({
        data: {
          userDatabaseId: user.databaseId,
          amount: 3,
          type: TransactionType.BONUS,
          metadata: {
            reason: 'Initial bonus'
          }
        }
      });

      return user;
    } catch (error) {
      logger.error({ error, telegramId, username }, 'Failed to create user');
      throw error;
    }
  }

  static async addStars(user: { databaseId: string }, stars: number, metadata?: any) {
    try {
      // Update stars balance
      await prisma.user.update({
        where: { databaseId: user.databaseId },
        data: {
          stars: { increment: stars },
          totalBoughtStars: { increment: stars }
        }
      });

      // Record transaction
      const transaction = await prisma.starTransaction.create({
        data: {
          userDatabaseId: user.databaseId,
          amount: stars,
          type: TransactionType.ADMIN_GRANT,
          metadata
        }
      });

      return transaction;
    } catch (error) {
      logger.error({ error, userDatabaseId: user.databaseId, stars }, 'Failed to add stars');
      throw error;
    }
  }

  static async decrementStars(userDatabaseId: string, stars: number, type: TransactionType, metadata?: any) {
    try {
      const transaction = await prisma.starTransaction.create({
        data: {
          userDatabaseId,
          amount: -stars,
          type,
          metadata
        }
      });

      await prisma.user.update({
        where: { databaseId: userDatabaseId },
        data: {
          stars: { decrement: stars },
          totalSpentStars: { increment: stars }
        }
      });

      return transaction;
    } catch (error) {
      logger.error({ error, userDatabaseId, stars }, 'Failed to decrement stars');
      throw error;
    }
  }

  static async getUser(userDatabaseId: string) {
    return prisma.user.findUnique({
      where: { databaseId: userDatabaseId },
      select: {
        databaseId: true,
        telegramId: true,
        username: true,
        stars: true
      }
    });
  }
}