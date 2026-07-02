import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-brand-primary text-white hover:bg-orange-600 active:bg-orange-700",
        secondary:
          "bg-brand-elevated text-brand-text-secondary border border-brand-border hover:text-brand-text-primary hover:bg-[#252525]",
        ghost:
          "text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-elevated",
        destructive:
          "bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20",
        outline:
          "border border-brand-border bg-transparent text-brand-text-secondary hover:bg-brand-elevated hover:text-brand-text-primary",
        link: "text-brand-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-3 py-1.5",
        sm: "h-7 px-2.5 py-1 text-xs",
        lg: "h-10 px-5 py-2.5",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
