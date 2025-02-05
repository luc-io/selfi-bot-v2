import { FastifyInstance } from 'fastify';
import { Bot } from 'grammy';
import { BotContext } from '../types/bot.js';
import cors from '@fastify/cors';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import training from './routes/training.js';

export async function setupServer(server: FastifyInstance, bot: Bot<BotContext>) {
  // Register plugins
  await server.register(cors, {
    origin: config.ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type'],
    exposedHeaders: [],
    credentials: true
  });

  // Register routes
  await server.register(training);

  // Bot webhook endpoint
  server.post('/bot', {
    config: {
      rawBody: true
    },
    handler: async (request, reply) => {
      try {
        const update = request.body;
        logger.debug({ update }, 'Received Telegram update');

        await bot.handleUpdate(update);
        logger.debug('Update handled successfully');

        reply.send({ ok: true });
      } catch (error) {
        logger.error({ 
          error, 
          body: request.body,
          headers: request.headers
        }, 'Error handling bot update');
        
        reply.code(500).send({ error: 'Failed to handle bot update' });
      }
    }
  });

  server.get('/bot/health', async (_, reply) => {
    try {
      // Get webhook info
      const webhookInfo = await bot.api.getWebhookInfo();
      
      // Check for any pending updates
      const updates = await bot.api.getUpdates({ 
        limit: 1, 
        timeout: 1 
      });

      reply.send({
        ok: true,
        webhook: webhookInfo,
        pendingUpdates: updates.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error({ error }, 'Health check failed');
      reply.code(500).send({ 
        ok: false,
        error: 'Health check failed' 
      });
    }
  });

  // Error handler
  server.setErrorHandler((error, request, reply) => {
    logger.error({ 
      error,
      method: request.method,
      url: request.url,
      body: request.body
    }, 'Server error occurred');

    reply.status(500).send({ error: 'Internal server error' });
  });
}