"use client";

import { useRouter } from "next/navigation";
import { FileQuestion } from "lucide-react";
import { useWorkspace } from "@/components/shell/workspace-provider";
import { ReceiptDetail } from "@/components/receipts/receipt-detail";
import { ReceiptHistory } from "@/components/receipts/receipt-history";
import type {
  ReceiptChangeView,
  ReceiptDetailView,
  ReceiptHistoryItemView,
} from "@/components/receipts/receipt-model";
import type {
  EvidenceRecord,
  Receipt,
  ShadowChange,
  WorkspaceState,
} from "@/domain/model";

function evidenceValue(value: EvidenceRecord["value"]): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString("en-US");
  return value;
}

function changeLabels(
  workspace: WorkspaceState,
  change: ShadowChange,
): { before: string; after: string } {
  if (change.actionType === "seat-count") {
    return {
      before: `${change.previousValue} seats`,
      after: `${change.proposedValue} seats`,
    };
  }
  if (change.actionType === "plan") {
    return {
      before:
        workspace.catalog.plans[change.previousValue]?.name ??
        change.previousValue,
      after:
        workspace.catalog.plans[change.proposedValue]?.name ??
        change.proposedValue,
    };
  }
  return { before: "Active", after: "Cancelled" };
}

function receiptChangeView(
  workspace: WorkspaceState,
  receipt: Receipt,
  index: number,
): ReceiptChangeView {
  const applied = receipt.appliedChanges[index];
  const subscription =
    workspace.reality.subscriptions[applied.change.subscriptionId];
  const productName = subscription
    ? workspace.catalog.products[subscription.productId]?.name
    : undefined;
  const labels = changeLabels(workspace, applied.change);

  return {
    changeId: applied.change.id,
    productName: productName ?? applied.change.subscriptionId,
    actionType: applied.change.actionType,
    beforeLabel: labels.before,
    afterLabel: labels.after,
    monthlySavingsCents: applied.proof.impact.monthlySavingsCents,
    annualSavingsCents: applied.proof.impact.annualSavingsCents,
    activeUsersAffected: applied.proof.impact.activeUsersAffected,
    contractPenaltyCents: applied.proof.impact.contractPenaltyCents,
    proof: {
      evidenceCount: applied.proof.evidence.length,
      evidenceHighlights: applied.proof.evidence.slice(0, 4).map((record) => ({
        label: record.label,
        value: evidenceValue(record.value),
      })),
      checks: applied.proof.checks,
      provenanceSource: applied.proof.provenance.source,
      commandName: applied.proof.provenance.commandName,
    },
  };
}

function receiptDetailView(
  workspace: WorkspaceState,
  receipt: Receipt,
): ReceiptDetailView {
  return {
    receiptId: receipt.id,
    receiptVersion: receipt.receiptVersion,
    shadowId: receipt.shadowId,
    shadowName: workspace.shadows[receipt.shadowId]?.name ?? receipt.shadowId,
    committedAt: receipt.committedAt,
    realityVersionBefore: receipt.realityVersionBefore,
    realityVersionAfter: receipt.realityVersionAfter,
    totalImpact: receipt.totalImpact,
    changes: receipt.appliedChanges.map((_, index) =>
      receiptChangeView(workspace, receipt, index),
    ),
  };
}

function historyItem(
  workspace: WorkspaceState,
  receipt: Receipt,
): ReceiptHistoryItemView {
  return {
    receiptId: receipt.id,
    shadowId: receipt.shadowId,
    shadowName: workspace.shadows[receipt.shadowId]?.name ?? receipt.shadowId,
    committedAt: receipt.committedAt,
    realityVersionBefore: receipt.realityVersionBefore,
    realityVersionAfter: receipt.realityVersionAfter,
    changeCount: receipt.appliedChanges.length,
    monthlySavingsCents: receipt.totalImpact.monthlySavingsCents,
    annualSavingsCents: receipt.totalImpact.annualSavingsCents,
    activeUsersAffected: receipt.totalImpact.activeUsersAffected,
  };
}

export function ReceiptsWorkspace({ receiptId }: { receiptId?: string }) {
  const router = useRouter();
  const { workspace, hydrated } = useWorkspace();

  if (!hydrated) {
    return (
      <div
        role="status"
        className="py-16 text-center text-sm text-[var(--text-muted)]"
      >
        Restoring deterministic history…
      </div>
    );
  }

  if (receiptId) {
    const receipt = workspace.receipts[receiptId];
    if (!receipt) {
      return (
        <section className="mx-auto grid min-h-80 max-w-2xl place-items-center rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
          <div>
            <FileQuestion
              aria-hidden="true"
              className="mx-auto h-5 w-5 text-[var(--text-faint)]"
            />
            <h1 className="mt-4 text-lg font-medium text-white">
              Receipt not found
            </h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              This browser workspace does not contain receipt {receiptId}.
            </p>
            <button
              type="button"
              onClick={() => router.push("/receipts")}
              className="mt-5 h-9 rounded-lg border border-[var(--border)] px-4 text-xs text-white hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              View receipt history
            </button>
          </div>
        </section>
      );
    }
    return (
      <ReceiptDetail
        receipt={receiptDetailView(workspace, receipt)}
        onBack={() => router.push("/receipts")}
      />
    );
  }

  const receipts = Object.values(workspace.receipts)
    .sort(
      (left, right) =>
        right.realityVersionAfter - left.realityVersionAfter ||
        right.id.localeCompare(left.id),
    )
    .map((receipt) => historyItem(workspace, receipt));
  return (
    <ReceiptHistory
      receipts={receipts}
      onSelectReceipt={(selectedReceiptId) =>
        router.push(`/receipts/${selectedReceiptId}`)
      }
    />
  );
}
