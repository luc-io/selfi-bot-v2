type ModelConfig = {
  readonly displayName: string;
  readonly cost: number;
  readonly isDefault?: boolean;
};

export const MODELS: Record<string, ModelConfig> = {
  'fal.ai/fal-ai/flux-lora': { 
    displayName: "Flux", 
    cost: 1, 
    isDefault: true 
  },
  'fal.ai/fal-ai/flux-pro': { 
    displayName: "Flux Pro", 
    cost: 2,
    isDefault: false 
  },
  'fal.ai/fal-ai/flux-schnell': { 
    displayName: "Flux Schnell", 
    cost: 1,
    isDefault: false 
  }
};

export const DEFAULT_MODEL = Object.entries(MODELS).find(([_, config]) => config.isDefault)?.[0] || 'fal.ai/fal-ai/flux-lora';