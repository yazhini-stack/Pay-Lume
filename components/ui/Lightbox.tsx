"use client";

import React, { useEffect, useState } from "react";
import { X, ZoomIn, ZoomOut, RotateCw } from "lucide-react";

interface LightboxProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  altText?: string;
  title?: string;
}

export function Lightbox({ isOpen, onClose, imageUrl, altText = "Evidence Screenshot", title }: LightboxProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setRotation(0);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-black/90 backdrop-blur-lg animate-in fade-in duration-200">
      {/* Top control bar */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10 px-4 py-2 rounded-2xl bg-[#0b140e]/80 border border-emerald-500/20 backdrop-blur-md">
        <div className="text-sm font-medium text-emerald-300 truncate max-w-md">
          {title || "Evidence Inspector"}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setScale((s) => Math.min(s + 0.25, 3))}
            className="p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-emerald-950/60 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={() => setScale((s) => Math.max(s - 0.25, 0.5))}
            className="p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-emerald-950/60 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-emerald-950/60 transition-colors"
            title="Rotate"
          >
            <RotateCw className="h-4 w-4" />
          </button>
          <div className="h-4 w-px bg-emerald-500/20 mx-1" />
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-emerald-300 hover:bg-emerald-950/60 transition-colors"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Image container */}
      <div 
        className="flex-1 w-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing p-8"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={altText}
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            transition: "transform 0.15s ease-out"
          }}
          className="max-h-[85vh] max-w-[90vw] object-contain rounded-xl shadow-2xl border border-emerald-500/30 select-none"
        />
      </div>
    </div>
  );
}
