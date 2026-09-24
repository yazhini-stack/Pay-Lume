import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "pill-primary" | "pill-secondary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "pill-primary", size = "md", isLoading, children, disabled, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center font-medium transition-all duration-200 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed select-none active:scale-[0.98]";

    const variantStyles = {
      "pill-primary": "btn-pill-primary px-5 py-2.5 text-sm font-semibold tracking-wide",
      "pill-secondary": "btn-pill-secondary px-5 py-2.5 text-sm",
      "ghost": "text-zinc-300 hover:text-white hover:bg-emerald-950/40 rounded-xl px-3 py-2 text-sm",
      "outline": "border border-emerald-500/30 text-emerald-300 hover:bg-emerald-950/40 hover:border-emerald-400/50 rounded-full px-4 py-2 text-sm",
      "danger": "bg-red-950/40 text-red-300 border border-red-500/30 hover:bg-red-900/50 rounded-xl px-4 py-2 text-sm"
    };

    const sizeStyles = {
      sm: "text-xs px-3 py-1.5 rounded-full",
      md: "",
      lg: "text-base px-6 py-3 rounded-full",
      icon: "p-2 rounded-xl h-9 w-9 flex items-center justify-center"
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variantStyles[variant], size === "icon" ? sizeStyles.icon : (size === "sm" ? sizeStyles.sm : (size === "lg" ? sizeStyles.lg : "")), className)}
        {...props}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            <span>{children}</span>
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
