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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<Error | null>(null);

  const refetch = useCallback(() => {
    setIsLoading(true);
    setError(null);
    listConversations()
      .then(setConversations)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const create = useCallback((): Promise<Conversation> => {
    setIsCreating(true);
    setCreateError(null);
    return createConversation()
      .then((conv) => {
        setConversations((prev) => [conv, ...prev]);
        return conv;
      })
      .catch((err: unknown) => {
        const e = err instanceof Error ? err : new Error(String(err));
        setCreateError(e);
        throw e;
      })
      .finally(() => setIsCreating(false));
  }, []);

  const rename = useCallback((id: string, title: string): Promise<void> => {
    return renameConversation(id, title).then((updated) => {
      setConversations((prev) => prev.map((c) => (c.id === id ? updated : c)));
    });
  }, []);

  const remove = useCallback(
    (id: string): Promise<void> => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      return deleteConversation(id).catch(() => {
        // Roll back optimistic delete on failure
        refetch();
      });
    },
    [refetch],
  );

  return {
    conversations,
    isLoading,
    error,
    refetch,
    create,
    isCreating,
    createError,
    rename,
    remove,
  };
}
