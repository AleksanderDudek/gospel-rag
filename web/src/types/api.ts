/** Mirror of backend Pydantic schemas */

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Citation {
  book: string;
  chapter: number;
  verse_start: number;
  verse_end: number;
  translation: string;
  text: string;
}

export interface MessageRecord {
  id: string;
  role: "user" | "assistant";
  content: string;
  kind: "text" | "compare" | "passage";
  payload_json: ComparePayload | PassagePayload | null;
  citations_json: Citation[] | null;
  cost_usd: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
}

export interface ConversationWithMessages extends Conversation {
  messages: MessageRecord[];
}

// ── Compare ──────────────────────────────────────────────────────────────────

export interface VerseData {
  verse: number;
  text: string;
}

export interface TranslationData {
  id: string;
  verses: VerseData[];
}

export interface ComparePayload {
  reference: string;
  book_name: string;
  translations: TranslationData[];
}

// ── Passage ───────────────────────────────────────────────────────────────────

export interface ParallelPassage {
  reference: string;
  book_name: string;
  translation_id: string;
  verses: VerseData[];
}

export interface PassagePayload {
  reference: string;
  book_name: string;
  translation_id: string;
  verses: VerseData[];
  parallels: ParallelPassage[];
  synthesis: string | null;
}
