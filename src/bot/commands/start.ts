import { CommandContext } from 'grammy';
import { getTelegramId } from '../../utils/telegram';

export const start = async (ctx: CommandContext) => {
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