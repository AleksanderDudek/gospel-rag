"use client";

import { formatCitationLabel } from "@/lib/citations";
import type { Citation } from "@/types/api";

interface CitationMarkerProps {
  citation: Citation;
  onClick: (citation: Citation) => void;
}

export function CitationMarker({ citation, onClick }: CitationMarkerProps) {
  return (
    <button
      onClick={() => onClick(citation)}
      className="mx-0.5 inline-flex items-center rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-primary transition-colors hover:bg-primary/20 hover:border-primary/50 focus:outline-none focus:ring-1 focus:ring-ring"
      title="Click to view verse text"
    >
      {formatCitationLabel(citation)}
    </button>
  );
}
