// Previous imports remain same...

interface LoraConfig {
  config: {
    path: string;
    scale: number;
  };
  id: string;
  name: string;
  triggerWord: string;
}

// Rest of the code with no changes...

    validLoraConfigs = (await Promise.all(loraPromises))
      .filter((config): config is LoraConfig => config !== null);

    if (validLoraConfigs.length > 0) {
      requestParams.input.loras = validLoraConfigs.map(config => config.config);
      logger.info({ loras: validLoraConfigs }, 'Added LoRA configurations to request');
    }

// Rest of the file remains the same...
