"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createConversation } from "@/lib/api";

/**
 * /new — creates a conversation server-side and redirects to /c/{id}.
 * Rendered on the client because we need the session cookie to be sent.
 */
export default function NewConversationPage() {
  const router = useRouter();

  useEffect(() => {
    createConversation()
      .then((conv) => router.replace(`/c/${conv.id}`))
      .catch(() => {
        // Retry once after a brief delay (backend may be cold-starting on Render)
        setTimeout(() => {
          createConversation()
            .then((conv) => router.replace(`/c/${conv.id}`))
            .catch(console.error);
        }, 2000);
      });
  }, [router]);

  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
