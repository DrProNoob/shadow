"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Braces,
  Check,
  CircleStop,
  FlaskConical,
  LoaderCircle,
  Play,
  RotateCcw,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";
import type { WorkspaceStore } from "@/application/workspace-store";
import { useWorkspace } from "@/components/shell/workspace-provider";
import { createWebMcpTools } from "@/webmcp/tool-catalog";

type ExecutionState =
  | { status: "idle" }
  | { status: "running"; toolName: string }
  | {
      status: "success";
      toolName: string;
      output: string;
      durationMs: number;
    }
  | {
      status: "error";
      toolName: string;
      message: string;
      durationMs?: number;
    };

/**
 * Keeps the Tool Lab isolated from browser registration details. Once the full
 * catalog factory is present, this is the only compatibility seam involved.
 */
function createToolLabCatalog(
  store: WorkspaceStore,
  onShadowMutation: (shadowId: string) => void,
): WebMCP.ModelContextTool[] {
  return createWebMcpTools(store, {
    onMutation: (event) => onShadowMutation(event.shadowId),
  });
}

function stringifyOutput(value: unknown): string {
  try {
    const serialized = JSON.stringify(value, null, 2);
    return serialized ?? String(value);
  } catch {
    return String(value);
  }
}

function parseInput(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("Tool input must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

function statusLabel(state: ExecutionState): string {
  switch (state.status) {
    case "idle":
      return "Not run";
    case "running":
      return "Executing";
    case "success":
      return "Succeeded";
    case "error":
      return "Failed";
  }
}

export function ToolLab() {
  const { store, workspace, webMcpStatus, selectShadow, activeShadowId } =
    useWorkspace();
  const tools = useMemo(
    () => createToolLabCatalog(store, selectShadow),
    [selectShadow, store],
  );
  const [selectedToolName, setSelectedToolName] = useState(
    () => tools[0]?.name ?? "",
  );
  const [input, setInput] = useState("{}");
  const [execution, setExecution] = useState<ExecutionState>({
    status: "idle",
  });
  const abortControllerRef = useRef<AbortController | null>(null);

  const selectedTool =
    tools.find((tool) => tool.name === selectedToolName) ?? tools[0];
  const hasForbiddenCommitTool = tools.some(
    (tool) => tool.name === "commit_shadow",
  );

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    [],
  );

  function chooseTool(toolName: string) {
    abortControllerRef.current?.abort();
    setSelectedToolName(toolName);
    setInput("{}");
    setExecution({ status: "idle" });
  }

  async function executeSelectedTool() {
    if (!selectedTool || execution.status === "running") return;

    let parsedInput: Record<string, unknown>;
    try {
      parsedInput = parseInput(input);
    } catch (error) {
      setExecution({
        status: "error",
        toolName: selectedTool.name,
        message:
          error instanceof Error ? error.message : "Input is not valid JSON.",
      });
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const startedAt = performance.now();
    setExecution({ status: "running", toolName: selectedTool.name });

    try {
      const output = await selectedTool.execute(parsedInput, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setExecution({
        status: "success",
        toolName: selectedTool.name,
        output: stringifyOutput(output),
        durationMs: performance.now() - startedAt,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        setExecution({
          status: "error",
          toolName: selectedTool.name,
          message: "Execution cancelled by the developer.",
          durationMs: performance.now() - startedAt,
        });
        return;
      }
      setExecution({
        status: "error",
        toolName: selectedTool.name,
        message:
          error instanceof Error
            ? error.message
            : "Unexpected executor failure.",
        durationMs: performance.now() - startedAt,
      });
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }

  function cancelExecution() {
    abortControllerRef.current?.abort();
    setExecution((current) =>
      current.status === "running"
        ? {
            status: "error",
            toolName: current.toolName,
            message: "Execution cancelled by the developer.",
          }
        : current,
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <header className="flex flex-col gap-5 border-b border-[var(--border)] pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--warning)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--warning)]">
              <FlaskConical aria-hidden="true" className="h-3 w-3" />
              Development only
            </span>
            <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Manual executor
            </span>
          </div>
          <h1 className="mt-4 text-2xl font-medium tracking-[-0.035em] text-white sm:text-3xl">
            WebMCP Tool Lab
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
            Invoke the exact application-facing tool executors without relying
            on agent selection. This is a deterministic development harness, not
            a live agent conversation.
          </p>
        </div>
        <dl className="grid w-full grid-cols-3 gap-2 text-xs lg:w-auto lg:min-w-[360px]">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
            <dt className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
              Tools
            </dt>
            <dd className="mt-2 font-mono text-white">{tools.length}</dd>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
            <dt className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
              Reality
            </dt>
            <dd className="mt-2 font-mono text-white">
              v{workspace.reality.version}
            </dd>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
            <dt className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
              Browser API
            </dt>
            <dd className="mt-2 capitalize text-white">{webMcpStatus}</dd>
          </div>
        </dl>
      </header>

      {hasForbiddenCommitTool ? (
        <div
          role="alert"
          className="mt-6 flex items-start gap-3 rounded-lg border border-[var(--danger)] bg-[var(--surface)] p-4 text-xs leading-5 text-[var(--danger)]"
        >
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          The catalog contains a prohibited Reality commit tool. Tool execution
          is disabled until the catalog boundary is corrected.
        </div>
      ) : (
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-4 text-xs leading-5 text-[var(--text-muted)]">
          <ShieldCheck
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]"
          />
          Reality commit is intentionally absent. This lab can read Reality and
          mutate only reversible Shadow state through the shared catalog.
        </div>
      )}

      <div className="mt-6 grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside aria-labelledby="tool-catalog-title">
          <div className="flex items-center justify-between gap-3">
            <h2
              id="tool-catalog-title"
              className="text-sm font-medium text-white"
            >
              Exported catalog
            </h2>
            <span className="font-mono text-[10px] text-[var(--text-faint)]">
              {activeShadowId ? `Active ${activeShadowId}` : "Reality context"}
            </span>
          </div>
          <ul className="mt-3 flex gap-2 overflow-x-auto pb-2 xl:grid xl:overflow-visible xl:pb-0">
            {tools.map((tool) => {
              const selected = tool.name === selectedTool?.name;
              return (
                <li key={tool.name} className="min-w-[230px] xl:min-w-0">
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => chooseTool(tool.name)}
                    className={`h-full w-full rounded-lg border p-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${selected ? "border-[var(--accent)] bg-[color:var(--accent)]/5" : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]"}`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="font-mono text-[11px] text-white">
                        {tool.name}
                      </span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] ${tool.annotations?.readOnlyHint ? "bg-[color:var(--success)]/10 text-[var(--success)]" : "bg-[color:var(--accent)]/10 text-[var(--accent)]"}`}
                      >
                        {tool.annotations?.readOnlyHint
                          ? "Read"
                          : "Shadow write"}
                      </span>
                    </span>
                    <span className="mt-2 line-clamp-2 block text-[10px] leading-4 text-[var(--text-faint)]">
                      {tool.title ?? tool.description}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <section aria-labelledby="executor-title">
          {selectedTool ? (
            <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <header className="flex flex-col gap-4 border-b border-[var(--border)] p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--accent)]">
                    {selectedTool.annotations?.readOnlyHint
                      ? "Read-only query"
                      : "Reversible Shadow action"}
                  </p>
                  <h2
                    id="executor-title"
                    className="mt-2 text-base font-medium text-white"
                  >
                    {selectedTool.title ?? selectedTool.name}
                  </h2>
                  <p className="mt-2 max-w-2xl text-xs leading-5 text-[var(--text-muted)]">
                    {selectedTool.description}
                  </p>
                </div>
                <span
                  role="status"
                  aria-live="polite"
                  className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] ${execution.status === "success" ? "border-[var(--success)] text-[var(--success)]" : execution.status === "error" ? "border-[var(--danger)] text-[var(--danger)]" : execution.status === "running" ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--text-faint)]"}`}
                >
                  {execution.status === "running" ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="h-3 w-3 animate-spin"
                    />
                  ) : execution.status === "success" ? (
                    <Check aria-hidden="true" className="h-3 w-3" />
                  ) : null}
                  {statusLabel(execution)}
                </span>
              </header>

              <div className="grid lg:grid-cols-2">
                <div className="border-b border-[var(--border)] p-4 sm:p-5 lg:border-r lg:border-b-0">
                  <div className="flex items-center justify-between gap-3">
                    <label
                      htmlFor="tool-input"
                      className="inline-flex items-center gap-2 text-xs font-medium text-white"
                    >
                      <Braces
                        aria-hidden="true"
                        className="h-3.5 w-3.5 text-[var(--accent)]"
                      />
                      JSON input
                    </label>
                    <button
                      type="button"
                      onClick={() => setInput("{}")}
                      className="inline-flex items-center gap-1.5 text-[10px] text-[var(--text-faint)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                    >
                      <RotateCcw aria-hidden="true" className="h-3 w-3" />
                      Reset
                    </button>
                  </div>
                  <textarea
                    id="tool-input"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    spellCheck={false}
                    disabled={execution.status === "running"}
                    className="mt-3 min-h-52 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--canvas)] p-3.5 font-mono text-xs leading-5 text-[var(--text-secondary)] outline-none transition-colors focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/20 disabled:opacity-60"
                  />

                  <details className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)]">
                    <summary className="cursor-pointer px-3.5 py-2.5 text-[10px] font-medium text-[var(--text-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
                      Input schema
                    </summary>
                    <pre className="max-h-52 overflow-auto border-t border-[var(--border)] p-3.5 font-mono text-[10px] leading-4 text-[var(--text-faint)]">
                      {stringifyOutput(selectedTool.inputSchema ?? {})}
                    </pre>
                  </details>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={
                        hasForbiddenCommitTool || execution.status === "running"
                      }
                      onClick={() => void executeSelectedTool()}
                      className="inline-flex h-9 items-center gap-2 rounded-lg bg-white px-4 text-xs font-semibold text-black transition-colors hover:bg-[var(--text-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {execution.status === "running" ? (
                        <LoaderCircle
                          aria-hidden="true"
                          className="h-3.5 w-3.5 animate-spin"
                        />
                      ) : (
                        <Play aria-hidden="true" className="h-3.5 w-3.5" />
                      )}
                      Execute tool
                    </button>
                    {execution.status === "running" ? (
                      <button
                        type="button"
                        onClick={cancelExecution}
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs text-[var(--text-muted)] hover:border-[var(--danger)] hover:text-[var(--danger)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                      >
                        <CircleStop
                          aria-hidden="true"
                          className="h-3.5 w-3.5"
                        />
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="min-w-0 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="inline-flex items-center gap-2 text-xs font-medium text-white">
                      <TerminalSquare
                        aria-hidden="true"
                        className="h-3.5 w-3.5 text-[var(--accent)]"
                      />
                      Structured output
                    </h3>
                    {"durationMs" in execution &&
                    typeof execution.durationMs === "number" ? (
                      <span className="font-mono text-[10px] text-[var(--text-faint)]">
                        {execution.durationMs.toFixed(1)} ms
                      </span>
                    ) : null}
                  </div>

                  <div
                    aria-live="polite"
                    className="mt-3 min-h-52 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--canvas)] p-3.5"
                  >
                    {execution.status === "success" ? (
                      <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5 text-[var(--success)]">
                        {execution.output}
                      </pre>
                    ) : execution.status === "error" ? (
                      <div role="alert" className="flex items-start gap-2.5">
                        <AlertTriangle
                          aria-hidden="true"
                          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]"
                        />
                        <p className="text-xs leading-5 text-[var(--danger)]">
                          {execution.message}
                        </p>
                      </div>
                    ) : execution.status === "running" ? (
                      <div className="flex items-center gap-2.5 text-xs text-[var(--text-muted)]">
                        <LoaderCircle
                          aria-hidden="true"
                          className="h-4 w-4 animate-spin text-[var(--accent)]"
                        />
                        Executing {execution.toolName}…
                      </div>
                    ) : (
                      <p className="text-xs leading-5 text-[var(--text-faint)]">
                        Run the selected tool to inspect its exact return
                        envelope.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid min-h-96 place-items-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-subtle)] text-center">
              <div>
                <TerminalSquare
                  aria-hidden="true"
                  className="mx-auto h-5 w-5 text-[var(--text-faint)]"
                />
                <p className="mt-3 text-sm text-white">No tools exported</p>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  Check the WebMCP catalog factory.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
