import { Bot, webhookCallback } from 'grammy';
import { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import { BotContext } from '../types/bot.js';
import { logger } from '../lib/logger.js';
import { paramsRoutes } from './routes/params.js';
import { loraRoutes } from './routes/loras.js';

export async function setupServer(app: FastifyInstance, bot: Bot<BotContext>) {
  // Register CORS plugin
  await app.register(fastifyCors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  });

  // Register API routes with explicit prefixes
  await app.register(async function(fastify) {
    // Bot webhook handler
    fastify.post('/bot', webhookCallback(bot, 'fastify'));
    
    // API routes
    await fastify.register(paramsRoutes, { prefix: '/api' });
    await fastify.register(loraRoutes, { prefix: '/api' });

    // Health check route
    fastify.get('/health', async () => {
      return { status: 'ok' };
    });
  });

  // Log registered routes for debugging
  const routes = app.printRoutes();
  logger.info({ routes }, 'Server routes configured');
}