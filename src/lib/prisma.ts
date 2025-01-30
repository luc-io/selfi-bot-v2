import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'event',
      level: 'error',
    },
  ],
});

prisma.$on('query', (e: { query: string; duration: number }) => {
  logger.debug(
    {
      query: e.query,
      duration: `${e.duration}ms`,
    },
    'Prisma Query'
  );
});

prisma.$on('error', (e: { message: string; target: string[] }) => {
  logger.error(
    {
      message: e.message,
      target: e.target,
    },
    'Prisma Error'
  );
});

prisma
  .$connect()
  .then(() => {
    logger.info('Connected to database');
  })
  .catch((error: Error) => {
    logger.error({ error }, 'Failed to connect to database');
    process.exit(1);
  });

export { prisma };