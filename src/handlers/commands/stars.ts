import { Context } from '../../types';
import { starPacks } from '../../stars';

export async function handleStarsCommand(ctx: Context) {
  const user = await ctx.db.user.findUnique({
    where: { telegramId: ctx.from.id.toString() }
  });

  if (!user) {
    return ctx.reply('Please start the bot first with /start');
  }

  const message = [
    `You have ${user.stars} ⭐`,
    '\nStar packs available:',
    ...starPacks.map(pack => `${pack.label} - ${pack.price} XTR`),
    '\nTo buy stars, click on the pack you want to purchase.'
  ].join('\n');

  const buttons = starPacks.map(pack => [{
    text: pack.label,
    callback_data: `buy_stars:${pack.stars}`
  }]);

  await ctx.reply(message, {
    reply_markup: {
      inline_keyboard: buttons
    }
  });
}