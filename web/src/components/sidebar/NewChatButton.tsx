"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useState } from "react";
import { createConversation } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function NewChatButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleNew() {
    if (loading) return;
    setLoading(true);
    try {
      const conv = await createConversation();
      router.push(`/c/${conv.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={handleNew}
      disabled={loading}
      className="w-full justify-start gap-2"
      variant="ghost"
    >
      <Plus className="h-4 w-4" />
      New chat
    </Button>
  );
}
