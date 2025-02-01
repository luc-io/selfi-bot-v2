import { CommandContext } from 'grammy';
import { getTelegramId } from '../../utils/telegram';

export const stars = async (ctx: CommandContext) => {
  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(ctx.from.id) }
  });
  // Rest of your code...
};