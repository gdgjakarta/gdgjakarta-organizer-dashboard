import type * as React from "react";

import { cn } from "@/lib/utils";

export function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("absolute right-0 bottom-0 z-10 size-2 rounded-full ring-2 ring-background", className)}
      {...props}
    />
  );
}
