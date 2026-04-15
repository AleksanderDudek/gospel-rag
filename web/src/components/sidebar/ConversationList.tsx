"use client";

import { useParams } from "next/navigation";
import { groupByDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { ConversationItem } from "./ConversationItem";
import type { Conversation } from "@/types/api";

interface ConversationListProps {
  conversations: Conversation[];
  loading: boolean;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function ConversationList({
  conversations,
  loading,
  onRename,
  onDelete,
}: ConversationListProps) {
  const params = useParams();
  const activeId = params?.id as string | undefined;

  if (loading) {
    return (
      <div className="flex flex-col gap-1 p-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <p className="px-3 py-4 text-xs text-muted-foreground">No conversations yet.</p>
    );
  }

  const groups = groupByDate(conversations);

  return (
    <div className="flex flex-col gap-1 px-2 py-1">
      {groups.map(({ label, items }) => (
        <div key={label}>
          <p className="mb-1 mt-3 px-1 text-xs font-medium text-muted-foreground first:mt-1">
            {label}
          </p>
          {items.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === activeId}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
