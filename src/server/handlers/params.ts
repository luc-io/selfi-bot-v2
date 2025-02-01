import { logger } from '../../lib/logger.js';
import { ParametersService } from '../../services/parameters.js';

export async function handleSaveParams(userId: string, model: any, params: any) {
  try {
    logger.debug({ userId, model, params }, 'Processing save parameters request');
    
    // Save parameters to database
    await ParametersService.saveParameters({
      userId,
      model,
      params
    });
    
    logger.info({ userId }, 'Parameters processed successfully');
  } catch (error) {
    logger.error({ error, userId }, 'Error processing parameters');
    throw error;
  }
}