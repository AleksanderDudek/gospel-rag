"use client";

import { useState, useEffect } from "react";
import type { ActiveCitation } from "@/types/chat";

interface UseFetchVerseResult {
  text: string | null;
  isLoading: boolean;
  error: Error | null;
}

export function useFetchVerse(citation: ActiveCitation | null): UseFetchVerseResult {
  const [text, setText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // If citation already carries the text, nothing to fetch
    if (!citation || citation.text) {
      setText(null);
      setError(null);
      return;
    }

    setText(null);
    setError(null);
    setIsLoading(true);

    const { book, chapter, verse_start, translation } = citation;
    fetch(`/api/proxy/verses/${book}/${chapter}/${verse_start}?translation=${translation}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { text?: string }) => setText(data.text ?? null))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => setIsLoading(false));
  }, [citation]);

  return { text, isLoading, error };
}
