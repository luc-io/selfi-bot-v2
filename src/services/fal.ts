import { logger } from '../logger';
import { FalError } from '../errors';

interface FalQueueResponse {
  status: string;
  request_id: string;
  response_url: string;
  status_url: string;
  cancel_url: string;
  logs: any[];
  metrics: {
    inference_time?: number;
  };
}

interface FalGenerationResponse {
  images: Array<{
    url: string;
    content_type: string;
    width?: number;
    height?: number;
  }>;
  seed: number;
  has_nsfw_concepts: boolean[];
  prompt: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

export class FalService {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://queue.fal.run/fal-ai/flux-lora';
  }

  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private validateResponse(response: any): response is FalGenerationResponse {
    try {
      if (!response || typeof response !== 'object') {
        logger.warn({ response }, 'Invalid response format - not an object');
        return false;
      }
      if (!Array.isArray(response.images)) {
        logger.warn({ response }, 'Invalid response format - images not an array');
        return false;
      }
      if (!response.images.length) {
        logger.warn({ response }, 'Invalid response format - images array empty');
        return false;
      }
      if (!response.images[0].url || typeof response.images[0].url !== 'string') {
        logger.warn({ response }, 'Invalid response format - image URL missing or invalid');
        return false;
      }
      return true;
    } catch (error) {
      logger.error({ error, response }, 'Error validating response');
      return false;
    }
  }

  public async generateImage(prompt: string, negativePrompt?: string): Promise<string> {
    let retries = 0;
    
    while (retries < MAX_RETRIES) {
      try {
        // Initial request to queue
        const queueResponse = await fetch(`${this.baseUrl}/requests`, {
          method: 'POST',
          headers: {
            'Authorization': `Key ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: {
              prompt,
              negative_prompt: negativePrompt,
              image_size: "512x512",
              num_inference_steps: 28,
              guidance_scale: 3.5,
              seed: Math.floor(Math.random() * 1000000),
              num_images: 1
            }
          }),
        });

        if (!queueResponse.ok) {
          const error = await queueResponse.text();
          throw new FalError(`Queue request failed: ${error}`);
        }

        const queueData = await queueResponse.json() as FalQueueResponse;
        logger.info({ queue: queueData }, 'Generation queue update');

        // Poll for completion
        let attempts = 0;
        while (attempts < 30) { // 30 attempts * 2 seconds = 1 minute timeout
          const statusResponse = await fetch(queueData.status_url, {
            headers: {
              'Authorization': `Key ${this.apiKey}`,
            },
          });

          if (!statusResponse.ok) {
            const error = await statusResponse.text();
            throw new FalError(`Status check failed: ${error}`);
          }

          const statusData = await statusResponse.json() as FalQueueResponse;
          logger.info({ queue: statusData }, 'Generation queue update');

          if (statusData.status === 'COMPLETED') {
            // Fetch the result
            const resultResponse = await fetch(queueData.response_url, {
              headers: {
                'Authorization': `Key ${this.apiKey}`,
              },
            });

            if (!resultResponse.ok) {
              const error = await resultResponse.text();
              throw new FalError(`Result fetch failed: ${error}`);
            }

            const result = await resultResponse.json();
            logger.info({ result }, 'Generation result received');
            
            if (!this.validateResponse(result)) {
              throw new FalError('Invalid response format from FAL API');
            }

            logger.info('Generation completed successfully');
            return result.images[0].url;
          }

          if (statusData.status === 'FAILED') {
            throw new FalError('Generation failed: ' + (statusData.logs?.join(', ') || 'Unknown error'));
          }

          await this.wait(2000); // Wait 2 seconds before next check
          attempts++;
        }

        throw new FalError('Generation timed out');
      } catch (error) {
        if (retries === MAX_RETRIES - 1) {
          logger.error({ error }, 'Generation failed after all retries');
          throw error;
        }
        
        logger.warn({ error, retry: retries + 1 }, 'Generation failed, retrying...');
        retries++;
        await this.wait(RETRY_DELAY);
      }
    }

    throw new FalError('Generation failed after max retries');
  }
}