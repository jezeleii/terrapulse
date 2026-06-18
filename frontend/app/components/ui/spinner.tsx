import type { LucideProps } from "lucide-react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpinnerProps extends LucideProps {
  size?: "sm" | "md" | "lg";
}

export function Spinner({ className, size = "sm", ...props }: SpinnerProps) {
  return (
    <Loader2
      className={cn(
        "inline-block animate-spin text-foreground/60",
        size === "sm" ? "h-3 w-3" : size === "md" ? "h-4 w-4" : "h-6 w-6",
        className,
      )}
      {...props}
    />
  );
}
