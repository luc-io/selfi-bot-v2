import { logger } from '../../lib/logger.js';
import { saveUserConfig } from '../../storage/config.js';

export async function handleSaveParams(user_id: string, model: any, params: any) {
  try {
    logger.debug({ user_id, model, params }, 'Processing save parameters request');
    
    // Save to user config
    await saveUserConfig(user_id, {
      model,
      params,
      updatedAt: new Date().toISOString()
    });
    
    logger.info({ user_id }, 'Parameters processed successfully');
  } catch (error) {
    logger.error({ error, user_id }, 'Error processing parameters');
    throw error;
  }
}