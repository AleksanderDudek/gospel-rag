import { ChatPanel } from "@/components/chat/ChatPanel";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ConversationPage({ params }: PageProps) {
  const { id } = await params;
  return <ChatPanel conversationId={id} />;
}
