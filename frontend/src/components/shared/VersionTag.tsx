import { cn } from "@/lib/utils";

interface VersionTagProps {
  version: number;
  className?: string;
}

export function VersionTag({ version, className }: VersionTagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 font-mono text-xs bg-zinc-800 border border-zinc-700 text-zinc-400",
        className
      )}
    >
      v{version}
    </span>
  );
}
