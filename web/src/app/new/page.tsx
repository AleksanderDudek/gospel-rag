"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createConversation, listConversations } from "@/lib/api";

/**
 * /new — smart landing page:
 *   1. Fetch existing conversations.
 *   2. If any exist → redirect to the most recent one.
 *   3. If none → create a new one and redirect.
 * Retries with backoff to handle Render free-tier cold starts (~30–60 s).
 */
export default function NewConversationPage() {
  const router = useRouter();
  const [hint, setHint] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const hintTimer = setTimeout(() => setHint(true), 8000);

    async function run(backoff: number): Promise<void> {
      if (cancelled) return;
      try {
        const convs = await listConversations();
        if (cancelled) return;
        if (convs.length > 0) {
          router.replace(`/c/${convs[0].id}`);
        } else {
          const conv = await createConversation();
          if (!cancelled) router.replace(`/c/${conv.id}`);
        }
      } catch {
        if (!cancelled) {
          setTimeout(() => run(Math.min(backoff * 1.5, 10_000)), backoff);
        }
      }
    }

    void run(2000);

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
