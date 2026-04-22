"use client";

import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { createConversation } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function NewChatButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  function handleNew() {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    createConversation()
      .then((conv) => {
        router.push(`/c/${conv.id}`);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => setIsLoading(false));
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        onClick={handleNew}
        disabled={isLoading}
        className="w-full justify-start gap-2"
        variant="ghost"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        New chat
      </Button>
      {error && (
        <p className="px-2 text-xs text-destructive">{error.message}</p>
      )}
    </div>
  );
}
