import React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-2xl bg-emerald-950/30 border border-emerald-500/10",
        className
      )}
      {...props}
    />
  );
}

export function ConversationItemSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-950/20 border border-emerald-500/10 animate-pulse">
      <div className="h-9 w-9 rounded-xl bg-emerald-900/30 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-emerald-900/40 rounded w-3/4" />
        <div className="h-2.5 bg-emerald-900/20 rounded w-1/2" />
      </div>
    </div>
  );
}

export function MessageItemSkeleton() {
  return (
    <div className="space-y-4 max-w-2xl w-full">
      <div className="h-24 rounded-2xl bg-emerald-950/20 border border-emerald-500/10 animate-pulse p-4 space-y-2">
        <div className="h-4 bg-emerald-900/40 rounded w-1/4" />
        <div className="h-3 bg-emerald-900/20 rounded w-full" />
        <div className="h-3 bg-emerald-900/20 rounded w-5/6" />
      </div>
      <div className="h-28 rounded-2xl bg-emerald-950/20 border border-emerald-500/10 animate-pulse p-4 space-y-2">
        <div className="h-4 bg-emerald-900/40 rounded w-1/3" />
        <div className="h-3 bg-emerald-900/20 rounded w-full" />
        <div className="h-3 bg-emerald-900/20 rounded w-4/5" />
      </div>
      <div className="h-24 rounded-2xl bg-emerald-950/20 border border-emerald-500/10 animate-pulse p-4 space-y-2">
        <div className="h-4 bg-emerald-900/40 rounded w-1/4" />
        <div className="h-3 bg-emerald-900/20 rounded w-11/12" />
      </div>
    </div>
  );
}
