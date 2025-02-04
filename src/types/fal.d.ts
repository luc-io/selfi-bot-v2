declare module '@fal-ai/client' {
  export interface FalImage {
    url: string;
  }

  export interface FalResponse {
    images: FalImage[];
    seed: number;
    has_nsfw_concepts?: boolean[];
  }

  export interface FalClient {
    invoke<T>(model: string, params: any): Promise<T>;
  }

  const fal: FalClient;
  export default fal;
}