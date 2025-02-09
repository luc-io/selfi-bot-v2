import { Bot } from 'grammy';
import { Update } from '@grammyjs/types';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { logger } from '../lib/logger.js';
import { BotContext } from '../types/bot.js';
import { paramsRoutes } from './routes/params.js';
import { loraRoutes } from './routes/loras.js';
import { trainingRoutes } from './routes/training.js';
import { userRoutes } from './routes/user.js';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';

export async function setupServer(server: FastifyInstance, bot: Bot<BotContext>) {
  if (!bot) {
    throw new Error('Bot instance must be provided to setupServer');
  }

  // Enable CORS for the miniapp
  await server.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'x-telegram-init-data', 'x-telegram-user-id']
  });

  // Register multipart plugin with increased limits
  await server.register(multipart, {
    limits: {
      fieldNameSize: 100, // Max field name size in bytes
      fieldSize: 1000000, // Max field value size in bytes (1MB)
      fields: 30, // Max number of non-file fields (increased to account for files + fields)
      fileSize: 25 * 1024 * 1024, // 25MB per file to match route limit
      files: 20, // Max number of files to match route limit
      headerPairs: 2000, // Max number of header key=>value pairs
      parts: 50 // Total number of parts (files + fields)
    }
  });

  // Add request hook to validate bot is initialized for webhook endpoints
  server.addHook('preHandler', async (request, reply) => {
    if (request.url.startsWith('/bot')) {
      try {
        // Simple check to see if bot api is responding
        await bot.api.getMe();
      } catch (error) {
        logger.error('Bot not properly initialized when handling request');
        throw new Error('Bot not initialized');
      }
    }
  });

  // Register API routes
  await server.register(paramsRoutes, { prefix: '/api' });
  await server.register(loraRoutes, { prefix: '/api' });
  await server.register(trainingRoutes, { prefix: '/api' });
  await server.register(userRoutes);
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
        stack: error instanceof Error ? error.stack : undefined
      }, 'Error handling Telegram update');

      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Health check endpoint
  server.get('/ping', async (request, reply) => {
    let botStatus = false;
    try {
      await bot.api.getMe();
      botStatus = true;
    } catch (error) {
      logger.error('Bot health check failed', error);
    }

    return reply.status(200).send({ 
      status: 'ok',
      botInitialized: botStatus
    });
  });

  return server;
}
