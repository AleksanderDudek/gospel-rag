"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createConversation,
  deleteConversation,
  listConversations,
  renameConversation,
} from "@/lib/api";
import type { Conversation } from "@/types/api";

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const data = await listConversations();
      setConversations(data);
    } catch {
      // Silently ignore network errors (e.g. backend not yet ready)
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const create = useCallback(async (): Promise<Conversation> => {
    const conv = await createConversation();
    setConversations((prev) => [conv, ...prev]);
    return conv;
  }, []);

  const rename = useCallback(async (id: string, title: string) => {
    const updated = await renameConversation(id, title);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? updated : c)),
    );
  }, []);

  const remove = useCallback(async (id: string) => {
    // Optimistic remove
    setConversations((prev) => prev.filter((c) => c.id !== id));
    try {
      await deleteConversation(id);
    } catch {
      // Roll back on error
      await refetch();
    }
  }, [refetch]);

  return { conversations, loading, refetch, create, rename, remove };
}
