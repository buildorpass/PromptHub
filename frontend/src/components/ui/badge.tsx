import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-brand-elevated border border-brand-border text-brand-text-secondary",
        primary: "bg-orange-500/10 border border-orange-500/30 text-orange-400",
        secondary:
          "bg-violet-500/10 border border-violet-500/30 text-violet-400",
        success:
          "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400",
        warning: "bg-amber-500/10 border border-amber-500/30 text-amber-400",
        error: "bg-rose-500/10 border border-rose-500/30 text-rose-400",
        outline:
          "border border-brand-border text-brand-text-secondary bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
