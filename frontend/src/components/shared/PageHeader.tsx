import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-brand-border px-6 py-4",
        className
      )}
    >
      <div>
        <h1 className="text-sm font-semibold text-brand-text-primary">
          {title}
        </h1>
        {description && (
          <p className="mt-0.5 text-xs text-brand-text-muted">{description}</p>
        )}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}
