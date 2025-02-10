const MAX_SEED = 9999999; // 7 digits

export function compressLongSeed(seed: number): number {
  return Math.abs(seed) % MAX_SEED;
}

export function isCompressedSeed(seed: number): boolean {
  return seed <= MAX_SEED;
}

export function expandCompressedSeed(seed: number): number {
  return isCompressedSeed(seed) ? seed + (MAX_SEED + 1) : seed;
}

export function generateFalSeed(): number {
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
}