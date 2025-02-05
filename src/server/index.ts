import { Bot } from 'grammy';
import { Update } from '@grammyjs/types';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { logger } from '../lib/logger.js';
import { BotContext } from '../types/bot.js';
import { paramsRoutes } from './routes/params.js';
import { loraRoutes } from './routes/loras.js';

export async function setupServer(server: FastifyInstance, bot: Bot<BotContext>) {
  if (!bot) {
    throw new Error('Bot instance must be provided to setupServer');
  }

  // Enable CORS for the miniapp
  await server.register(import('@fastify/cors'), {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'x-telegram-init-data', 'x-telegram-user-id']
  });

  // Add request hook to validate bot is initialized for webhook endpoints
  server.addHook('preHandler', async (request, reply) => {
    if (request.url.startsWith('/bot') && !bot.isInited()) {
      logger.error('Bot not initialized when handling request');
      throw new Error('Bot not initialized');
    }
  });

  // Register API routes
  await server.register(paramsRoutes, { prefix: '/api' });
  await server.register(loraRoutes, { prefix: '/api' });
  logger.info('API routes configured');

  // Webhook endpoint
  server.post<{
    Body: Update
  }>('/bot', async (request: FastifyRequest<{
    Body: Update
  }>, reply: FastifyReply) => {
    try {
      // Log the incoming update for debugging
      logger.info({
        update: request.body,
      }, 'Received update from Telegram');

      await bot.handleUpdate(request.body);
      return reply.status(200).send();
    } catch (error) {
      // Enhanced error logging
      logger.error({
        error,
        update: request.body,
        stack: error instanceof Error ? error.stack : undefined,
        botInitialized: bot.isInited(),
      }, 'Error handling Telegram update');

      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Health check endpoint
  server.get('/ping', async (request, reply) => {
    return reply.status(200).send({ 
      status: 'ok',
      botInitialized: bot.isInited()
    });
  });

  // Add error handler for unhandled errors
  server.setErrorHandler((error, request, reply) => {
    logger.error({
      error,
      stack: error.stack,
      url: request.url,
      method: request.method,
      botInitialized: bot?.isInited()
    }, 'Unhandled server error');

    reply.status(500).send({
      error: error.message || 'Internal Server Error'
    });
  });

  return server;
}