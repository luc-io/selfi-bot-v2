import { promises as fs } from 'fs';
import { join } from 'path';
import { logger } from '../lib/logger.js';

const CONFIG_DIR = 'storage/config';

export interface UserConfig {
  model: any;
  params: any;
  updatedAt: string;
}

async function ensureConfigDir() {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
  } catch (error) {
    logger.error({ error }, 'Failed to create config directory');
    throw error;
  }
}

export async function saveUserConfig(userId: string, config: UserConfig) {
  try {
    await ensureConfigDir();
    const filePath = join(CONFIG_DIR, `${userId}.json`);
    await fs.writeFile(filePath, JSON.stringify(config, null, 2));
    logger.info({ userId, filePath }, 'User config saved');
  } catch (error) {
    logger.error({ error, userId }, 'Failed to save user config');
    throw error;
  }
}

export async function getUserConfig(userId: string): Promise<UserConfig | null> {
  try {
    const filePath = join(CONFIG_DIR, `${userId}.json`);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    logger.error({ error, userId }, 'Failed to read user config');
    throw error;
  }
}