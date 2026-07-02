import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function LoadingSpinner({ className, size = "md" }: LoadingSpinnerProps) {
  const sizes = {
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-2",
    lg: "h-8 w-8 border-[3px]",
  };

  return (
    <div
      className={cn(
        "rounded-full border-brand-elevated border-t-brand-primary animate-spin",
        sizes[size],
        className
      )}
    />
  );
}
