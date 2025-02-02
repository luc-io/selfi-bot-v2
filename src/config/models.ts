export const MODELS = {
  'fal.ai/fal-ai/flux-lora': {
    displayName: 'Flux',
    cost: 1,
    isDefault: true
  },
  'fal.ai/fal-ai/flux-pro/v1.1-ultra-finetuned': {
    displayName: 'Flux Pro',
    cost: 2,
  },
  'replicate.com/black-forest-labs/flux-schnell-lora': {
    displayName: 'Flux Schnell',
    cost: 1,
  }
} as const;

export const DEFAULT_MODEL = Object.entries(MODELS).find(([_, config]) => config.isDefault)?.[0] || 'fal.ai/fal-ai/flux-lora';