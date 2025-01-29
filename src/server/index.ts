import fastify from 'fastify';
import { logger } from '../lib/logger';
import { config } from '../config';

// Create server
export const server = fastify({
  logger: logger.child({ module: 'api' })
});

// CORS
server.register(import('@fastify/cors'), {
  origin: config.isDev 
    ? 'http://localhost:5173'  // Dev miniapp
    : 'https://selfi.miniapp.com', // Prod miniapp
  credentials: true
});

// Request logging
server.addHook('onRequest', async (request) => {
  request.log.info({ 
    url: request.url, 
    method: request.method,
    userId: request.headers['x-user-id']
  }, 'incoming request');
});

// Error handling
server.setErrorHandler((error, request, reply) => {
  request.log.error(error);

  // Format error response
  if (error.validation) {
    return reply.status(400).send({
      error: {
        code: 'validation_error',
        message: 'Invalid request data',
        details: error.validation
      }
    });
  }

  // Handle known errors
  if (error instanceof Error) {
    switch (error.message) {
      case 'Insufficient stars':
        return reply.status(402).send({
          error: {
            code: 'insufficient_stars',
            message: 'Not enough stars for this operation'
          }
        });

      case 'Not found':
        return reply.status(404).send({
          error: {
            code: 'not_found',
            message: 'Resource not found'
          }
        });
    }
  }

  // Default error
  return reply.status(500).send({
    error: {
      code: 'internal_error',
      message: 'Internal server error'
    }
  });
});

// Register route handlers
server.register(import('./routes/generation'));
server.register(import('./routes/models'));
server.register(import('./routes/training'));
server.register(import('./routes/users'));