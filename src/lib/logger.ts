import pino from 'pino';

const loggerOpts = {
  level: process.env.LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime
};

export const logger = pino(loggerOpts);