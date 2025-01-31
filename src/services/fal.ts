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
      logger.info({ raw_response: response }, 'Validating FAL response');

      if (!response || typeof response !== 'object') {
        logger.warn({ response }, 'Invalid response format - not an object');
        return false;
      }

      // Check for direct image URL in response (some FAL endpoints return this way)
      if (typeof response.url === 'string') {
        logger.info('Response contains direct image URL');
        return true;
      }

      // Check for array of image URLs
      if (Array.isArray(response.images)) {
        logger.info({ images: response.images }, 'Response contains images array');
        if (response.images.length > 0) {
          const firstImage = response.images[0];
          if (typeof firstImage === 'string') {
            return true;
          }
          if (typeof firstImage === 'object' && typeof firstImage.url === 'string') {
            return true;
          }
        }
        logger.warn('Images array is empty or invalid');
        return false;
      }

      // Check for new FAL format with 'image' property
      if (response.image && typeof response.image === 'object') {
        logger.info({ image: response.image }, 'Response contains image object');
        if (typeof response.image.url === 'string') {
          return true;
        }
      }

      logger.warn({ response }, 'No valid image format found in response');
      return false;
    } catch (error) {
      logger.error({ error, response }, 'Error validating response');
      return false;
    }
  }

  private getImageUrlFromResponse(response: any): string {
    if (typeof response.url === 'string') {
      return response.url;
    }
    if (Array.isArray(response.images)) {
      const firstImage = response.images[0];
      if (typeof firstImage === 'string') {
        return firstImage;
      }
      if (typeof firstImage === 'object' && typeof firstImage.url === 'string') {
        return firstImage.url;
      }
    }
    if (response.image && typeof response.image.url === 'string') {
      return response.image.url;
    }
    throw new FalError('Could not find image URL in response');
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

            const imageUrl = this.getImageUrlFromResponse(result);
            logger.info({ imageUrl }, 'Successfully extracted image URL');
            return imageUrl;
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