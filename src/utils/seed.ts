import { createHash } from 'crypto';

export function compressLongSeed(seed: number): number {
  const hash = createHash('md5')
    .update(seed.toString())
    .digest('hex');
    
  // Extract last 7 digits
  const compressedSeed = parseInt(hash.slice(-7), 16) % 10000000;
  return compressedSeed;
}

export function generateFalSeed(): number {
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
}