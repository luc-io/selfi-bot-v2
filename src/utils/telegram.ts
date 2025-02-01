import { Context } from 'grammy';
import { randomUUID } from 'crypto';

export const getTelegramId = (id: number | string): bigint => {
  return BigInt(id);
};

export const ensureFrom = (ctx: Context) => {
  if (!ctx.from) {
    throw new Error('Context must have from field');
  }
  return ctx.from;
};