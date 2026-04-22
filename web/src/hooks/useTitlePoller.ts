"use client";

import { useState, useEffect } from "react";
import { getConversation } from "@/lib/api";
import type { ChatMessage } from "@/types/chat";

interface UseTitlePollerOptions {
  conversationId: string;
  initialTitle: string;
  chatMessages: ChatMessage[];
}

interface UseTitlePollerResult {
  title: string;
  setTitle: (title: string) => void;
}

export function useTitlePoller({
  conversationId,
  initialTitle,
  chatMessages,
}: UseTitlePollerOptions): UseTitlePollerResult {
  const [title, setTitle] = useState(initialTitle);

  // Sync title when initial data loads (initialTitle changes from "Loading…" to real value)
  useEffect(() => {
    if (initialTitle && initialTitle !== "Loading…") {
      setTitle(initialTitle);
    }
  }, [initialTitle]);

  // Poll until auto-title resolves (backend generates it async after first message)
  useEffect(() => {
    if (title !== "New chat") return;
    const hasUserMessage = chatMessages.some((m) => m.role === "user");
    if (!hasUserMessage) return;

    const timer = setInterval(() => {
      getConversation(conversationId)
        .then((fresh) => {
          if (fresh.title !== "New chat") {
            setTitle(fresh.title);
            clearInterval(timer);
          }
        })
        .catch(() => clearInterval(timer));
    }, 2000);

    return () => clearInterval(timer);
  }, [conversationId, title, chatMessages]);

  return { title, setTitle };
}
