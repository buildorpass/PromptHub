"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toasts: ToastMessage[];
  toast: (msg: Omit<ToastMessage, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue>({
  toasts: [],
  toast: () => {},
  dismiss: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const toast = React.useCallback((msg: Omit<ToastMessage, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...msg, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return React.useContext(ToastContext);
}

const toastStyles: Record<ToastType, string> = {
  success: "border-emerald-500/40 bg-emerald-500/10",
  error: "border-rose-500/40 bg-rose-500/10",
  warning: "border-amber-500/40 bg-amber-500/10",
  info: "border-brand-border bg-brand-elevated",
};

const toastIcons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />,
  error: <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />,
  warning: <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />,
  info: <Info className="h-4 w-4 text-brand-text-secondary shrink-0" />,
};

const toastTitleColors: Record<ToastType, string> = {
  success: "text-emerald-300",
  error: "text-rose-300",
  warning: "text-amber-300",
  info: "text-brand-text-primary",
};

function ToastContainer({
  toasts,
  dismiss,
}: {
  toasts: ToastMessage[];
  dismiss: (id: string) => void;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted || toasts.length === 0) return null;

  return createPortal(
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "flex items-start gap-3 rounded-md border p-3 shadow-xl",
            toastStyles[t.type]
          )}
        >
          {toastIcons[t.type]}
          <div className="flex-1 min-w-0">
            <p className={cn("text-sm font-medium", toastTitleColors[t.type])}>
              {t.title}
            </p>
            {t.description && (
              <p className="text-xs text-brand-text-muted mt-0.5">
                {t.description}
              </p>
            )}
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="text-brand-text-muted hover:text-brand-text-secondary transition-colors shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}
