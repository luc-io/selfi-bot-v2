import { prisma } from './prisma';
import { logger } from './logger';

export async function getOrCreateUser(telegramId: string, username?: string) {
  try {
    // Try to find existing user
    let user = await prisma.user.findUnique({
      where: { telegramId }
    });

    // Create new user if not found
    if (!user) {
      user = await prisma.user.create({
        data: {
          telegramId,
          username,
          stars: 10 // Welcome bonus
        }
      });

      logger.info({ telegramId: user.telegramId }, 'New user created');

      // Create transaction for welcome bonus
      await prisma.starTransaction.create({
        data: {
          user: { connect: { telegramId: user.telegramId } },
          amount: 10,
          type: 'ADMIN_GRANT',
          metadata: {
            reason: 'Welcome bonus'
          }
        }
      });
    } else if (username && username !== user.username) {
      // Update username if changed
      user = await prisma.user.update({
        where: { telegramId: user.telegramId },
        data: { username }
      });
    }

    return user;
  } catch (error) {
    logger.error('Error in getOrCreateUser:', error);
    throw error;
  }
}

export async function updateUserStars(telegramId: string, amount: number, type: 'GENERATION' | 'TRAINING' | 'PURCHASE' | 'REFUND') {
  try {
    const [user, transaction] = await prisma.$transaction([
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
          metadata: {
            timestamp: new Date().toISOString()
          }
        }
      })
    ]);

    logger.info({ telegramId, amount, type }, 'User stars updated');

    return { user, transaction };
  } catch (error) {
    logger.error('Error in updateUserStars:', error);
    throw error;
  }
}

export async function checkUserStars(telegramId: string, required: number) {
  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: { stars: true }
  });

  if (!user) {
    throw new Error('User not found');
  }

  if (user.stars < required) {
    throw new Error(`Insufficient stars. Required: ${required}, Available: ${user.stars}`);
  }

  return true;
}