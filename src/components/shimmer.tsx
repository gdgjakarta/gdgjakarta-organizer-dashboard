import type * as React from "react";

import { cn } from "@/lib/utils";

export interface ShimmerProps extends React.ComponentProps<"div"> {
  className?: string;
}

export function Shimmer({ className, ...props }: ShimmerProps) {
  return (
    <div data-slot="shimmer" className={cn("relative overflow-hidden rounded-md bg-muted/70", className)} {...props}>
      <div className="shimmer-wave" aria-hidden="true" />
    </div>
  );
}
