import { Loader2, Send } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Skeleton className="h-4 w-44" />
      </header>

      {/* Spinner */}
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>

      {/* Blocked input — mirrors ChatInput markup in disabled state */}
      <div className="border-t border-border bg-background px-4 py-3">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-end gap-2 rounded-xl border border-border bg-card p-2 shadow-sm opacity-50">
            <div className="flex-1 cursor-not-allowed px-2 py-1 text-sm leading-6 text-muted-foreground">
              Ask a question, or type / for commands…
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center">
              <Send className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground/50">
            Answers are grounded in scripture · Verify important claims
          </p>
        </div>
      </div>
    </div>
  );
}
