"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  side?: "left" | "right";
}

function Sheet({ open, onClose, children, side = "right" }: SheetProps) {
  React.useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 flex flex-col bg-brand-surface border-brand-border",
          side === "right"
            ? "ml-auto border-l w-[480px] max-w-[90vw]"
            : "mr-auto border-r w-[480px] max-w-[90vw]"
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

function SheetHeader({
  className,
  children,
  onClose,
}: {
  className?: string;
  children: React.ReactNode;
  onClose?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-brand-border px-5 py-4",
        className
      )}
    >
      <div>{children}</div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-brand-text-muted hover:text-brand-text-primary transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function SheetTitle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h2 className={cn("text-sm font-semibold text-brand-text-primary", className)}>
      {children}
    </h2>
  );
}

function SheetContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex-1 overflow-y-auto px-5 py-4", className)}>
      {children}
    </div>
  );
}

function SheetFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "border-t border-brand-border px-5 py-4 flex justify-end gap-2",
        className
      )}
    >
      {children}
    </div>
  );
}

export { Sheet, SheetHeader, SheetTitle, SheetContent, SheetFooter };
