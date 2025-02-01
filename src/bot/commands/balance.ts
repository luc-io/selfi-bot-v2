import { CommandContext, Context } from 'grammy';
import { getTelegramId, ensureFrom } from '../../utils/telegram';
import { prisma } from '../../prisma';

export const balance = async (ctx: CommandContext<Context>) => {
  const from = ensureFrom(ctx);
  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(from.id) }
  });
  // Rest of your code...
};

export default balance;