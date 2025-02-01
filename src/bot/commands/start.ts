import { CommandContext, Context } from 'grammy';
import { getTelegramId } from '../../utils/telegram';
import { prisma } from '../../prisma';

export const startCommand = async (ctx: CommandContext<Context>) => {
  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(ctx.from.id) },
  });

  if (!user) {
    await prisma.user.create({
      data: {
        telegramId: getTelegramId(ctx.from.id),
        username: ctx.from.username,
      },
    });
  }
  // Rest of your code...
};

export default startCommand;