import { Bot, webhookCallback } from 'grammy';
import { FastifyInstance } from 'fastify';
import { BotContext } from '../types/bot.js';
import { logger } from '../lib/logger.js';
import { paramsRoutes } from './routes/params.js';

export function setupServer(app: FastifyInstance, bot: Bot<BotContext>) {
  // Register bot webhook handler
  app.post('/bot', webhookCallback(bot, 'fastify'));
  
  // Register parameter routes
  app.register(paramsRoutes, { prefix: '/api' });
  
  // Health check route
  app.get('/health', async (request, reply) => {
    return { status: 'ok' };
  });

  logger.info('Server routes configured');
}