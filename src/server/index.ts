import { Bot, webhookCallback } from 'grammy';
import { FastifyInstance } from 'fastify';
import { BotContext } from '../types/bot.js';
import { logger } from '../lib/logger.js';
import { paramsRoutes } from './routes/params.js';
import { loraRoutes } from './routes/loras.js';
import { testRoutes } from './routes/test.js';

export function setupServer(app: FastifyInstance, bot: Bot<BotContext>) {
  // Register bot webhook handler
  app.post('/bot', webhookCallback(bot, 'fastify'));
  
  // Register API routes
  app.register(paramsRoutes, { prefix: '/api' });
  app.register(loraRoutes, { prefix: '/api' });
  app.register(testRoutes, { prefix: '/api' });
  
  // Health check route
  app.get('/health', async (request, reply) => {
    return { status: 'ok' };
  });

  logger.info('Server routes configured');
}