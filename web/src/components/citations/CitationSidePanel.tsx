"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BOOK_NAMES, formatCitationLabel } from "@/lib/citations";
import type { ActiveCitation } from "@/types/chat";

interface CitationSidePanelProps {
  readonly citation: ActiveCitation | null;
  readonly onClose: () => void;
}

export function CitationSidePanel({ citation, onClose }: CitationSidePanelProps) {
  const [fetchedText, setFetchedText] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape" && citation) onClose();
    }
    globalThis.addEventListener("keydown", handler);
    return () => globalThis.removeEventListener("keydown", handler);
  }, [citation, onClose]);

  // Fetch verse text from backend when citation has no stored text
  useEffect(() => {
    if (!citation || citation.text) {
      setFetchedText(null);
      return;
    }
    setFetchedText(null);
    setFetching(true);
    const { book, chapter, verse_start, translation } = citation;
    fetch(
      `/api/proxy/verses/${book}/${chapter}/${verse_start}?translation=${translation}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setFetchedText(data?.text ?? ""))
      .catch(() => setFetchedText(""))
      .finally(() => setFetching(false));
  }, [citation]);

  const displayText = citation?.text || fetchedText;

  return (
    <Sheet open={!!citation} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-80 max-w-full overflow-y-auto">
        {citation && (
          <>
            <SheetHeader className="mb-4">
              <SheetTitle className="text-base font-mono">
                {formatCitationLabel(citation)}
              </SheetTitle>
              <p className="text-xs text-muted-foreground">
                {BOOK_NAMES[citation.book] ?? citation.book} · {citation.translation}
              </p>
            </SheetHeader>

            {fetching && (
              <p className="text-sm text-muted-foreground animate-pulse">Loading verse…</p>
            )}
            {!fetching && displayText && (
              <blockquote className="border-l-2 border-primary pl-4 text-sm italic leading-relaxed text-foreground">
                &ldquo;{displayText}&rdquo;
              </blockquote>
            )}
            {!fetching && !displayText && (
              <p className="text-sm text-muted-foreground">Verse not found.</p>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
