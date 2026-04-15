"use client";

import { SLASH_COMMANDS, type SlashCommand } from "@/lib/slash-commands";
import { cn } from "@/lib/utils";

interface SlashCommandMenuProps {
  query: string;  // text typed after "/"
  onSelect: (command: SlashCommand) => void;
  activeIndex: number;
}

export function SlashCommandMenu({ query, onSelect, activeIndex }: SlashCommandMenuProps) {
  const filtered = SLASH_COMMANDS.filter(
    (cmd) => cmd.name.toLowerCase().includes(query.toLowerCase()),
  );

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full mb-1 left-0 right-0 z-20 overflow-hidden rounded-lg border border-border bg-card shadow-xl">
      {filtered.map((cmd, i) => (
        <button
          key={cmd.name}
          className={cn(
            "flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors hover:bg-accent",
            i === activeIndex && "bg-accent",
          )}
          onMouseDown={(e) => {
            e.preventDefault(); // Don't blur the textarea
            onSelect(cmd);
          }}
        >
          <span className="text-sm font-mono font-medium text-primary">{cmd.name}</span>
          <span className="text-xs text-muted-foreground">{cmd.description}</span>
          <span className="text-xs font-mono text-muted-foreground/70">{cmd.usage}</span>
        </button>
      ))}
    </div>
  );
}
