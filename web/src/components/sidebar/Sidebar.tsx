"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import { useConversations } from "@/hooks/useConversations";
import { ConversationList } from "./ConversationList";
import { NewChatButton } from "./NewChatButton";

export function Sidebar() {
  const { conversations, loading, rename, remove } = useConversations();

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-4">
        <BookOpen className="h-5 w-5 text-primary" />
        <span className="text-sm font-semibold text-sidebar-foreground">
          {process.env.NEXT_PUBLIC_APP_NAME ?? "Gospel RAG"}
        </span>
      </div>

      {/* New chat */}
      <div className="px-2 pb-2">
        <NewChatButton />
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        <ConversationList
          conversations={conversations}
          loading={loading}
          onRename={rename}
          onDelete={remove}
        />
      </div>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Built with{" "}
          <Link
            href="https://docs.anthropic.com"
            target="_blank"
            className="underline hover:text-foreground"
          >
            Claude
          </Link>{" "}
          &amp; pgvector ·{" "}
          <Link
            href="https://github.com"
            target="_blank"
            className="underline hover:text-foreground"
          >
            GitHub
          </Link>
        </p>
      </div>
    </aside>
  );
}
