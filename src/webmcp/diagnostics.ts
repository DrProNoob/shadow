export type WebMcpDiagnosticPhase =
  | "registered"
  | "invocation-entered"
  | "validated-input"
  | "application-command-started"
  | "application-command-completed"
  | "result-returned"
  | "error-thrown";

export type WebMcpDiagnosticEvent = {
  id: number;
  source: "webmcp";
  tool: string;
  phase: WebMcpDiagnosticPhase;
  status: "received" | "ok" | "error";
  message?: string;
};

let sequence = 0;
let events: WebMcpDiagnosticEvent[] = [];
const listeners = new Set<() => void>();

export function recordWebMcpDiagnostic(
  event: Omit<WebMcpDiagnosticEvent, "id" | "source">,
) {
  events = [
    ...events.slice(-39),
    { id: ++sequence, source: "webmcp", ...event },
  ];
  listeners.forEach((listener) => listener());
}

export const webMcpDiagnostics = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => events,
  getServerSnapshot: () => [] as WebMcpDiagnosticEvent[],
};

function validateSimpleObjectSchema(schema: unknown, rawInput: unknown): boolean {
  const input = normalizeInput(rawInput);
  if (!schema || typeof schema !== "object") return true;
  const candidate = schema as {
    type?: unknown;
    required?: unknown;
    properties?: Record<string, { type?: unknown }>;
    additionalProperties?: unknown;
  };
  if (candidate.type !== "object") return true;
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const objectInput = input as Record<string, unknown>;
  const required = Array.isArray(candidate.required)
    ? candidate.required.filter((value): value is string => typeof value === "string")
    : [];
  if (required.some((key) => !(key in objectInput))) return false;
  if (candidate.additionalProperties === false && candidate.properties) {
    if (Object.keys(objectInput).some((key) => !(key in candidate.properties!))) {
      return false;
    }
  }
  for (const [key, property] of Object.entries(candidate.properties ?? {})) {
    if (!(key in objectInput) || property.type === undefined) continue;
    const value = objectInput[key];
    if (property.type === "string" && typeof value !== "string") return false;
    if (property.type === "number" && typeof value !== "number") return false;
    if (
      property.type === "integer" &&
      (typeof value !== "number" || !Number.isInteger(value))
    ) {
      return false;
    }
    if (
      property.type === "object" &&
      (typeof value !== "object" || value === null || Array.isArray(value))
    ) {
      return false;
    }
  }
  return true;
}

function normalizeInput(rawInput: unknown): unknown {
  if (typeof rawInput !== "string") return rawInput ?? {};
  try {
    return JSON.parse(rawInput) as unknown;
  } catch {
    return rawInput;
  }
}

function isToolFailure(result: unknown, code: string): boolean {
  if (!result || typeof result !== "object") return false;
  const candidate = result as { ok?: unknown; error?: { code?: unknown } };
  return candidate.ok === false && candidate.error?.code === code;
}

const MUTATING_TOOLS = new Set([
  "begin_shadow",
  "stage_seat_change",
  "stage_plan_change",
  "stage_cancellation",
  "remove_shadow_change",
  "fork_shadow",
  "copy_change_between_shadows",
]);

export function createWebMcpPingTool(): WebMCP.ModelContextTool {
  return {
    name: "webmcp_ping",
    title: "WebMCP ping",
    description:
      "Diagnostic no-op that proves the browser reached SHADOW's WebMCP execute handler. It has no domain or database dependency and does not change Reality or a Shadow.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    execute: async () => {
      recordWebMcpDiagnostic({
        tool: "webmcp_ping",
        phase: "invocation-entered",
        status: "received",
      });
      recordWebMcpDiagnostic({
        tool: "webmcp_ping",
        phase: "validated-input",
        status: "ok",
      });
      const result = {
        ok: true,
        message: "SHADOW WebMCP is alive",
      };
      recordWebMcpDiagnostic({
        tool: "webmcp_ping",
        phase: "result-returned",
        status: "ok",
      });
      return result;
    },
  };
}

export function instrumentWebMcpTool(
  tool: WebMCP.ModelContextTool,
): WebMCP.ModelContextTool {
  const originalExecute = tool.execute;
  return {
    ...tool,
    execute: async (rawInput, executionOptions) => {
      recordWebMcpDiagnostic({
        tool: tool.name,
        phase: "invocation-entered",
        status: "received",
      });

      const schemaLooksValid = validateSimpleObjectSchema(tool.inputSchema, rawInput);
      if (schemaLooksValid) {
        recordWebMcpDiagnostic({
          tool: tool.name,
          phase: "validated-input",
          status: "ok",
        });
      }
      if (schemaLooksValid && MUTATING_TOOLS.has(tool.name)) {
        recordWebMcpDiagnostic({
          tool: tool.name,
          phase: "application-command-started",
          status: "received",
        });
      }

      try {
        // API-drift seam: the current draft supplies executionOptions.signal,
        // while some browser/agent bridges still call execute(input) only.
        const signal = executionOptions?.signal ?? new AbortController().signal;
        const result = await originalExecute(rawInput, { signal });

        if (!schemaLooksValid && !isToolFailure(result, "INVALID_ARGUMENTS")) {
          recordWebMcpDiagnostic({
            tool: tool.name,
            phase: "validated-input",
            status: "ok",
          });
        }
        if (
          MUTATING_TOOLS.has(tool.name) &&
          !isToolFailure(result, "INVALID_ARGUMENTS") &&
          !isToolFailure(result, "TOOL_ABORTED") &&
          !isToolFailure(result, "SHADOW_NOT_FOUND")
        ) {
          recordWebMcpDiagnostic({
            tool: tool.name,
            phase: "application-command-completed",
            status: "ok",
          });
        }
        recordWebMcpDiagnostic({
          tool: tool.name,
          phase: "result-returned",
          status: isToolFailure(result, "INVALID_ARGUMENTS") ? "error" : "ok",
        });
        return result;
      } catch (error) {
        recordWebMcpDiagnostic({
          tool: tool.name,
          phase: "error-thrown",
          status: "error",
          message: error instanceof Error ? error.message : "Unknown WebMCP error",
        });
        throw error;
      }
    },
  };
}
