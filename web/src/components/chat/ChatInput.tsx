"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Send, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SlashCommandMenu } from "@/components/slash/SlashCommandMenu";
import { SLASH_COMMANDS, type SlashCommand } from "@/lib/slash-commands";

interface ChatInputProps {
  input: string;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export function ChatInput({
  input,
  onInputChange,
  onSubmit,
  onStop,
  isStreaming,
  disabled,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuIndex, setSlashMenuIndex] = useState(0);

  const showSlashMenu = slashMenuOpen && input.startsWith("/");
  const slashQuery = input.startsWith("/") ? input.slice(1).split(" ")[0] : "";

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    onInputChange(e);
    const val = e.target.value;
    if (val.startsWith("/") && !val.includes(" ")) {
      setSlashMenuOpen(true);
      setSlashMenuIndex(0);
    } else {
      setSlashMenuOpen(false);
    }

    // Auto-resize (max 6 rows)
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      const lineHeight = 24;
      const maxHeight = lineHeight * 6;
      ta.style.height = `${Math.min(ta.scrollHeight, maxHeight)}px`;
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (showSlashMenu) {
      const cmds = SLASH_COMMANDS.filter((c) =>
        c.name.toLowerCase().includes(slashQuery.toLowerCase()),
      );
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashMenuIndex((i) => (i + 1) % cmds.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashMenuIndex((i) => (i - 1 + cmds.length) % cmds.length);
        return;
      }
      if (e.key === "Tab" || e.key === "Enter") {
        const cmd = cmds[slashMenuIndex];
        if (cmd) {
          e.preventDefault();
          selectCommand(cmd);
          return;
        }
      }
      if (e.key === "Escape") {
        setSlashMenuOpen(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && input.trim()) {
        e.currentTarget.form?.requestSubmit();
      }
    }
  }

  function selectCommand(cmd: SlashCommand) {
    const syntheticEvent = {
      target: { value: `${cmd.name} ` },
    } as React.ChangeEvent<HTMLTextAreaElement>;
    onInputChange(syntheticEvent);
    setSlashMenuOpen(false);
    textareaRef.current?.focus();
  }

  return (
    <form onSubmit={onSubmit} className="relative w-full">
      {showSlashMenu && (
        <SlashCommandMenu
          query={slashQuery}
          onSelect={selectCommand}
          activeIndex={slashMenuIndex}
        />
      )}

      <div className="flex items-end gap-2 rounded-xl border border-border bg-card p-2 shadow-sm focus-within:ring-1 focus-within:ring-ring">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question, or type / for commands…"
          rows={1}
          disabled={disabled || isStreaming}
          className={cn(
            "flex-1 resize-none bg-transparent px-2 py-1 text-sm leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50",
          )}
          style={{ maxHeight: "144px", overflowY: "auto" }}
        />

        {isStreaming ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onStop}
            className="h-8 w-8 shrink-0"
            aria-label="Stop generation"
          >
            <Square className="h-4 w-4 fill-current" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            variant="ghost"
            disabled={!input.trim() || disabled}
            className="h-8 w-8 shrink-0"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </form>
  );
}
