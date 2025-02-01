import { CommandContext, Context } from 'grammy';
import { getTelegramId } from '../../utils/telegram';
import { prisma } from '../../prisma';

export const gen = async (ctx: CommandContext<Context>) => {
  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(ctx.from.id) }
  });
  // Rest of your code...
};

export default gen;