export type ISODate = `${number}-${number}-${number}`;
export type ISODateTime = `${ISODate}T${string}`;

export type CompanyId = "orbit";
export type TeamId = string;
export type PersonId = string;
export type ProductId = string;
export type PlanId = string;
export type ContractId = string;
export type SubscriptionId = string;
export type AssignmentId = string;
export type ShadowId = string;
export type ChangeId = string;
export type ReceiptId = string;
export type ActivityId = string;
export type Currency = "USD";

export type DomainErrorCode =
  | "INVALID_SHADOW_NAME"
  | "INVALID_INTENT"
  | "SHADOW_NOT_FOUND"
  | "SHADOW_NOT_DRAFT"
  | "SHADOW_STALE"
  | "SUBSCRIPTION_NOT_FOUND"
  | "PLAN_NOT_FOUND"
  | "PLAN_PRODUCT_MISMATCH"
  | "INVALID_SEAT_COUNT"
  | "NO_CHANGE"
  | "CHANGE_NOT_FOUND"
  | "CHANGE_CONFLICT"
  | "COMMIT_CONFIRMATION_REQUIRED"
  | "EMPTY_SHADOW"
  | "COMMIT_BLOCKED"
  | "WARNING_ACKNOWLEDGEMENT_REQUIRED"
  | "UNSUPPORTED_CHANGE";

export type DomainError = {
  code: DomainErrorCode;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
};

export type Result<T> =
  { ok: true; value: T } | { ok: false; error: DomainError };

export type CompanySummary = {
  companyId: CompanyId;
  companyName: "ORBIT";
  employeeCount: number;
  subscriptionCount: number;
  monthlySoftwareCostCents: number;
  currency: Currency;
  realityVersion: number;
  asOfDate: ISODate;
};

export type CompanyDefinition = {
  id: CompanyId;
  name: "ORBIT";
  description: string;
  fictional: true;
  teamIds: TeamId[];
};

export type Team = {
  id: TeamId;
  name: string;
  department: string;
  description: string;
  protected: boolean;
};

export type Person = {
  id: PersonId;
  displayName: string;
  role: string;
  teamId: TeamId;
  employmentStatus: "active";
};

export type Product = {
  id: ProductId;
  name: string;
  category:
    | "creative"
    | "collaboration"
    | "communication"
    | "productivity"
    | "observability"
    | "engineering"
    | "video"
    | "writing";
  description: string;
};

export type PricingModel =
  | { kind: "per-seat"; monthlyPerSeatCents: number }
  | {
      kind: "base-plus-seat";
      monthlyBaseCents: number;
      monthlyPerSeatCents: number;
    }
  | { kind: "flat"; monthlyFlatCents: number };

export type Plan = {
  id: PlanId;
  productId: ProductId;
  name: string;
  description: string;
  pricing: PricingModel;
};

export type PlanTransition = {
  id: string;
  productId: ProductId;
  fromPlanId: PlanId;
  toPlanId: PlanId;
  capabilityEffect: "preserving" | "reducing";
  approved: boolean;
  description: string;
};

export type ChangeCadence =
  "anytime" | "monthly" | "renewal-only" | "not-applicable";

export type ContractTerms = {
  id: ContractId;
  subscriptionId: SubscriptionId;
  startsAt: ISODate;
  renewsAt: ISODate;
  billingCadence: "monthly" | "annual";
  seatReductionCadence: ChangeCadence;
  minimumSeats: number;
  planChangeCadence: ChangeCadence;
  cancellationNoticeDays: number;
  cancellationPenaltyCents: number;
  summary: string;
};

export type DependencyCriticality = "critical" | "important" | "supporting";

export type OperationalDependency = {
  id: string;
  productId: ProductId;
  teamIds: TeamId[];
  criticality: DependencyCriticality;
  description: string;
};

export type UsageCohort = {
  id: string;
  subscriptionId: SubscriptionId;
  label: string;
  activeInLast90Days: boolean;
  personIds: PersonId[];
  note: string;
};

export type CompanyPolicies = {
  protectedActiveTeamIds: TeamId[];
  maximumContractPenaltyCents: number;
  blockCriticalServiceDisruption: boolean;
};

/** Static, fictional ORBIT facts. Mutable subscription state lives in Reality. */
export type OrbitCatalog = {
  version: 1;
  company: CompanyDefinition;
  teams: Record<TeamId, Team>;
  people: Record<PersonId, Person>;
  products: Record<ProductId, Product>;
  plans: Record<PlanId, Plan>;
  planTransitions: PlanTransition[];
  contracts: Record<ContractId, ContractTerms>;
  dependencies: OperationalDependency[];
  usageCohorts: UsageCohort[];
  policies: CompanyPolicies;
};

export type SubscriptionState = {
  id: SubscriptionId;
  productId: ProductId;
  planId: PlanId;
  contractId: ContractId;
  seatCount: number;
  monthlyCostCents: number;
  status: "active" | "cancelled";
};

export type LicenseAssignment = {
  id: AssignmentId;
  subscriptionId: SubscriptionId;
  personId: PersonId;
  activeInLast90Days: boolean;
  lastActiveAt?: ISODate;
  usageUnits90d: number;
};

