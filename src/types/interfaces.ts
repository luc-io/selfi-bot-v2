// Bot Session Types
export interface SessionData {
  stars?: number;
}

// API Request Types
export interface GenerationBody {
  prompt: string;
  negativePrompt?: string;
  loraId?: string;
  seed?: number;
}

export interface GenerationQuery {
  limit?: number;
  offset?: number;
}

// Payment Types
export interface PaymentInvoice {
  title: string;
  description: string;
  payload: string;
  currency: string;
  prices: Array<{ label: string; amount: number }>;
}