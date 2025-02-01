import { getTelegramId } from '../utils/telegram';
import { prisma } from '../prisma';

export const getOrCreateUser = async (telegramId: string | number, username?: string) => {
  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(telegramId) }
  });

  if (!user) {
    return await prisma.user.create({
      data: {
        telegramId: getTelegramId(telegramId),
        username,
      },
    });
  }

  return user;
};