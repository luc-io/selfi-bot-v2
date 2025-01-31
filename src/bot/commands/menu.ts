import { Composer } from '@grammyjs/composer';
import { type Context } from 'grammy';
import { config } from '../../config';

export const menuCommand = new Composer<Context>();

menuCommand.command('menu', async (ctx) => {
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