"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

function Dialog({ open, onClose, children }: DialogProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10">{children}</div>
    </div>,
    document.body
  );
}

interface DialogContentProps {
  className?: string;
  children: React.ReactNode;
  title?: string;
  onClose?: () => void;
}

function DialogContent({
  className,
  children,
  title,
  onClose,
}: DialogContentProps) {
  return (
    <div
      className={cn(
        "relative w-full max-w-lg rounded-md border border-brand-border bg-brand-surface p-6 shadow-2xl",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {(title || onClose) && (
        <div className="mb-4 flex items-center justify-between">
          {title && (
            <h2 className="text-sm font-semibold text-brand-text-primary">
              {title}
            </h2>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="ml-auto text-brand-text-muted hover:text-brand-text-primary transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

function DialogHeader({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mb-4 space-y-1", className)}>{children}</div>
  );
}

function DialogTitle({
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

function DialogDescription({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p className={cn("text-xs text-brand-text-muted", className)}>{children}</p>
  );
}

function DialogFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mt-5 flex justify-end gap-2", className)}>
      {children}
    </div>
  );
}

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
};
