"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageBubble } from "./MessageBubble";
import { EmptyState } from "./EmptyState";
import type { ActiveCitation, ChatMessage } from "@/types/chat";

interface MessageListProps {
  messages: ChatMessage[];
  onCitationClick: (c: ActiveCitation) => void;
  onSuggest: (text: string) => void;
}

export function MessageList({ messages, onCitationClick, onSuggest }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [following, setFollowing] = useState(true);

  // Auto-scroll when new tokens arrive
  useEffect(() => {
    if (following && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, following]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setFollowing(atBottom);
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-hidden">
        <EmptyState onSuggest={onSuggest} />
      </div>
    );
  }

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto px-4 py-6"
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} onCitationClick={onCitationClick} />
          ))}
        </div>
        <div ref={bottomRef} />
      </div>

      {/* Scroll-to-bottom button */}
      {!following && (
        <Button
          variant="secondary"
          size="icon"
          className="absolute bottom-4 right-4 h-8 w-8 rounded-full shadow-lg"
          onClick={() => {
            setFollowing(true);
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
