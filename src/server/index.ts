import fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { paramsRoutes } from './routes/params.js';

export async function setupServer() {
  const server = fastify({
    logger,
  });

  logger.info('Setting up server...');

  // Register CORS
  await server.register(cors, {
    origin: config.MINIAPP_URL,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'x-telegram-init-data'],
  });

  logger.info('CORS configured with origin:', config.MINIAPP_URL);

  // Register routes
  try {
    await server.register(paramsRoutes, { prefix: '/' });
    logger.info('Routes registered successfully');

    // Log all registered routes
    server.ready(() => {
      logger.info('Registered routes:', {
        routes: server.printRoutes()
      });
    });
  } catch (error) {
    logger.error('Failed to register routes:', error);
    throw error;
  }

  // Add error handler
  server.setErrorHandler((error, request, reply) => {
    logger.error({ 
      error, 
      path: request.url, 
      method: request.method,
      body: request.body
    }, 'Server error');
    
    reply.status(500).send({
      success: false,
      message: 'Internal server error',
    });
  });

  try {
    const port = parseInt(config.PORT);
    const host = '0.0.0.0';
    
    await server.listen({ port, host });
    logger.info({ port, host }, 'Server started');
  } catch (err) {
    logger.error({ error: err }, 'Failed to start server');
    process.exit(1);
  }

  return server;
}