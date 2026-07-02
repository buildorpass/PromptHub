interface TokenCountProps {
  inputTokens: number | null | undefined;
  outputTokens: number | null | undefined;
  className?: string;
}

export function TokenCount({
  inputTokens,
  outputTokens,
  className,
}: TokenCountProps) {
  if (inputTokens == null && outputTokens == null) {
    return (
      <span className={`font-mono text-xs text-brand-text-muted ${className ?? ""}`}>
        —
      </span>
    );
  }

  return (
    <span className={`font-mono text-xs text-brand-text-secondary ${className ?? ""}`}>
      {inputTokens ?? 0} in / {outputTokens ?? 0} out
    </span>
  );
}
