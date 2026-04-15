import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ChatPanel } from "@/components/chat/ChatPanel";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function fetchConversation(id: string) {
  const backendUrl = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8000";
  // Forward the session cookie so the backend can verify ownership.
  const cookieStore = await cookies();
  const session = cookieStore.get("gospel_rag_session");
  const cookieHeader = session ? `gospel_rag_session=${session.value}` : "";

  try {
    const res = await fetch(`${backendUrl}/conversations/${id}`, {
      cache: "no-store",
      headers: cookieHeader ? { Cookie: cookieHeader } : {},
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    return res.json();
  } catch {
    return null;
  }
}

export default async function ConversationPage({ params }: PageProps) {
  const { id } = await params;
  const data = await fetchConversation(id);

  if (!data) notFound();

  return <ChatPanel conversationId={id} initialData={data} />;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const data = await fetchConversation(id);
  return { title: data?.title ?? "Chat" };
}
