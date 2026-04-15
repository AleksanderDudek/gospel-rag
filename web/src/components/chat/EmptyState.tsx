"use client";

import { BookOpen } from "lucide-react";

const SUGGESTIONS = [
  "Who carried Jesus's cross?",
  "/compare MAT 5:3-12 KJV WEB YLT",
  "/passage MAT 14:13-21 --parallels --synthesize",
];

interface EmptyStateProps {
  onSuggest: (text: string) => void;
}

export function EmptyState({ onSuggest }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <BookOpen className="h-7 w-7 text-primary" />
      </div>

      <div>
        <h2 className="mb-1 text-lg font-semibold">Ask about the four Gospels</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Ask a question to get a grounded answer with inline verse citations.
          Use slash commands for structured views.
        </p>
      </div>

      <div className="flex flex-col gap-2 w-full max-w-sm">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSuggest(s)}
            className="rounded-lg border border-border bg-card px-4 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
