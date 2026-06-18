/* eslint-disable @typescript-eslint/no-explicit-any, react/display-name */
import * as React from "react"

import { cn } from "@/lib/utils"

interface InputProps extends React.ComponentProps<"input"> {
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, icon, iconPosition = "left", ...props }, ref) => {
    if (icon) {
      return (
        <div className="relative flex items-center">
          {iconPosition === "left" && (
            <span className="pointer-events-none absolute left-3 text-muted-foreground">{icon}</span>
          )}
          <input
            type={type}
            className={cn(
              "flex h-9 w-full rounded-md border border-input bg-transparent py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
              iconPosition === "left" ? "pl-9 pr-3" : "pl-3 pr-9",
              className,
            )}
            ref={ref}
            {...props}
          />
          {iconPosition === "right" && (
            <span className="pointer-events-none absolute right-3 text-muted-foreground">{icon}</span>
          )}
        </div>
      )
    }

    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
;(Input as any).displayName = "Input"

export { Input }
