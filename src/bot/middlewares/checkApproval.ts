import { Composer, NextFunction } from 'grammy';
import { BotContext } from '../../types/bot.js';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';

// Commands allowed for pending users
const PUBLIC_COMMANDS = [
  '/start',
  '/inicio',
  '/request',
  '/help',
  '/ayuda'
];

const checkApproval = async (ctx: BotContext) => {
  if (!ctx.from) {
    logger.warn('No from field in context');
    return;
  }

  // Get command from message
  const command = ctx.message?.text?.split(' ')[0].toLowerCase();
  if (!command) return;

  // Skip check for public commands
  if (PUBLIC_COMMANDS.includes(command)) {
    return true;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from.id.toString() },
      select: { status: true, username: true }
    });

    if (!user || user.status !== 'APPROVED') {
      logger.info({
        telegramId: ctx.from.id.toString(),
        command,
        status: user?.status
      }, 'Blocked command from non-approved user');

      await ctx.reply(
        '⚠️ Necesitas estar aprobado para usar este comando.\n\n' +
        'Usa /request para solicitar acceso si aún no lo has hecho.\n' +
        'Por favor espera la aprobación del administrador.'
      );
      return false;
    }

    return true;
  } catch (error) {
    logger.error({
      err: error,
      telegramId: ctx.from.id.toString(),
      command
    }, 'Error checking user approval status');
    return false;
  }
};

export const approvalMiddleware = Composer.middleware((ctx: BotContext, next: NextFunction) => {
  return checkApproval(ctx).then(canProceed => {
    if (canProceed) {
      return next();
    }
  });
});