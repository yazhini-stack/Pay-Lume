import { ChatWorkspace } from "@/components/chat/ChatWorkspace";

interface ConversationPageProps {
  params: Promise<{
    conversationId: string;
  }>;
}

export default async function ConversationPage({ params }: ConversationPageProps) {
  const resolvedParams = await params;
  return <ChatWorkspace initialConversationId={resolvedParams.conversationId} />;
}
