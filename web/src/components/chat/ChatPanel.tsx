"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, Pencil } from "lucide-react";
import { getConversation } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { CitationSidePanel } from "@/components/citations/CitationSidePanel";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { useChatWithCitations } from "@/hooks/useChatWithCitations";
import type { ActiveCitation } from "@/types/chat";
import type { ConversationWithMessages } from "@/types/api";

interface ChatPanelProps {
  conversationId: string;
  initialData: ConversationWithMessages;
}

export function ChatPanel({ conversationId, initialData }: ChatPanelProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialData.title);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeCitation, setActiveCitation] = useState<ActiveCitation | null>(null);

  const {
    chatMessages,
    input,
    handleInputChange,
    handleSubmit,
    status,
    stop,
    syncFromDb,
    setInput,
  } = useChatWithCitations({
    conversationId,
    initialDbMessages: initialData.messages,
    onMessagesChange: async () => {
      // After streaming, refetch from DB to get canonical version with citations
      try {
        const fresh = await getConversation(conversationId);
        setTitle(fresh.title);
        syncFromDb(fresh.messages);
      } catch {
        // Backend may have been slow; title will update on next poll
      }
    },
  });

  // Poll for title update after first message (auto-titling is async)
  useEffect(() => {
    if (title !== "New chat") return;
    const hasUserMessage = chatMessages.some((m) => m.role === "user");
    if (!hasUserMessage) return;

    const timer = setInterval(async () => {
      try {
        const fresh = await getConversation(conversationId);
        if (fresh.title !== "New chat") {
          setTitle(fresh.title);
          clearInterval(timer);
        }
      } catch {
        clearInterval(timer);
      }
    }, 2000);

    return () => clearInterval(timer);
  }, [conversationId, title, chatMessages]);

  // ⌘K / Ctrl+K → new chat
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        router.push("/new");
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);

  const handleSuggest = useCallback((text: string) => {
    setInput(text);
  }, [setInput]);

  const isStreaming = status === "streaming";

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileSidebarOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="flex-1 truncate text-sm font-medium text-foreground">{title}</h1>
      </header>

      {/* Messages */}
      <MessageList
        messages={chatMessages}
        onCitationClick={(c) => setActiveCitation(c)}
        onSuggest={handleSuggest}
      />

      {/* Input */}
      <div className="border-t border-border bg-background px-4 py-3">
        <div className="mx-auto max-w-2xl">
          <ChatInput
            input={input}
            onInputChange={handleInputChange}
            onSubmit={handleSubmit}
            onStop={stop}
            isStreaming={isStreaming}
          />
          <p className="mt-2 text-center text-[10px] text-muted-foreground/50">
            Answers are grounded in scripture · Verify important claims
          </p>
        </div>
      </div>

      {/* Citation side panel */}
      <CitationSidePanel
        citation={activeCitation}
        onClose={() => setActiveCitation(null)}
      />

      {/* Mobile sidebar sheet */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <Sidebar />
        </SheetContent>
      </Sheet>
    </div>
  );
}
