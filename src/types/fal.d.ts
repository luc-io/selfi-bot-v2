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
    run(model: string, params: any): Promise<any>;
    subscribe(model: string, params: any): Promise<{ data: FalResponse, requestId: string }>;
    config: {
      (opts: { credentials: string }): void;
    };
    storage: {
      upload(file: Blob): Promise<string>;
    };
  }

  export const fal: FalClient;
}