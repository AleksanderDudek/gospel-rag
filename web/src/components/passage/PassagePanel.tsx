"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ParallelPassage, PassagePayload } from "@/types/api";

interface PassagePanelProps {
  payload: PassagePayload;
}

function ParallelBlock({ parallel }: { parallel: ParallelPassage }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border">
      <button
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-accent"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span>{parallel.book_name} — {parallel.reference}</span>
        <span className="ml-auto text-xs text-muted-foreground">{parallel.translation_id}</span>
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3 text-sm leading-relaxed">
          {parallel.verses.map((v) => (
            <p key={v.verse} className="mb-2">
              <sup className="mr-1 font-mono text-[10px] text-muted-foreground">{v.verse}</sup>
              {v.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function PassagePanel({ payload }: PassagePanelProps) {
  return (
    <div className="mt-2 space-y-4 overflow-hidden rounded-lg border border-border bg-card p-4">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          {payload.book_name} — {payload.reference}
        </h3>
        <p className="text-xs text-muted-foreground">{payload.translation_id}</p>
      </div>

      {/* Main passage */}
      <div className="text-sm leading-relaxed">
        {payload.verses.map((v) => (
          <p key={v.verse} className="mb-2">
            <sup className="mr-1 font-mono text-[10px] text-muted-foreground">{v.verse}</sup>
            {v.text}
          </p>
        ))}
      </div>

      {/* Parallels */}
      {payload.parallels.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Parallel accounts
          </p>
          <div className="space-y-2">
            {payload.parallels.map((p) => (
              <ParallelBlock key={p.reference} parallel={p} />
            ))}
          </div>
        </div>
      )}

      {/* Synthesis */}
      {payload.synthesis && (
        <div className="rounded-lg bg-primary/5 px-4 py-3 text-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">
            Synthesis
          </p>
          <p className="leading-relaxed text-foreground">{payload.synthesis}</p>
        </div>
      )}
    </div>
  );
}
