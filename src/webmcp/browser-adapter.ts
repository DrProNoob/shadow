export type RegistrationResult = "ready" | "unavailable";

export type WebMcpRegistrationTarget = Pick<
  WebMCP.ModelContext,
  "registerTool"
>;

export function getWebMcpRegistrationTarget(): WebMcpRegistrationTarget | null {
  if (typeof document === "undefined") return null;
  const modelContext = document.modelContext;
  return typeof modelContext?.registerTool === "function" ? modelContext : null;
}

export async function registerWebMcpTools(
  tools: WebMCP.ModelContextTool[],
  signal: AbortSignal,
  target: WebMcpRegistrationTarget | null = getWebMcpRegistrationTarget(),
): Promise<RegistrationResult> {
  if (!target || signal.aborted) return "unavailable";

  const names = new Set<string>();
  for (const tool of tools) {
    if (names.has(tool.name)) {
      throw new Error(`Duplicate WebMCP tool name: ${tool.name}`);
    }
    names.add(tool.name);
  }

  for (const tool of tools) {
    if (signal.aborted) return "unavailable";
    await target.registerTool(tool, { signal });
  }
  return signal.aborted ? "unavailable" : "ready";
}
