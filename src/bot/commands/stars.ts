import { Composer } from 'grammy';
import { BotContext } from '../../types/bot.js';
import { getOrCreateUser } from '../../lib/user.js';

const composer = new Composer<BotContext>();

composer.command('stars', async (ctx) => {
  if (!ctx.from) {
    await ctx.reply('Could not identify user');
    return;
  }

  const telegramId = ctx.from.id.toString();
  const user = await getOrCreateUser(telegramId, ctx.from.username ?? undefined);

  await ctx.reply(`You have ${user.stars} ⭐`);
});

export default composer;