import * as React from "react";
import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    return (
      <label
        htmlFor={id}
        className="flex items-center gap-2 cursor-pointer group"
      >
        <input
          type="checkbox"
          id={id}
          ref={ref}
          className={cn(
            "h-4 w-4 rounded border border-brand-border bg-brand-surface text-brand-primary focus:ring-1 focus:ring-brand-primary focus:ring-offset-0 accent-orange-500 cursor-pointer",
            className
          )}
          {...props}
        />
        {label && (
          <span className="text-sm text-brand-text-secondary group-hover:text-brand-text-primary transition-colors">
            {label}
          </span>
        )}
      </label>
    );
  }
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
