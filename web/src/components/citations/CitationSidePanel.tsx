"use client";

import { useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BOOK_NAMES, formatCitationLabel } from "@/lib/citations";
import type { ActiveCitation } from "@/types/chat";

interface CitationSidePanelProps {
  citation: ActiveCitation | null;
  onClose: () => void;
}

export function CitationSidePanel({ citation, onClose }: CitationSidePanelProps) {
  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape" && citation) onClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [citation, onClose]);

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

            {citation.text ? (
              <blockquote className="border-l-2 border-primary pl-4 text-sm italic leading-relaxed text-foreground">
                &ldquo;{citation.text}&rdquo;
              </blockquote>
            ) : (
              <p className="text-sm text-muted-foreground">
                Verse text not available in context.
              </p>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
