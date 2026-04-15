import type { ComparePayload } from "@/types/api";

interface ComparePanelProps {
  payload: ComparePayload;
}

export function ComparePanel({ payload }: ComparePanelProps) {
  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border bg-muted/50 px-4 py-2">
        <h3 className="text-sm font-semibold text-foreground">
          {payload.book_name} — {payload.reference}
        </h3>
        <p className="text-xs text-muted-foreground">
          {payload.translations.map((t) => t.id).join(" · ")}
        </p>
      </div>

      {/* Horizontally scrollable translation columns */}
      <div className="overflow-x-auto">
        <div
          className="grid min-w-full"
          style={{ gridTemplateColumns: `repeat(${payload.translations.length}, minmax(200px, 1fr))` }}
        >
          {payload.translations.map((translation) => (
            <div
              key={translation.id}
              className="border-r border-border last:border-r-0"
            >
              {/* Translation header */}
              <div className="sticky top-0 border-b border-border bg-card px-4 py-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                  {translation.id}
                </span>
              </div>

              {/* Verses */}
              <div className="px-4 py-3 text-sm leading-relaxed">
                {translation.verses.length === 0 ? (
                  <p className="text-muted-foreground italic">Not available</p>
                ) : (
                  translation.verses.map((v) => (
                    <p key={v.verse} className="mb-2">
                      <sup className="mr-1 font-mono text-[10px] text-muted-foreground">
                        {v.verse}
                      </sup>
                      {v.text}
                    </p>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
