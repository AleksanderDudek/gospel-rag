"use client";

import { formatCost } from "@/lib/format";
import { CitationLinkifier } from "@/components/citations/CitationLinkifier";
import { ComparePanel } from "@/components/compare/ComparePanel";
import { PassagePanel } from "@/components/passage/PassagePanel";
import { StreamingIndicator } from "./StreamingIndicator";
import type { ActiveCitation } from "@/types/chat";
import type { ChatMessage } from "@/types/chat";
import type { ComparePayload, PassagePayload } from "@/types/api";

interface MessageBubbleProps {
  message: ChatMessage;
  onCitationClick: (c: ActiveCitation) => void;
}

export function MessageBubble({ message, onCitationClick }: MessageBubbleProps) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-sm text-primary-foreground">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] w-full">
        {message.kind === "compare" && message.payload ? (
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Side-by-side comparison</p>
            <ComparePanel payload={message.payload as ComparePayload} />
          </div>
        ) : message.kind === "passage" && message.payload ? (
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Passage view</p>
            <PassagePanel payload={message.payload as PassagePayload} />
          </div>
        ) : (
          <div className="rounded-2xl rounded-tl-sm bg-card px-4 py-3 text-sm">
            <CitationLinkifier
              content={message.content}
              citations={message.citations ?? []}
              onCitationClick={onCitationClick}
            />
            {message.isStreaming && <StreamingIndicator />}
          </div>
        )}

        {/* Cost/token footer */}
        {!message.isStreaming && (message.cost_usd != null || message.output_tokens != null) && (
          <p className="mt-1 px-1 text-[10px] text-muted-foreground/60">
            {message.output_tokens != null && `${message.output_tokens} tokens`}
            {message.cost_usd != null && ` · ${formatCost(message.cost_usd)}`}
          </p>
        )}
      </div>
    </div>
  );
}
