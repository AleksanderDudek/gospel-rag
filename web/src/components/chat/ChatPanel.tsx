"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Menu } from "lucide-react";
import { getConversation } from "@/lib/api";
import { useConversation } from "@/hooks/useConversation";
import { useTitlePoller } from "@/hooks/useTitlePoller";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { CitationSidePanel } from "@/components/citations/CitationSidePanel";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { useChatWithCitations } from "@/hooks/useChatWithCitations";
import type { ActiveCitation } from "@/types/chat";

interface ChatPanelProps {
  conversationId: string;
}

export function ChatPanel({ conversationId }: ChatPanelProps) {
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeCitation, setActiveCitation] = useState<ActiveCitation | null>(null);

  const { data, isLoading, error, refetch } = useConversation(conversationId);

  const {
    chatMessages,
    input,
    handleInputChange,
    handleSubmit,
    status,
    isGenerating,
    stop,
    syncFromDb,
    setInput,
  } = useChatWithCitations({
    conversationId,
    onMessagesChange: () => {
      getConversation(conversationId)
        .then((fresh) => {
          setTitle(fresh.title);
          syncFromDb(fresh.messages);
        })
        .catch(() => {
          // title will update via poller on next tick
        });
    },
  });

  const { title, setTitle } = useTitlePoller({
    conversationId,
    initialTitle: data?.title ?? "Loading…",
    chatMessages,
  });

  // Seed messages once when conversation data first loads
  const seeded = useRef(false);
  useEffect(() => {
    if (data && !seeded.current) {
      seeded.current = true;
      syncFromDb(data.messages);
    }
  }, [data, syncFromDb]);

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

  const handleSuggest = useCallback((text: string) => setInput(text), [setInput]);

  function renderMessages() {
    if (isLoading) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-sm text-muted-foreground">Failed to load conversation</p>
          <Button variant="outline" size="sm" onClick={refetch}>
            Try again
          </Button>
        </div>
      );
    }
    return (
      <MessageList
        messages={chatMessages}
        onCitationClick={(c) => setActiveCitation(c)}
        onSuggest={handleSuggest}
        isAwaiting={status === "submitted"}
      />
    );
  }

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
      {renderMessages()}

      {/* Input */}
      <div className="border-t border-border bg-background px-4 py-3">
        <div className="mx-auto max-w-2xl">
          <ChatInput
            input={input}
            onInputChange={handleInputChange}
            onSubmit={handleSubmit}
            onStop={stop}
            isStreaming={isGenerating}
            disabled={isLoading || !!error}
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
