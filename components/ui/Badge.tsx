import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "emerald" | "amber" | "neutral" | "cyan";
  size?: "sm" | "md";
  dot?: boolean;
}

export function Badge({ 
  children, 
  variant = "emerald", 
  size = "md", 
  dot = false, 
  className, 
  ...props 
}: BadgeProps) {
  const variantStyles = {
    emerald: "bg-emerald-950/60 text-emerald-300 border-emerald-500/30 shadow-[0_0_12px_-3px_rgba(16,185,129,0.25)]",
    amber: "bg-amber-950/60 text-amber-300 border-amber-500/40 shadow-[0_0_12px_-3px_rgba(245,158,11,0.25)]",
    neutral: "bg-zinc-900/70 text-zinc-400 border-zinc-700/40",
    cyan: "bg-teal-950/60 text-teal-300 border-teal-500/30 shadow-[0_0_12px_-3px_rgba(20,184,166,0.25)]"
  };

  const dotColors = {
    emerald: "bg-emerald-400",
    amber: "bg-amber-400",
    neutral: "bg-zinc-400",
    cyan: "bg-teal-400"
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-xs tracking-wide"
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium select-none backdrop-blur-md",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", dotColors[variant])} />
      )}
      {children}
    </span>
  );
}
