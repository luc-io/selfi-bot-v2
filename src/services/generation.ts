// ... earlier imports remain the same

export class GenerationService {
  static async generate(telegramId: string, options: GenerationOptions) {
    const { prompt, negativePrompt, loraPath, loraScale = 0.8, seed } = options;

    try {
      // First check user's stars balance using telegramId
      const user = await prisma.user.findUnique({
        where: { telegramId },
        select: {
          id: true,
          stars: true,
          telegramId: true
        }
      });

      if (!user || user.stars < 1) {
        throw new Error('Insufficient stars balance');
      }

      let generatedImageUrl: string | null = null;
      let falRequestId: string | null = null;

      try {
        // Generate image using flux-lora model
        const falResult = await fal.subscribe('fal-ai/flux-lora', {
          input: {
            prompt,
            negative_prompt: negativePrompt,
            lora_path: loraPath,
            lora_scale: loraScale,
            seed,
            image_size: 'landscape_4_3',
            num_inference_steps: 28,
            guidance_scale: 3.5,
          } as FalRequest,
          pollInterval: 1000,
          logs: true,
          onQueueUpdate: (update: { status: string; position?: number }) => {
            logger.info({ 
              status: update.status,
              position: update.position,
              prompt,
              telegramId: user.telegramId  // Changed from userId
            }, 'Generation queue update');
          },
        });

        // Log the full FAL response
        logger.info({ 
          falResponse: falResult,
          prompt,
          telegramId: user.telegramId  // Changed from userId
        }, 'FAL API Response');

        const response = falResult as unknown as FalResponse;
        falRequestId = response.requestId;
        
        if (!response?.data?.images?.length) {
          throw new Error('No images in response');
        }

        generatedImageUrl = response.data.images[0].url;

        // Get or create the base model
        let baseModel = await prisma.baseModel.findFirst({
          where: {
            modelPath: 'fal-ai/flux-lora'
          }
        });

        if (!baseModel) {
          baseModel = await prisma.baseModel.create({
            data: {
              modelPath: 'fal-ai/flux-lora',
              costPerGeneration: 1
            }
          });
        }

        // Update database only if we have a valid image
        if (generatedImageUrl) {
          await prisma.user.update({
            where: { telegramId },
            data: {
              stars: { decrement: 1 },
              generations: {
                create: {
                  baseModelId: baseModel.id,
                  prompt,
                  negativePrompt,
                  imageUrl: generatedImageUrl,
                  seed: seed ? BigInt(seed) : null,
                  starsUsed: 1,
                  metadata: {
                    falRequestId,
                    inferenceTime: response.data.timings?.inference,
                    hasNsfw: response.data.has_nsfw_concepts?.[0] || false
                  }
                }
              }
            }
          });

          logger.info({ 
            imageUrl: generatedImageUrl,
            prompt,
            falRequestId,
            timing: response.data.timings?.inference,
            telegramId: user.telegramId  // Changed from userId
          }, 'Generation succeeded');

          return { imageUrl: generatedImageUrl };
        } else {
          throw new Error('Failed to get image URL from response');
        }

      } catch (falError: any) {
        logger.error({ 
          error: falError.message,
          prompt,
          falRequestId,
          telegramId: user.telegramId  // Changed from userId
        }, 'FAL API Error');
        throw new Error(`Image generation failed: ${falError.message}`);
      }

    } catch (e: any) {
      const errorMessage = e.message || 'Unknown error';
      logger.error({ 
        error: errorMessage,
        prompt,
        telegramId  // Changed from userId
      }, 'Generation failed');
      throw new Error('Generation failed: ' + errorMessage);
    }
  }
}