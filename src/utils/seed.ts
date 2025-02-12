/**
 * Generates a 7-digit seed number for consistent image generation
 * @returns number - A random 7-digit number between 1000000 and 9999999
 */
export const generateFalSeed = (): number => {
  const min = 1000000; // 7 digits start
  const max = 9999999; // 7 digits end
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Validates if a number is a valid 7-digit seed
 * @param seed - Number to validate
 * @returns boolean - True if valid seed
 */
export const isValidSeed = (seed: number): boolean => {
  return seed >= 1000000 && seed <= 9999999;
};