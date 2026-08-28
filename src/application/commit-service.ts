import {
  realityDateActivityClock,
  recordSuccessfulActivity,
  type ActivityClock,
} from "@/application/activity";
import { validateEditableShadow } from "@/application/shadow-service";
import type {
  DomainError,
  Receipt,
  ReceiptId,
  RealityState,
  Result,
  Shadow,
  ShadowProjection,
  WorkspaceState,
} from "@/domain/model";
import { projectShadow } from "@/domain/projection";

/**
 * This token is intentionally owned by the human-facing application boundary.
 * It is not an attestation mechanism and must never be exposed as a WebMCP tool.
 */
export const UI_COMMIT_CONFIRMATION = "shadow-ui-confirmed" as const;

export type CommitShadowInput = {
  shadowId: string;
  confirmation: typeof UI_COMMIT_CONFIRMATION;
  acknowledgeWarnings?: boolean;
};

export type ReceiptIdFactory = {
  receiptId(sequence: number): ReceiptId;
};

export const deterministicReceiptIdFactory: ReceiptIdFactory = {
  receiptId: (sequence) => `receipt-${String(sequence).padStart(3, "0")}`,
};

export type CommitShadowOutput = {
  workspace: WorkspaceState;
  reality: RealityState;
  shadow: Shadow;
  receipt: Receipt;
  projection: ShadowProjection;
};

function failure<T>(error: DomainError): Result<T> {
  return { ok: false, error };
}

function cloneSerializable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function committedReality(
  workspace: WorkspaceState,
  projection: ShadowProjection,
): RealityState {
  const projected = projection.projectedReality;
  return {
    version: workspace.reality.version + 1,
    asOfDate: projected.asOfDate,
    companyId: projected.companyId,
    companyName: projected.companyName,
    employeeCount: projected.employeeCount,
    subscriptionCount: projected.subscriptionCount,
    monthlySoftwareCostCents: projected.monthlySoftwareCostCents,
    currency: projected.currency,
    subscriptions: Object.fromEntries(
      Object.entries(projected.subscriptions).map(([id, subscription]) => [
        id,
        { ...subscription },
      ]),
    ),
    assignments: projected.assignments.map((assignment) => ({
      ...assignment,
    })),
  };
}

export function commitShadow(
  workspace: WorkspaceState,
  input: CommitShadowInput,
  idFactory: ReceiptIdFactory = deterministicReceiptIdFactory,
  clock: ActivityClock = realityDateActivityClock,
): Result<CommitShadowOutput> {
  if (input.confirmation !== UI_COMMIT_CONFIRMATION) {
    return failure({
      code: "COMMIT_CONFIRMATION_REQUIRED",
      message: "Commit requires an explicit confirmation from the human UI.",
      retryable: true,
      details: { shadowId: input.shadowId },
    });
  }

  const shadowResult = validateEditableShadow(workspace, input.shadowId);
  if (!shadowResult.ok) return shadowResult;
  const shadow = shadowResult.value;

  if (shadow.changes.length === 0) {
    return failure({
      code: "EMPTY_SHADOW",
      message: `Shadow ${shadow.id} has no changes to commit.`,
      retryable: true,
      details: { shadowId: shadow.id },
    });
  }

  const projectionResult = projectShadow(
    workspace.reality,
    shadow,
    workspace.catalog,
  );
  if (!projectionResult.ok) return projectionResult;
  const projection = projectionResult.value;

  if (projection.hardBlockers.length > 0) {
    return failure({
      code: "COMMIT_BLOCKED",
      message: `Shadow ${shadow.id} has hard safety blockers and cannot be committed.`,
      retryable: true,
      details: {
        shadowId: shadow.id,
        blockerCodes: projection.hardBlockers.map((check) => check.code),
        blockerMessages: projection.hardBlockers.map((check) => check.message),
      },
    });
  }

  if (projection.warnings.length > 0 && input.acknowledgeWarnings !== true) {
    return failure({
      code: "WARNING_ACKNOWLEDGEMENT_REQUIRED",
      message: `Shadow ${shadow.id} has advisory warnings that require explicit acknowledgement.`,
      retryable: true,
      details: {
        shadowId: shadow.id,
        warningCodes: projection.warnings.map((check) => check.code),
        warningMessages: projection.warnings.map((check) => check.message),
      },
    });
  }

  const receiptSequence = workspace.counters.receipt + 1;
  const receiptId = idFactory.receiptId(receiptSequence);
  if (workspace.receipts[receiptId]) {
    return failure({
      code: "CHANGE_CONFLICT",
      message: `Generated receipt ID ${receiptId} already exists.`,
      retryable: false,
      details: { receiptId },
    });
  }

  const committedAt = clock(workspace);
  const nextReality = committedReality(workspace, projection);
  const committedShadow: Shadow = {
    ...shadow,
    status: "committed",
    intent: {
      ...shadow.intent,
      protectedTeamIds: [...shadow.intent.protectedTeamIds],
    },
    changes: shadow.changes.map((change) => cloneSerializable(change)),
  };
  const receipt: Receipt = {
    id: receiptId,
    receiptVersion: 1,
    shadowId: shadow.id,
    realityVersionBefore: workspace.reality.version,
    realityVersionAfter: nextReality.version,
    appliedChanges: projection.changes.map((projectedChange) => ({
      change: cloneSerializable(projectedChange.change),
      proof: cloneSerializable(projectedChange.proof),
    })),
    proofs: projection.proofs.map((proof) => cloneSerializable(proof)),
    totalImpact: { ...projection.totalImpact },
    committedAt,
  };
  const commandWorkspace: WorkspaceState = {
    ...workspace,
    counters: { ...workspace.counters, receipt: receiptSequence },
    reality: nextReality,
    shadows: {
      ...workspace.shadows,
      [committedShadow.id]: committedShadow,
    },
    receipts: { ...workspace.receipts, [receipt.id]: receipt },
  };
  const nextWorkspace = recordSuccessfulActivity(
    commandWorkspace,
    {
      source: "ui",
      commandName: "commit_shadow",
      arguments: {
        shadowId: shadow.id,
        confirmation: UI_COMMIT_CONFIRMATION,
        acknowledgeWarnings: input.acknowledgeWarnings === true,
        receiptId: receipt.id,
      },
      shadowId: committedShadow.id,
      shadowRevision: committedShadow.revision,
    },
    () => committedAt,
  );

  return {
    ok: true,
    value: {
      workspace: nextWorkspace,
      reality: nextReality,
      shadow: committedShadow,
      receipt,
      projection,
    },
  };
}
