import { Bot, Context } from 'grammy';
import { config } from '../../config';

export function menuCommand(bot: Bot<Context>) {
  bot.command('menu', async (ctx: Context) => {
    await ctx.reply('Accede a los ajustes de la Mini App Selfi', {
      reply_markup: {
        keyboard: [[
          {
            text: '⚙️ Abrir Ajustes',
            web_app: { url: config.MINIAPP_URL }
          }
        ]],
        resize_keyboard: true
      }
    });
  });
}