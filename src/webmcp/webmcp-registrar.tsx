"use client";

import { useEffect, useState } from "react";
import type { WorkspaceStore } from "@/application/workspace-store";
import { registerWebMcpTools } from "@/webmcp/browser-adapter";
import {
  createWebMcpPingTool,
  instrumentWebMcpTool,
} from "@/webmcp/diagnostics";
import {
  createWebMcpTools,
  type WebMcpMutationEvent,
} from "@/webmcp/tool-catalog";

export type WebMcpStatus = "checking" | "ready" | "unavailable" | "error";

export function useWebMcpRegistrar(
  store: WorkspaceStore,
  hydrated: boolean,
  onMutation?: (event: WebMcpMutationEvent) => void,
): WebMcpStatus {
  const [status, setStatus] = useState<WebMcpStatus>("checking");

  useEffect(() => {
    if (!hydrated) return;
    const controller = new AbortController();
    let current = true;
    const tools = [
      createWebMcpPingTool(),
      ...createWebMcpTools(store, { onMutation }).map(instrumentWebMcpTool),
    ];

    registerWebMcpTools(tools, controller.signal)
      .then((result) => {
        if (current) setStatus(result);
      })
      .catch(() => {
        if (current && !controller.signal.aborted) {
          controller.abort();
          setStatus("error");
        }
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [hydrated, onMutation, store]);

  return status;
}
