import { Bot } from 'grammy';
import { Update } from '@grammyjs/types';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { logger } from '../lib/logger.js';
import { BotContext } from '../types/bot.js';
import { paramsRoutes } from './routes/params.js';
import { loraRoutes } from './routes/loras.js';
import { trainingRoutes } from './routes/training.js';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';

export async function setupServer(server: FastifyInstance, bot: Bot<BotContext>) {
  if (!bot) {
    throw new Error('Bot instance must be provided to setupServer');
  }

  // Enable multipart for file uploads
  await server.register(multipart, {
    limits: {
      fieldNameSize: 100, // Max field name size in bytes
      fieldSize: 1000000, // Max field value size in bytes (1MB)
      fields: 10, // Max number of non-file fields
      fileSize: 100000000, // Max file size in bytes (100MB)
      files: 10, // Max number of file fields
      headerPairs: 2000 // Max number of header key=>value pairs
    },
    attachFieldsToBody: true
  });

  // Enable CORS for the miniapp
  await server.register(cors, {
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

  // Configure body size limits
  server.setBodyLimit(100 * 1024 * 1024); // 100MB

  // Register API routes
  await server.register(paramsRoutes, { prefix: '/api' });
  await server.register(loraRoutes, { prefix: '/api' });
  await server.register(trainingRoutes, { prefix: '' }); // Keep the original path
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

  return server;
}