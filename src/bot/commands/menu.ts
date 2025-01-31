import { Bot, Context } from 'grammy';
import { config } from '../../config';

export function menuCommand(bot: Bot<Context>) {
  bot.command('menu', async (ctx: Context) => {
    await ctx.reply('Access Selfi Mini App settings', {
      reply_markup: {
        keyboard: [[
          {
            text: '⚙️ Open Settings',
            web_app: { url: config.MINIAPP_URL }
          }
        ]],
        resize_keyboard: true
      }
    });
  });
}