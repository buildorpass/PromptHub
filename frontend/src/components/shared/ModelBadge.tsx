import { cn } from "@/lib/utils";

interface ModelBadgeProps {
  provider: string;
  className?: string;
}

const providerStyles: Record<string, string> = {
  openai: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
  anthropic: "bg-violet-500/10 border-violet-500/30 text-violet-400",
  deepseek: "bg-cyan-500/10 border-cyan-500/30 text-cyan-400",
};

const providerLabels: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  deepseek: "DeepSeek",
};

export function ModelBadge({ provider, className }: ModelBadgeProps) {
  const key = provider.toLowerCase();
  const style =
    providerStyles[key] ??
    "bg-zinc-800 border-zinc-700 text-zinc-400";
  const label = providerLabels[key] ?? provider;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium border",
        style,
        className
      )}
    >
      {label}
    </span>
  );
}
