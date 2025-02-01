import Fastify from 'fastify';
import cors from '@fastify/cors';
import { logger } from '../lib/logger.js';
import userParametersRoutes from './routes/userParameters.js';

const server = Fastify({
  logger: false,
});

export async function setupServer() {
  try {
    logger.info('Setting up server...');

    // Configure CORS
    const origin = process.env.CORS_ORIGIN || '*';
    await server.register(cors, { 
      origin,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type']
    });
    logger.info(`CORS configured with origin: ${origin}`);

    // Register routes
    await server.register(userParametersRoutes);
    logger.info('Routes registered successfully');

    const registeredRoutes = server.printRoutes();
    logger.info('Registered routes:');
    logger.info(registeredRoutes);

    // Start the server
    await server.listen({ port: 3001, host: '0.0.0.0' });
    logger.info('Server started', { port: 3001, host: '0.0.0.0' });

  } catch (err) {
    logger.error('Error starting server:', err);
    process.exit(1);
  }
}

export { server };