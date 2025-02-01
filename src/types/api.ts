export interface ParamsData {
  user_id: string;
  model: string;
  params: {
    image_size: string;
    num_inference_steps: number;
    seed: number;
    guidance_scale: number;
    num_images: number;
    sync_mode: boolean;
    enable_safety_checker: boolean;
    output_format: 'jpeg' | 'png';
  }
}