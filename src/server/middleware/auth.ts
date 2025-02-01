import { FastifyRequest, FastifyReply } from 'fastify';
import { createHmac } from 'crypto';
import { config } from '../../config.js';
import { logger } from '../../lib/logger.js';

export async function validateInitData(request: FastifyRequest, reply: FastifyReply) {
  const initData = request.headers['x-telegram-init-data'];
  
  logger.debug({ initData }, 'Validating Telegram init data');
  
  if (!initData) {
    logger.warn('Missing Telegram init data in request');
    return reply.status(401).send({
      success: false,
      message: 'Missing Telegram init data'
    });
  }

  // Validate Telegram init data
  try {
    const secret = createHmac('sha256', 'WebAppData')
      .update(config.TELEGRAM_BOT_TOKEN)
      .digest();
    
    const urlParams = new URLSearchParams(initData as string);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');
    
    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    const hmac = createHmac('sha256', secret)
      .update(dataCheckString)
      .digest('hex');
    
    if (hmac !== hash) {
      logger.warn({ hmac, hash }, 'Invalid hash in Telegram init data');
      throw new Error('Invalid hash');
    }

    logger.debug('Telegram init data validated successfully');
  } catch (error) {
    logger.error({ error }, 'Error validating Telegram init data');
    return reply.status(401).send({
      success: false,
      message: 'Invalid init data'
    });
  }
}