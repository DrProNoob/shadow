import type {
  ActivityEvent,
  ISODateTime,
  ShadowId,
  WorkspaceState,
} from "@/domain/model";

export type ActivityClock = (workspace: WorkspaceState) => ISODateTime;

/**
 * A deterministic scenario clock. The fixture date is stable, and activity
 * ordering is carried by the monotonic activity ID rather than wall time.
 */
export const realityDateActivityClock: ActivityClock = (workspace) =>
  `${workspace.reality.asOfDate}T12:00:00.000Z`;

export type RecordSuccessfulActivityInput = {
  source: ActivityEvent["source"];
  commandName: string;
  arguments: Record<string, unknown>;
  shadowId: ShadowId;
  shadowRevision: number;
};

export function recordSuccessfulActivity(
  workspace: WorkspaceState,
  input: RecordSuccessfulActivityInput,
  clock: ActivityClock = realityDateActivityClock,
): WorkspaceState {
  const sequence = workspace.counters.activity + 1;
  const event: ActivityEvent = {
    id: `activity-${String(sequence).padStart(3, "0")}`,
    source: input.source,
    commandName: input.commandName,
    arguments: { ...input.arguments },
    outcome: { ok: true },
    realityVersion: workspace.reality.version,
    shadowId: input.shadowId,
    shadowRevision: input.shadowRevision,
    occurredAt: clock(workspace),
  };

  return {
    ...workspace,
    counters: { ...workspace.counters, activity: sequence },
    activity: [...workspace.activity, event],
  };
}
