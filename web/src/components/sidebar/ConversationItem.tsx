"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Conversation } from "@/types/api";

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function ConversationItem({
  conversation,
  isActive,
  onRename,
  onDelete,
}: ConversationItemProps) {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [titleInput, setTitleInput] = useState(conversation.title);
  const [busy, setBusy] = useState(false);

  async function handleRename() {
    if (!titleInput.trim()) return;
    setBusy(true);
    await onRename(conversation.id, titleInput.trim());
    setRenameOpen(false);
    setBusy(false);
  }

  async function handleDelete() {
    setBusy(true);
    await onDelete(conversation.id);
    setDeleteOpen(false);
    setBusy(false);
  }

  return (
    <>
      <div
        className={cn(
          "group relative flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent",
          isActive && "bg-accent text-accent-foreground",
        )}
        onClick={() => router.push(`/c/${conversation.id}`)}
        onMouseEnter={() => setShowMenu(true)}
        onMouseLeave={() => setShowMenu(false)}
      >
        <span className="flex-1 truncate text-sidebar-foreground">{conversation.title}</span>

        {showMenu && (
          <div
            className="flex items-center gap-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => { setRenameOpen(true); setShowMenu(false); }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:text-destructive"
              onClick={() => { setDeleteOpen(true); setShowMenu(false); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename conversation</DialogTitle>
          </DialogHeader>
          <Input
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={handleRename} disabled={busy}>Rename</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete conversation?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete &ldquo;{conversation.title}&rdquo; and all its messages.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={busy}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
