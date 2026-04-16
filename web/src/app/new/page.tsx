"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createConversation, listConversations } from "@/lib/api";

type State = "loading" | "error";

export default function NewConversationPage() {
  const router = useRouter();
  const [state, setState] = useState<State>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setState("loading");
    setErrorMsg("");

    listConversations()
      .then((convs) => {
        if (convs.length > 0) {
          router.replace(`/c/${convs[0].id}`);
        } else {
          return createConversation().then((conv) => {
            router.replace(`/c/${conv.id}`);
          });
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setErrorMsg(msg);
        setState("error");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-sm text-destructive">Failed to connect to server.</p>
        <p className="max-w-xs text-center text-xs text-muted-foreground">
          {errorMsg}
        </p>
        <p className="text-xs text-muted-foreground">
          The server may be starting up — wait a moment then try again.
        </p>
        <button
          onClick={() => setState("loading")}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
