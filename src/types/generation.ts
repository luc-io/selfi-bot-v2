export interface GenerateImageParams {
  prompt: string;
  loras?: {
    path: string;  // Changed from weightsUrl to match the frontend
    scale: number;
  }[];
  imageSize?: string;
  numInferenceSteps?: number;
  seed?: number;
  guidanceScale?: number;
  numImages?: number;
  syncMode?: boolean;
  enableSafetyChecker?: boolean;
  outputFormat?: 'jpeg' | 'png';
}

export interface GenerationRequest {
  prompt: string;
  baseModelId: string;
  parameters: GenerateImageParams;
}

export interface GenerationResponse {
  images: {
    url: string;
    contentType: string;
  }[];
  seed: number;
  hasNsfwConcepts: boolean[];
}