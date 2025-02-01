import { getTelegramId } from '../utils/telegram';
import { prisma } from '../prisma';
import { randomUUID } from 'crypto';

export const getOrCreateUser = async (telegramId: string | number, username?: string) => {
  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(telegramId) }
  });

  if (!user) {
    return await prisma.user.create({
      data: {
        id: randomUUID(),
        telegramId: getTelegramId(telegramId),
        username,
      },
    });
  }

  return user;
};