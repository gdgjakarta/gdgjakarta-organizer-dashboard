"use client";

import { useEffect } from "react";

import { initGlobalApiLogger } from "@/lib/api-logger";

export function ApiLoggerBoot() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    initGlobalApiLogger();
  }, []);

  return null;
}
