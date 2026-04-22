"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat, type Message } from "@ai-sdk/react";
import type { Citation, ComparePayload, PassagePayload } from "@/types/api";
import type { ChatMessage } from "@/types/chat";
import type { MessageRecord } from "@/types/api";

interface UseChatWithCitationsOptions {
  conversationId: string;
  initialDbMessages?: MessageRecord[];
  onMessagesChange?: () => void;
}

interface MessageMeta {
  citations?: Citation[];
  cost_usd?: number;
  input_tokens?: number;
  output_tokens?: number;
  kind?: "text" | "compare" | "passage";
  payload?: ComparePayload | PassagePayload;
}

function dbMsgToAiMsg(m: MessageRecord): Message {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: new Date(m.created_at),
  };
}

export function useChatWithCitations({
  conversationId,
  initialDbMessages = [],
  onMessagesChange,
}: UseChatWithCitationsOptions) {
  const metaRef = useRef<Map<string, MessageMeta>>(
    new Map(
      initialDbMessages.map((m) => [
        m.id,
        {
          citations: m.citations_json ?? undefined,
          cost_usd: m.cost_usd ?? undefined,
          input_tokens: m.input_tokens ?? undefined,
          output_tokens: m.output_tokens ?? undefined,
          kind: (m.kind as MessageMeta["kind"]) ?? "text",
          payload: (m.payload_json as ComparePayload | PassagePayload | undefined) ?? undefined,
        },
      ])
    )
  );
  const [lastCitations, setLastCitations] = useState<Citation[]>([]);

  const {
    messages: aiMessages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    status,
    stop,
    setMessages,
    data,
    error,
  } = useChat({
    api: `/api/proxy/conversations/${conversationId}/messages`,
    streamProtocol: "data",
    initialMessages: initialDbMessages.map(dbMsgToAiMsg),
    onFinish: () => {
      onMessagesChange?.();
    },
  });

  // Process data events sent by the backend (citations, compare/passage payloads)
  useEffect(() => {
    if (!data || data.length === 0) return;
    const latest = data[data.length - 1];
    if (!latest || typeof latest !== "object") return;

    const ev = latest as Record<string, unknown>;

    if ("citations" in ev) {
      // Regular RAG response: {citations, cost_usd, input_tokens, output_tokens, full_text}
      const citations = (ev["citations"] as Citation[]) ?? [];
      const costUsd = ev["cost_usd"] as number | undefined;
      const inputTokens = ev["input_tokens"] as number | undefined;
      const outputTokens = ev["output_tokens"] as number | undefined;

      setLastCitations(citations);

      // Attach to the last assistant message
      const lastAssistant = [...aiMessages].reverse().find((m) => m.role === "assistant");
      if (lastAssistant) {
        metaRef.current.set(lastAssistant.id, {
          citations,
          cost_usd: costUsd,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          kind: "text",
        });
      }
    } else if (ev["kind"] === "compare" || ev["kind"] === "passage") {
      // Slash command response
      const kind = ev["kind"] as "compare" | "passage";
      const payload = ev["payload"] as ComparePayload | PassagePayload;

      const lastAssistant = [...aiMessages].reverse().find((m) => m.role === "assistant");
      if (lastAssistant) {
        metaRef.current.set(lastAssistant.id, { kind, payload });
      }
    }
  }, [data, aiMessages]);

  // Merge AI SDK messages with meta into ChatMessage[]
  const chatMessages: ChatMessage[] = aiMessages.map((m) => {
    const meta = metaRef.current.get(m.id);
    const isLast = m === aiMessages[aiMessages.length - 1];
    return {
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      kind: meta?.kind ?? "text",
      payload: meta?.payload,
      citations: meta?.citations,
      cost_usd: meta?.cost_usd,
      input_tokens: meta?.input_tokens,
      output_tokens: meta?.output_tokens,
      isStreaming: status === "streaming" && m.role === "assistant" && isLast,
    };
  });

  // Sync DB messages back (called after onMessagesChange refetch)
  const syncFromDb = useCallback(
    (msgs: MessageRecord[]) => {
      for (const m of msgs) {
        const existing = metaRef.current.get(m.id) ?? {};
        metaRef.current.set(m.id, {
          ...existing,
          citations: m.citations_json ?? existing.citations,
          cost_usd: m.cost_usd ?? existing.cost_usd,
          input_tokens: m.input_tokens ?? existing.input_tokens,
          output_tokens: m.output_tokens ?? existing.output_tokens,
          kind: (m.kind as MessageMeta["kind"]) ?? existing.kind,
          payload:
            (m.payload_json as ComparePayload | PassagePayload | null | undefined) ??
            existing.payload,
        });
      }
      setMessages(msgs.map(dbMsgToAiMsg));
    },
    [setMessages],
  );

  const isGenerating = status === "submitted" || status === "streaming";

  return {
    chatMessages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    status,
    isGenerating,
    error,
    stop,
    lastCitations,
    syncFromDb,
  };
}
