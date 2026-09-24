"use client";

import React, { useState } from "react";
import { Conversation } from "@/types/chat";
import { useChatStore } from "@/lib/stores/useChatStore";
import { useAuth } from "@/lib/hooks/useAuth";
import { 
  Shield, 
  Plus, 
  Trash2, 
  Search, 
  QrCode, 
  Globe, 
  FileText, 
  ImageIcon, 
  ChevronLeft, 
  ChevronRight,
  Menu,
  X,
  Clock,
  User,
  LogOut,
  ExternalLink
} from "lucide-react";
import { formatTimestamp, cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeId?: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
}

export function ConversationSidebar({
  conversations,
  activeId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation
}: ConversationSidebarProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const { isSidebarOpen, toggleSidebar } = useChatStore();
  const { user, signOut, signIn, isAuthModalOpen, setAuthModalOpen } = useAuth();

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getEvidenceIcon = (type?: string) => {
    switch (type) {
      case "qr": return <QrCode className="h-4 w-4 text-emerald-400" />;
      case "url": return <Globe className="h-4 w-4 text-emerald-400" />;
      case "screenshot": return <ImageIcon className="h-4 w-4 text-emerald-400" />;
      case "message": return <FileText className="h-4 w-4 text-emerald-400" />;
      default: return <Shield className="h-4 w-4 text-emerald-400" />;
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          onClick={() => toggleSidebar(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-30 md:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed md:relative z-40 h-full flex flex-col bg-[#071109]/95 border-r border-emerald-500/15 backdrop-blur-2xl transition-all duration-300",
          isSidebarOpen ? "w-72 sm:w-80 translate-x-0" : "w-0 -translate-x-full md:w-20 md:translate-x-0 overflow-hidden"
        )}
      >
        {/* Top Branding & New Chat Button */}
        <div className="p-4 border-b border-emerald-500/15 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-[#2d7850] to-[#123824] border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-[0_0_15px_rgba(45,120,80,0.3)] transition-transform group-hover:scale-105">
                <Shield className="h-5 w-5" />
              </div>
              {isSidebarOpen && (
                <div>
                  <span className="text-base font-bold tracking-tight text-emerald-100 flex items-center gap-1.5">
                    Paylume
                    <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                      RAG
                    </span>
                  </span>
                  <p className="text-[10px] text-zinc-400">Payment Safety Intelligence</p>
                </div>
              )}
            </Link>

            {/* Toggle Button for desktop and mobile */}
            <button
              onClick={() => toggleSidebar()}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-emerald-300 hover:bg-emerald-950/40 transition-colors"
              title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {isSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>

          {/* New Chat Button */}
          <button
            onClick={onNewChat}
            className={cn(
              "btn-pill-primary flex items-center justify-center gap-2 py-2 text-xs font-semibold shadow-md active:scale-95 transition-all",
              !isSidebarOpen && "w-10 h-10 p-0 rounded-2xl mx-auto"
            )}
            title="Start New Payment Analysis"
          >
            <Plus className="h-4 w-4" />
            {isSidebarOpen && <span>New Analysis</span>}
          </button>

          {/* Search bar when open */}
          {isSidebarOpen && (
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search history..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/40 border border-emerald-500/15 rounded-xl pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-400/50"
              />
            </div>
          )}
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {isSidebarOpen && (
            <div className="px-2 py-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-emerald-400/70">
              <span>Past Cases</span>
              <span>{filteredConversations.length}</span>
            </div>
          )}

          {filteredConversations.length === 0 ? (
            isSidebarOpen && (
              <div className="text-center py-8 text-xs text-zinc-500">
                No past payment reviews found
              </div>
            )
          ) : (
            filteredConversations.map((conv) => {
              const isActive = conv.id === activeId;
              const evType = conv.evidence?.type || "message";

              if (!isSidebarOpen) {
                return (
                  <button
                    key={conv.id}
                    onClick={() => onSelectConversation(conv.id)}
                    className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center mx-auto transition-colors group relative",
                      isActive 
                        ? "bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]" 
                        : "text-zinc-400 hover:bg-emerald-950/40 hover:text-emerald-300"
                    )}
                    title={conv.title}
                  >
                    {getEvidenceIcon(evType)}
                  </button>
                );
              }

              return (
                <div
                  key={conv.id}
                  onClick={() => onSelectConversation(conv.id)}
                  className={cn(
                    "group flex items-center justify-between p-2.5 rounded-2xl cursor-pointer text-xs transition-all border",
                    isActive
                      ? "bg-emerald-950/80 border-emerald-500/40 text-emerald-100 shadow-[0_2px_15px_rgba(16,185,129,0.15)]"
                      : "border-transparent text-zinc-300 hover:bg-emerald-950/30 hover:border-emerald-500/15"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div className="h-8 w-8 rounded-xl bg-black/40 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      {getEvidenceIcon(evType)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-medium truncate text-zinc-200 group-hover:text-emerald-100">
                        {conv.title}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mt-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        <span>{formatTimestamp(conv.createdAt)}</span>
                        <span>•</span>
                        <span className="capitalize">{evType}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(conv.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/40 transition-all flex-shrink-0"
                    title="Delete conversation"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* User Profile Footer */}
        <div className="p-3 border-t border-emerald-500/15 bg-black/20">
          {user ? (
            <div className={cn("flex items-center justify-between", !isSidebarOpen && "justify-center")}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div 
                  className="h-8 w-8 rounded-full bg-emerald-900/60 border border-emerald-400/40 flex items-center justify-center text-emerald-300 font-semibold text-xs flex-shrink-0"
                  title={user.email}
                >
                  {(() => {
                    if (user.name && user.name.trim()) {
                      const parts = user.name.trim().split(" ");
                      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
                      return user.name.slice(0, 2).toUpperCase();
                    }
                    return (user.email || "PL").slice(0, 2).toUpperCase();
                  })()}
                </div>
                {isSidebarOpen && (
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-emerald-100 truncate" title={user.name}>
                      {user.name}
                    </div>
                    <div className="text-[10px] text-zinc-400 truncate" title={user.email}>
                      {user.email}
                    </div>
                  </div>
                )}
              </div>
              {isSidebarOpen && (
                <button
                  onClick={async () => {
                    await signOut();
                    router.push("/login");
                  }}
                  className="p-1.5 text-zinc-400 hover:text-red-400 rounded-lg hover:bg-emerald-950/40 transition-colors"
                  title="Sign Out of Paylume"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => router.push("/login")}
              className="w-full btn-pill-secondary py-2 text-xs flex items-center justify-center gap-2"
            >
              <User className="h-3.5 w-3.5" />
              {isSidebarOpen && <span>Sign In (Supabase)</span>}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