export type RealityState = {
  version: number;
  asOfDate: ISODate;
  companyId: CompanyId;
  companyName: "ORBIT";
  employeeCount: number;
  subscriptionCount: number;
  monthlySoftwareCostCents: number;
  currency: Currency;
  subscriptions: Record<SubscriptionId, SubscriptionState>;
  assignments: LicenseAssignment[];
};

export type ShadowStrategy = "conservative" | "aggressive" | "custom";

export type IntentSpec = {
  minimumSavingsBasisPoints: number;
  protectedTeamIds: TeamId[];
  maximumContractPenaltyCents: number;
};

export type ChangeProvenance = {
  source: "ui" | "webmcp" | "demo-replay";
  commandName: string;
  copiedFromChangeId?: ChangeId;
};

type ShadowChangeBase = {
  id: ChangeId;
  shadowId: ShadowId;
  subscriptionId: SubscriptionId;
  provenance: ChangeProvenance;
};

export type SeatCountChange = ShadowChangeBase & {
  actionType: "seat-count";
  previousValue: number;
  proposedValue: number;
};

export type PlanChange = ShadowChangeBase & {
  actionType: "plan";
  previousValue: PlanId;
  proposedValue: PlanId;
};

export type CancellationChange = ShadowChangeBase & {
  actionType: "cancellation";
  previousValue: "active";
  proposedValue: "cancelled";
};

export type ShadowChange = SeatCountChange | PlanChange | CancellationChange;

export type RiskLevel = "low" | "medium" | "high";

export type Impact = {
  monthlySavingsCents: number;
  annualSavingsCents: number;
  savingsBasisPoints: number;
  contractPenaltyCents: number;
  activeUsersAffected: number;
  activeEngineeringUsersAffected: number;
  risk: RiskLevel;
};

export type ConstraintCheck = {
  code: string;
  label: string;
  severity: "advisory" | "hard-blocker";
  passed: boolean;
  message: string;
};

export type EvidenceRecord = {
  kind: "intent" | "usage" | "contract" | "dependency" | "calculation";
  label: string;
  value: string | number | boolean | string[];
  sourceId?: string;
};

export type ActionProof = {
  changeId: ChangeId;
  intent: IntentSpec;
  evidence: EvidenceRecord[];
  transition: { before: unknown; after: unknown };
  impact: Impact;
  checks: ConstraintCheck[];
  provenance: ChangeProvenance;
};

export type AllocationRemovalReason =
  "inactive" | "active-unprotected" | "active-protected";

export type RemovedAssignment = {
  assignmentId: AssignmentId;
  personId: PersonId;
  teamId: TeamId;
  activeInLast90Days: boolean;
  usageUnits90d: number;
  reason: AllocationRemovalReason;
};

export type ProjectedChange = {
  change: ShadowChange;
  before: SubscriptionState;
  after: SubscriptionState;
  removedAssignments: RemovedAssignment[];
  affectedPersonIds: PersonId[];
  affectedEngineeringPersonIds: PersonId[];
  impact: Impact;
  checks: ConstraintCheck[];
  proof: ActionProof;
};

/** Deliberately cannot be assigned back to Reality without an explicit commit. */
export type ProjectedRealityState = Omit<RealityState, "version"> & {
  kind: "shadow-projection";
  sourceRealityVersion: number;
};

export type ShadowProjection = {
  shadowId: ShadowId;
  baseRealityVersion: number;
  projectedReality: ProjectedRealityState;
  changes: ProjectedChange[];
  proofs: ActionProof[];
  checks: ConstraintCheck[];
  hardBlockers: ConstraintCheck[];
  warnings: ConstraintCheck[];
  totalImpact: Impact;
};

export type Shadow = {
  id: ShadowId;
  name: string;
  strategy: ShadowStrategy;
  parentShadowId?: ShadowId;
  baseRealityVersion: number;
  revision: number;
  status: "draft" | "committed";
  intent: IntentSpec;
  changes: ShadowChange[];
};

export type AppliedChange = {
  change: ShadowChange;
  proof: ActionProof;
};

export type Receipt = {
  id: ReceiptId;
  receiptVersion: 1;
  shadowId: ShadowId;
  realityVersionBefore: number;
  realityVersionAfter: number;
  appliedChanges: AppliedChange[];
  proofs: ActionProof[];
  totalImpact: Impact;
  committedAt: ISODateTime;
};

export type ActivityEvent = {
  id: ActivityId;
  source: "webmcp" | "ui" | "demo-replay";
  commandName: string;
  arguments: Record<string, unknown>;
  outcome: { ok: true } | { ok: false; errorCode: string; message: string };
  realityVersion: number;
  shadowId?: ShadowId;
  shadowRevision?: number;
  occurredAt: ISODateTime;
};

export type IdCounters = {
  shadow: number;
  change: number;
  receipt: number;
  activity: number;
};

export type WorkspaceState = {
  schemaVersion: 1;
  counters: IdCounters;
  catalog: OrbitCatalog;
  reality: RealityState;
  shadows: Record<ShadowId, Shadow>;
  receipts: Record<ReceiptId, Receipt>;
  activity: ActivityEvent[];
};
