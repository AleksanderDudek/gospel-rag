"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createConversation } from "@/lib/api";

/**
 * /new — creates a conversation and redirects to /c/{id}.
 * Retries with backoff to handle Render free-tier cold starts (up to ~60s).
 */
export default function NewConversationPage() {
  const router = useRouter();
  const [hint, setHint] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Show "waking up" hint after 8 seconds
    const hintTimer = setTimeout(() => setHint(true), 8000);

    async function attempt(delay: number) {
      if (cancelled) return;
      try {
        const conv = await createConversation();
        if (!cancelled) router.replace(`/c/${conv.id}`);
      } catch {
        if (!cancelled) setTimeout(() => attempt(Math.min(delay * 1.5, 8000)), delay);
      }
    }

    void attempt(2000);

    return () => {
      cancelled = true;
      clearTimeout(hintTimer);
    };
  }, [router]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      {hint && (
        <p className="text-xs text-muted-foreground">
          Waking up the server&hellip; this takes ~30s on the free tier
        </p>
      )}
    </div>
  );
}
