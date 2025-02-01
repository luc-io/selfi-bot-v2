import { CommandContext, Context } from 'grammy';
import { getTelegramId, ensureFrom } from '../../utils/telegram';
import { prisma } from '../../prisma';
import { randomUUID } from 'crypto';

export const startCommand = async (ctx: CommandContext<Context>) => {
  const from = ensureFrom(ctx);
  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(from.id) },
  });

  if (!user) {
    await prisma.user.create({
      data: {
        id: randomUUID(),
        telegramId: getTelegramId(from.id),
        username: from.username,
      },
    });
  }
  // Rest of your code...
};

export default startCommand;