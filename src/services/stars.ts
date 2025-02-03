import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export class StarsService {
  /**
   * Pre-checkout validation to ensure the user exists and the payment can be processed
   */
  static async validatePreCheckout(telegramId: string, stars: number): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { telegramId },
        select: { telegramId: true }  // We only need to verify user exists
      });

      if (!user) {
        logger.error({ telegramId }, 'User not found during pre-checkout');
        return false;
      }

      return true;
    } catch (error) {
      logger.error({ error, telegramId, stars }, 'Error during pre-checkout validation');
      return false;
    }
  }

  /**
   * Process successful payment and add stars to user's balance
   */
  static async processPayment(telegramId: string, stars: number, telegramPaymentChargeId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { telegramId },
        select: { 
          databaseId: true,  // Changed from id to databaseId
          telegramId: true,
          stars: true
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Update user's stars balance and create transaction record
      const updatedUser = await prisma.user.update({
        where: { telegramId },
        data: {
          stars: { increment: stars },
          totalBoughtStars: { increment: stars },
          starTransactions: {
            create: {
              amount: stars,
              type: 'PURCHASE',
              telegramPaymentChargeId,
              status: 'COMPLETED'
            }
          }
        }
      });

      logger.info({ 
        telegramId,
        stars,
        telegramPaymentChargeId,
        newBalance: updatedUser.stars 
      }, 'Payment processed successfully');

      return updatedUser;

    } catch (error) {
      logger.error({ 
        error, 
        telegramId,
        stars,
        telegramPaymentChargeId 
      }, 'Error processing payment');
      throw error;
    }
  }

  /**
   * Check if user has sufficient stars balance
   */
  static async hasSufficientStars(telegramId: string, required: number): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { telegramId },
        select: { stars: true }
      });

      return user?.stars >= required;
    } catch (error) {
      logger.error({ error, telegramId, required }, 'Error checking stars balance');
      return false;
    }
  }

  /**
   * Get user's current stars balance
   */
  static async getBalance(telegramId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { stars: true }
    });

    return user?.stars ?? 0;
  }
}