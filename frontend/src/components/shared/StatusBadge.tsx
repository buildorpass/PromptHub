import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusStyles: Record<string, string> = {
  pending: "bg-zinc-800 border-zinc-700 text-zinc-400",
  running: "bg-amber-500/10 border-amber-500/30 text-amber-400",
  completed: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
  failed: "bg-rose-500/10 border-rose-500/30 text-rose-400",
  pass: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
  fail: "bg-rose-500/10 border-rose-500/30 text-rose-400",
  manual: "bg-amber-500/10 border-amber-500/30 text-amber-400",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const key = status.toLowerCase();
  const style = statusStyles[key] ?? "bg-zinc-800 border-zinc-700 text-zinc-400";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium border",
        style,
        className
      )}
    >
      {status}
    </span>
  );
}
