"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2, Pencil, Trash2 } from "lucide-react";
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
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const [renameOpen, setRenameOpen] = useState(false);
  const [titleInput, setTitleInput] = useState(conversation.title);
  const [renameLoading, setRenameLoading] = useState(false);
  const [renameError, setRenameError] = useState<Error | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<Error | null>(null);

  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  function handleRename() {
    if (!titleInput.trim()) return;
    setRenameLoading(true);
    setRenameError(null);
    onRename(conversation.id, titleInput.trim())
      .then(() => setRenameOpen(false))
      .catch((err: unknown) => {
        setRenameError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => setRenameLoading(false));
  }

  function handleDelete() {
    setDeleteLoading(true);
    setDeleteError(null);
    onDelete(conversation.id)
      .then(() => setDeleteOpen(false))
      .catch((err: unknown) => {
        setDeleteError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => setDeleteLoading(false));
  }

  return (
    <>
      <div
        className={cn(
          "group relative flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent",
          isActive && "bg-accent text-accent-foreground",
          isNavigating && "opacity-60",
        )}
        onClick={() => {
          if (isActive) return;
          setIsNavigating(true);
          router.push(`/c/${conversation.id}`);
        }}
        onMouseEnter={() => setShowMenu(true)}
        onMouseLeave={() => setShowMenu(false)}
      >
        <span className="flex-1 truncate text-sidebar-foreground">{conversation.title}</span>

        {isNavigating && (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
        )}

        {!isNavigating && showMenu && (
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
      <Dialog open={renameOpen} onOpenChange={(open) => { setRenameOpen(open); setRenameError(null); }}>
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
          {renameError && (
            <p className="text-xs text-destructive">{renameError.message}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={handleRename} disabled={renameLoading}>
              {renameLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Rename"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={(open) => { setDeleteOpen(open); setDeleteError(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete conversation?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete &ldquo;{conversation.title}&rdquo; and all its messages.
          </p>
          {deleteError && (
            <p className="text-xs text-destructive">{deleteError.message}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
