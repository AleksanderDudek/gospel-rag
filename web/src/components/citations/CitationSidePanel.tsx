"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BOOK_NAMES, formatCitationLabel } from "@/lib/citations";
import { useFetchVerse } from "@/hooks/useFetchVerse";
import type { ActiveCitation } from "@/types/chat";

interface CitationSidePanelProps {
  readonly citation: ActiveCitation | null;
  readonly onClose: () => void;
}

export function CitationSidePanel({ citation, onClose }: CitationSidePanelProps) {
  const { text, isLoading, error } = useFetchVerse(citation);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape" && citation) onClose();
    }
    globalThis.addEventListener("keydown", handler);
    return () => globalThis.removeEventListener("keydown", handler);
  }, [citation, onClose]);

  const displayText = citation?.text ?? text;

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

            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading verse…
              </div>
            )}
            {!isLoading && error && (
              <p className="text-sm text-destructive">{error.message}</p>
            )}
            {!isLoading && !error && displayText && (
              <blockquote className="border-l-2 border-primary pl-4 text-sm italic leading-relaxed text-foreground">
                &ldquo;{displayText}&rdquo;
              </blockquote>
            )}
            {!isLoading && !error && !displayText && (
              <p className="text-sm text-muted-foreground">Verse not found.</p>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
