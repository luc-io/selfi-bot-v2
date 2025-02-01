export interface GenerationParams {
  image_size: 'landscape_4_3' | 'portrait_4_3' | 'square' | { width: number; height: number };
  num_inference_steps: number;
  guidance_scale: number;
  num_images: number;
  sync_mode?: boolean;
  enable_safety_checker: boolean;
  output_format?: 'jpeg' | 'png';
}

export interface ModelConfig {
  id: string;
  name: string;
  type: string;
}

export interface UserParameters {
  model: ModelConfig;
  params: GenerationParams;
}