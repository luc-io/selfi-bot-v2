import { createHash } from 'crypto';

const MAX_SEED = 9999999; // 7 digits

export function compressLongSeed(seed: number): number {
  return Math.abs(seed) % MAX_SEED;
}

export function generateFalSeed(): number {
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
}