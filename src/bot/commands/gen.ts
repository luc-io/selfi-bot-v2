import { CommandContext } from 'grammy';
import { getTelegramId } from '../../utils/telegram';

export const gen = async (ctx: CommandContext) => {
  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(ctx.from.id) }
  });
  // Rest of your code...
};