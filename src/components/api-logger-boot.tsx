"use client";

import { useEffect } from "react";

import { initGlobalApiLogger } from "@/lib/api-logger";

export function ApiLoggerBoot() {
  useEffect(() => {
    initGlobalApiLogger();
  }, []);

  return null;
}
