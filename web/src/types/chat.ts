import type { Citation, ComparePayload, PassagePayload } from "./api";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  kind: "text" | "compare" | "passage";
  payload?: ComparePayload | PassagePayload;
  citations?: Citation[];
  cost_usd?: number | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  created_at?: string;
  isStreaming?: boolean;
}

export interface ActiveCitation extends Citation {
  messageId?: string;
}
