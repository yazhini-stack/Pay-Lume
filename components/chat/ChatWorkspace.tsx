"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Conversation, Message, Citation } from "@/types/chat";
import { useChatStore } from "@/lib/stores/useChatStore";
import { ConversationSidebar } from "./ConversationSidebar";
import { MessageThread } from "./MessageThread";
import { Composer } from "./Composer";
import { EvidencePanel } from "@/components/evidence/EvidencePanel";
import { AlreadyPaidModal } from "./AlreadyPaidModal";
import { 
  Shield, 
  PanelRightClose, 
  PanelRightOpen, 
  Menu,
  FileSearch,
  Sparkles,
  WifiOff
} from "lucide-react";
import { useRouter } from "next/navigation";
import { MOCK_PRELOADED_CONVERSATIONS } from "@/lib/api/mock/fixtures";
import { AuthGuard } from "@/components/auth/AuthGuard";

interface ChatWorkspaceProps {
  initialConversationId?: string;
}

export function ChatWorkspace({ initialConversationId }: ChatWorkspaceProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    activeConversationId,
    setActiveConversationId,
    activeEvidence,
    setActiveEvidence,
    isStreaming,
    setStreaming,
    setStreamingStatus,
    appendStreamingToken,
    addStreamingCitation,
    resetStreaming,
    setAbortController,
    setStreamError,
    isEvidencePanelOpen,
    toggleEvidencePanel,
    toggleSidebar,
    setStreamingSecurityEvidence,
    isAlreadyPaidModalOpen,
    closeAlreadyPaidModal,
    setPrefilledQuestion
  } = useChatStore();

  const [currentMessages, setCurrentMessages] = useState<Message[]>([]);

  // Fetch all conversations
  const { data: conversations = [], isLoading: isConvsLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => apiClient.getConversations()
  });

  const currentConvId = activeConversationId || initialConversationId;

  // Fetch or hydrate active conversation
  const { data: activeConv, isLoading: isConvLoading } = useQuery({
    queryKey: ["conversation", currentConvId],
    queryFn: () => (currentConvId ? apiClient.getConversation(currentConvId) : null),
    enabled: Boolean(currentConvId)
  });

  // Sync state when switching conversations via navigation
  useEffect(() => {
    if (initialConversationId) {
      setActiveConversationId(initialConversationId);
    } else {
      setActiveConversationId(null);
      setActiveEvidence(null);
      setCurrentMessages([]);
    }
  }, [initialConversationId, setActiveConversationId, setActiveEvidence]);

  // Sync loaded conversation messages when hydrating or switching
  useEffect(() => {
    if (activeConv && activeConv.id === currentConvId) {
      setActiveEvidence(activeConv.evidence, activeConv.evidence?.extractedContext);
      if (activeConv.messages && activeConv.messages.length > 0 && !isStreaming) {
        setCurrentMessages(activeConv.messages);
      }
    }
  }, [activeConv, currentConvId, isStreaming, setActiveEvidence]);

  // Handle selecting past conversation
  const handleSelectConversation = (id: string) => {
    router.push(`/chat/${id}`);
  };

  // Handle new chat
  const handleNewChat = () => {
    setActiveConversationId(null);
    setActiveEvidence(null);
    setCurrentMessages([]);
    resetStreaming();
    router.push("/chat");
  };

  // Handle deleting conversation
  const handleDeleteConversation = async (id: string) => {
    await apiClient.deleteConversation(id);
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    if (activeConversationId === id) {
      handleNewChat();
    }
  };

  // Handle loading sample evidence from empty state
  const handleSelectSample = (type: "qr" | "url" | "message" | "screenshot") => {
    const sample = apiClient.loadSampleConversation(type);
    if (sample) {
      setActiveConversationId(sample.id);
      setActiveEvidence(sample.evidence, sample.evidence?.extractedContext);
      setCurrentMessages(sample.messages || []);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["conversation", sample.id] });
      router.push(`/chat/${sample.id}`);
    }
  };

  // Handle sending a message and streaming the 3-section answer
  const handleSendMessage = async (question: string) => {
    if (!question.trim() || isStreaming) return;

    let convId = activeConversationId;

    // Create user message object
    const userMsg: Message = {
      id: `msg-user-${Date.now()}`,
      conversationId: convId || "new",
      role: "user",
      content: question,
      createdAt: new Date().toISOString()
    };

    setCurrentMessages((prev) => [...prev, userMsg]);

    // If no conversation exists yet, create one
    if (!convId) {
      try {
        const createRes = await apiClient.createConversation({
          evidenceId: activeEvidence?.id || `ev-auto-${Date.now()}`,
          evidencePayload: activeEvidence || {
            id: `ev-auto-${Date.now()}`,
            type: "message",
            title: question.slice(0, 32),
            rawText: question,
            createdAt: new Date().toISOString()
          },
          title: question.slice(0, 32)
        });
        convId = createRes.conversationId;
        setActiveConversationId(convId);
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
        window.history.replaceState(null, "", `/chat/${convId}`);
      } catch (err: any) {
        setStreamError(err.message || "Failed to initialize conversation.");
        return;
      }
    }

    // Set up SSE streaming
    resetStreaming();
    setStreamError(null);
    setStreaming(true);
    setStreamingStatus({ step: "extracting", message: "Initiating evidence analysis pipeline..." });

    const abortController = new AbortController();
    setAbortController(abortController);

    let accumulatedContent = "";
    const accumulatedCitations: Citation[] = [];
    let accumulatedEvidence: string[] = [];

    try {
      await apiClient.streamMessage(
        convId,
        question,
        (event) => {
          if (event.type === "status") {
            setStreamingStatus(event.data);
          } else if (event.type === "token") {
            accumulatedContent += event.data.delta;
            appendStreamingToken(event.data.delta, event.data.section);
          } else if (event.type === "citation") {
            accumulatedCitations.push(event.data);
            addStreamingCitation(event.data);
          } else if (event.type === "evidence") {
            accumulatedEvidence = event.data;
            setStreamingSecurityEvidence(event.data);
          } else if (event.type === "done") {
            // Construct or receive finalized assistant message
            const asstMsg: Message = event.data.message || {
              id: event.data.messageId || `msg-bot-${Date.now()}`,
              conversationId: convId,
              role: "assistant",
              content: accumulatedContent,
              citations: accumulatedCitations,
              securityEvidence: accumulatedEvidence,
              createdAt: new Date().toISOString()
            };

            // IMMEDIATELY commit assistant message to current chat's React state
            setCurrentMessages((prev) => {
              if (prev.some((m) => m.id === asstMsg.id)) return prev;
              return [...prev, asstMsg];
            });

            // Sync conversation lists in background
            queryClient.invalidateQueries({ queryKey: ["conversation", convId] });
            queryClient.invalidateQueries({ queryKey: ["conversations"] });

            // Turn off streaming AFTER the assistant message has been committed to UI state
            resetStreaming();
          } else if (event.type === "error") {
            setStreamError(event.data.message);
            setStreaming(false);
          }
        },
        abortController.signal
      );
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setStreamError(err.message || "Connection to stream interrupted.");
      }
      setStreaming(false);
    }
  };

  return (
    <AuthGuard>
      <div className="flex h-screen w-full bg-[#060b08] text-zinc-100 overflow-hidden select-none">
        {/* 1. LEFT REGION: Collapsible Conversation Sidebar */}
        <ConversationSidebar
          conversations={conversations}
          activeId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          onNewChat={handleNewChat}
          onDeleteConversation={handleDeleteConversation}
        />

        {/* 2. CENTER REGION: Header, Message Thread & Composer */}
        <main className="flex-1 flex flex-col h-full min-w-0 bg-[#060b08] relative">
          {/* Workspace Top Header */}
          <header className="h-14 px-4 sm:px-6 border-b border-emerald-500/15 flex items-center justify-between bg-[#08120b]/80 backdrop-blur-xl z-10 flex-shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleSidebar()}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-emerald-300 hover:bg-emerald-950/40 md:hidden"
                title="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-semibold text-emerald-100 truncate max-w-[200px] sm:max-w-md">
                  {activeConv?.title || (activeEvidence ? activeEvidence.title : "New Payment Investigation")}
                </span>
                <span className="hidden sm:inline-flex text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-500/25">
                  Non-Evaluative RAG
                </span>
              </div>
            </div>

            {/* Right toggle button for Evidence Panel */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleEvidencePanel()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-900/60 text-xs font-medium transition-colors"
                title={isEvidencePanelOpen ? "Hide Evidence Panel" : "Show Evidence Panel"}
              >
                {isEvidencePanelOpen ? (
                  <>
                    <PanelRightClose className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Hide Evidence</span>
                  </>
                ) : (
                  <>
                    <PanelRightOpen className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Inspect Evidence</span>
                  </>
                )}
              </button>
            </div>
          </header>

          {/* Message Thread */}
          <div className="flex-1 overflow-hidden relative">
            <MessageThread
              messages={currentMessages}
              isLoading={isConvLoading}
              onSelectSampleEvidence={handleSelectSample}
              onRetryStream={() => {
                const lastUserMsg = [...currentMessages].reverse().find((m) => m.role === "user");
                if (lastUserMsg?.content) {
                  handleSendMessage(lastUserMsg.content);
                }
              }}
            />
          </div>

          {/* Composer (Persistent at bottom) */}
          <div className="p-4 sm:p-5 border-t border-emerald-500/15 bg-gradient-to-t from-[#060b08] via-[#060b08]/90 to-transparent flex-shrink-0">
            <Composer onSendMessage={handleSendMessage} />
          </div>
        </main>

        {/* 3. RIGHT REGION: Persistent Evidence Panel */}
        <EvidencePanel />

        {/* 4. Post-Payment Emergency Assistance Modal */}
        <AlreadyPaidModal
          isOpen={isAlreadyPaidModalOpen}
          onClose={() => closeAlreadyPaidModal()}
          onSelectFlow={(question, autoSend) => {
            if (autoSend) {
              handleSendMessage(question);
            } else {
              setPrefilledQuestion(question);
            }
          }}
        />
      </div>
    </AuthGuard>
  );
}
