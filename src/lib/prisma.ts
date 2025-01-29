import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const prismaLogger = logger.child({ module: 'prisma' });

export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' }
  ]
});

// Log queries in development
prisma.$on('query', (e) => {
  prismaLogger.debug(e);
});

// Log errors
prisma.$on('error', (e) => {
  prismaLogger.error(e);
});

// Handle connection
prisma.$connect()
  .then(() => {
    prismaLogger.info('Connected to database');
  })
  .catch((error) => {
    prismaLogger.error('Failed to connect to database:', error);
    process.exit(1);
  });