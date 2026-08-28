import type {
  ConstraintCheck,
  Impact,
  ISODateTime,
  ReceiptId,
  ShadowChange,
  ShadowId,
} from "@/domain/model";

export type ReceiptHistoryItemView = {
  receiptId: ReceiptId;
  shadowId: ShadowId;
  shadowName: string;
  committedAt: ISODateTime;
  realityVersionBefore: number;
  realityVersionAfter: number;
  changeCount: number;
  monthlySavingsCents: number;
  annualSavingsCents: number;
  activeUsersAffected: number;
};

export type ReceiptEvidenceHighlight = {
  label: string;
  value: string;
};

export type ReceiptProofSummaryView = {
  evidenceCount: number;
  evidenceHighlights: ReceiptEvidenceHighlight[];
  checks: ConstraintCheck[];
  provenanceSource: "ui" | "webmcp" | "demo-replay";
  commandName: string;
};

export type ReceiptChangeView = {
  changeId: string;
  productName: string;
  actionType: ShadowChange["actionType"];
  beforeLabel: string;
  afterLabel: string;
  monthlySavingsCents: number;
  annualSavingsCents: number;
  activeUsersAffected: number;
  contractPenaltyCents: number;
  proof: ReceiptProofSummaryView;
};

/** Serializable snapshot read model for a committed synthetic Reality update. */
export type ReceiptDetailView = {
  receiptId: ReceiptId;
  receiptVersion: 1;
  shadowId: ShadowId;
  shadowName: string;
  committedAt: ISODateTime;
  realityVersionBefore: number;
  realityVersionAfter: number;
  totalImpact: Impact;
  changes: ReceiptChangeView[];
};
