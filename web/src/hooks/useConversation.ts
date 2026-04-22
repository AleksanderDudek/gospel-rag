"use client";

import { useState, useEffect, useCallback } from "react";
import { getConversation } from "@/lib/api";
import type { ConversationWithMessages } from "@/types/api";

interface UseConversationResult {
  data: ConversationWithMessages | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useConversation(id: string): UseConversationResult {
  const [data, setData] = useState<ConversationWithMessages | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(() => {
    setIsLoading(true);
    setError(null);
    getConversation(id)
      .then(setData)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, isLoading, error, refetch: load };
}
