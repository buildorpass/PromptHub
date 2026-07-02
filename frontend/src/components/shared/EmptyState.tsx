import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4 text-center",
        className
      )}
    >
      <svg
        className="mb-4 h-12 w-12 text-brand-text-muted"
        fill="none"
        viewBox="0 0 48 48"
        stroke="currentColor"
        strokeWidth={1}
      >
        <rect x="6" y="10" width="36" height="28" rx="2" />
        <line x1="14" y1="18" x2="34" y2="18" />
        <line x1="14" y1="24" x2="28" y2="24" />
        <line x1="14" y1="30" x2="22" y2="30" />
      </svg>
      <h3 className="text-sm font-medium text-brand-text-secondary">{title}</h3>
      {description && (
        <p className="mt-1 text-xs text-brand-text-muted max-w-xs">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
