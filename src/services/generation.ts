...  // Previous imports and types remain the same

  // Handle seed - generate new only if not provided or 0
  let seed = params.seed;
  if (seed === undefined || seed === null || seed === 0) {
    seed = generateFalSeed();
    logger.info({ originalSeed: params.seed, generatedSeed: seed }, 'Generated new seed for request');
  }
  
  const requestParams: FalRequestParams = {
    input: {
      prompt: params.prompt,
      image_size: params.imageSize ?? 'square',
      num_inference_steps: params.numInferenceSteps ?? 28,
      seed: seed,  // Always pass a valid seed
      guidance_scale: params.guidanceScale ?? 3.5,
      num_images: numImages,
      enable_safety_checker: params.enableSafetyChecker ?? true,
      output_format: params.outputFormat ?? 'jpeg'
    },
    logs: true
  };

... // Rest of the file remains the same