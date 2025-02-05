import { Bot } from 'grammy';
import { Update } from '@grammyjs/types';
import { FastifyInstance } from 'fastify';
import fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from '../config/index.js';

export async function setupServer(bot: Bot) {
  const app: FastifyInstance = fastify({
    logger: {
      transport: {
        target: 'pino-pretty',
      },
    },
  });

  // Register plugins
  await app.register(cors);

  // Health check endpoint
  app.get('/ping', async (request, reply) => {
    return reply.status(200).send({ status: 'ok' });
  });

  // Telegram webhook endpoint
  app.post('/webhook', async (request, reply) => {
    const update = request.body as Update;
    try {
      await bot.handleUpdate(update);
      return reply.status(200).send();
    } catch (error) {
      console.error('Error handling update:', error);
      return reply.status(500).send();
    }
  });

  // Start server
  try {
    const port = Number(config.PORT) || 3000;
    const host = '0.0.0.0';
    await app.listen({ port, host });
    console.log(`Server is running on http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  return app;
}