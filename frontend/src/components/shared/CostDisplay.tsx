import { formatCost } from "@/lib/utils";

interface CostDisplayProps {
  cost: number | null | undefined;
  inputTokens?: number | null;
  outputTokens?: number | null;
  className?: string;
}

export function CostDisplay({
  cost,
  inputTokens,
  outputTokens,
  className,
}: CostDisplayProps) {
  const formatted = formatCost(cost);
  const hasBreakdown = inputTokens != null || outputTokens != null;

  if (!hasBreakdown) {
    return (
      <span className={`font-mono text-xs text-brand-text-secondary ${className ?? ""}`}>
        {formatted}
      </span>
    );
  }

  return (
    <span
      className={`font-mono text-xs text-brand-text-secondary cursor-help ${className ?? ""}`}
      title={`In: ${inputTokens ?? 0} tokens | Out: ${outputTokens ?? 0} tokens`}
    >
      {formatted}
    </span>
  );
}
