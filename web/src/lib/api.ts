/**
 * Typed API client. All requests go through /api/proxy/* which forwards
 * them to the backend and handles the session cookie transparently.
 */

import type { Conversation, ConversationWithMessages } from "@/types/api";

const BASE = "/api/proxy";

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown error");
    throw new Error(`API ${res.status}: ${text}`);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// ── Conversations ─────────────────────────────────────────────────────────────

export async function createConversation(): Promise<Conversation> {
  return apiFetch<Conversation>("/conversations", { method: "POST" });
}

export async function listConversations(): Promise<Conversation[]> {
  return apiFetch<Conversation[]>("/conversations");
}

export async function getConversation(id: string): Promise<ConversationWithMessages> {
  return apiFetch<ConversationWithMessages>(`/conversations/${id}`);
}

export async function renameConversation(id: string, title: string): Promise<Conversation> {
  return apiFetch<Conversation>(`/conversations/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export async function deleteConversation(id: string): Promise<void> {
  return apiFetch<void>(`/conversations/${id}`, { method: "DELETE" });
}
