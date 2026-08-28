import type { RiskLevel, ShadowId, ShadowStrategy } from "@/domain/model";

export type ComparedFutureView = {
  shadowId: ShadowId;
  name: string;
  strategy: ShadowStrategy;
  baseRealityVersion: number;
  revision: number;
  monthlySavingsCents: number;
  annualSavingsCents: number;
  savingsBasisPoints: number;
  actionCount: number;
  activeUsersAffected: number;
  activeEngineeringUsersAffected: number;
  contractPenaltyCents: number;
  risk: RiskLevel;
  blockerCount: number;
  warningCount: number;
};

export type ComparedProductState =
  | {
      kind: "keep";
      label?: string;
      planName?: string;
      seatCount?: number;
    }
  | {
      kind: "cancel";
      previousPlanName?: string;
      monthlySavingsCents?: number;
      contractPenaltyCents?: number;
      blocked?: boolean;
    }
  | {
      kind: "seat";
      planName?: string;
      previousSeats: number;
      proposedSeats: number;
      monthlySavingsCents?: number;
      activeUsersAffected?: number;
    }
  | {
      kind: "plan";
      previousPlanName: string;
      proposedPlanName: string;
      monthlySavingsCents?: number;
    }
  | {
      kind: "plan-and-seat";
      previousPlanName: string;
      proposedPlanName: string;
      previousSeats: number;
      proposedSeats: number;
      monthlySavingsCents?: number;
      activeUsersAffected?: number;
    };

export type ComparedProductRow = {
  subscriptionId: string;
  productName: string;
  category?: string;
  different: boolean;
  left: ComparedProductState;
  right: ComparedProductState;
};

export type HybridProposalView = {
  baseShadowId: ShadowId;
  sourceShadowId: ShadowId;
  sourceChangeId: string;
  sourceProductName: string;
  name: string;
  description: string;
};

/** Serializable read model. Event callbacks deliberately live in component props. */
export type CompareFuturesView = {
  realityVersion: number;
  left: ComparedFutureView;
  right: ComparedFutureView;
  products: ComparedProductRow[];
  hybridProposal?: HybridProposalView;
};
