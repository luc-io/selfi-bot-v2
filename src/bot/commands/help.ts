import { Composer } from 'grammy';
import { BotContext } from '../../types/bot.js';
import { logger } from '../../lib/logger.js';

const composer = new Composer<BotContext>();

composer.command('ayuda', async (ctx) => {
  try {
    const helpText = `📱 *Comandos de Selfi Bot*\n\n
/gen [prompt] - Genera una imagen a partir de tu prompt. Cada generación cuesta 1 estrella ⭐
/estrellas - Abre la tienda de estrellas para comprar más estrellas
/balance - Consulta tu saldo actual y el historial de transacciones
/ayuda - Muestra este mensaje de ayuda\n\n
*Cómo generar imágenes:*\n
1. Asegúrate de tener estrellas (cómpralas con /estrellas)
2. Usa el comando /gen seguido de tu prompt
3. Espera unos segundos para tu imagen\n\n
*Ejemplo:*\n
/gen una selfie fotorrealista de una joven con cabello castaño y ojos azules, usando un vestido rojo\n\n
*¿Necesitas ayuda o tienes preguntas?*\n
Contacta a @${process.env.SUPPORT_USERNAME || 'support'}`;

    await ctx.reply(helpText, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.error({ error }, 'Failed to show help');
    await ctx.reply('Lo sentimos, algo salió mal. Por favor intenta de nuevo más tarde.');
  }
});

export default composer;