import { ORBIT_CONTRACTS } from "@/data/orbit/contracts";
import {
  ORBIT_PEOPLE,
  ORBIT_TEAM_ORDER,
  ORBIT_TEAMS,
} from "@/data/orbit/people";
import { ORBIT_USAGE_COHORTS } from "@/data/orbit/usage";
import type {
  OperationalDependency,
  OrbitCatalog,
  Plan,
  PlanId,
  PlanTransition,
  Product,
  ProductId,
} from "@/domain/model";

export const ORBIT_PRODUCTS: Record<ProductId, Product> = {
  "product-adobe": {
    id: "product-adobe",
    name: "Adobe",
    category: "creative",
    description: "Creative production suite used by Design and Marketing.",
  },
  "product-figma": {
    id: "product-figma",
    name: "Figma",
    category: "creative",
    description: "Collaborative product design and prototyping workspace.",
  },
  "product-slack": {
    id: "product-slack",
    name: "Slack",
    category: "communication",
    description: "Company-wide operational communication layer.",
  },
  "product-notion": {
    id: "product-notion",
    name: "Notion",
    category: "productivity",
    description: "Internal knowledge base and project documentation system.",
  },
  "product-zoom": {
    id: "product-zoom",
    name: "Zoom",
    category: "video",
    description: "Video meetings for customer and internal collaboration.",
  },
  "product-miro": {
    id: "product-miro",
    name: "Miro",
    category: "collaboration",
    description: "Visual planning boards used in workshops and discovery.",
  },
  "product-datadog": {
    id: "product-datadog",
    name: "Datadog",
    category: "observability",
    description:
      "Production monitoring, alerting, logging, and incident telemetry.",
  },
  "product-atlassian": {
    id: "product-atlassian",
    name: "Atlassian",
    category: "engineering",
    description: "Jira and Confluence enterprise suite for software delivery.",
  },
  "product-loom": {
    id: "product-loom",
    name: "Loom",
    category: "video",
    description: "Asynchronous screen recording workspace.",
  },
  "product-grammarly": {
    id: "product-grammarly",
    name: "Grammarly",
    category: "writing",
    description: "Writing assistance for customer-facing and internal content.",
  },
};

export const ORBIT_PLANS: Record<PlanId, Plan> = {
  "plan-adobe-enterprise": {
    id: "plan-adobe-enterprise",
    productId: "product-adobe",
    name: "Enterprise",
    description: "Fictional blended enterprise seat price.",
    pricing: { kind: "per-seat", monthlyPerSeatCents: 8_000 },
  },
  "plan-figma-organization": {
    id: "plan-figma-organization",
    productId: "product-figma",
    name: "Organization",
    description: "Fictional blended organization seat price.",
    pricing: { kind: "per-seat", monthlyPerSeatCents: 26_500 },
  },
  "plan-slack-business-plus": {
    id: "plan-slack-business-plus",
    productId: "product-slack",
    name: "Business+",
    description: "Fictional blended active-seat price.",
    pricing: { kind: "per-seat", monthlyPerSeatCents: 5_000 },
  },
  "plan-notion-enterprise": {
    id: "plan-notion-enterprise",
    productId: "product-notion",
    name: "Enterprise",
    description: "Current enterprise knowledge-management tier.",
    pricing: { kind: "per-seat", monthlyPerSeatCents: 8_000 },
  },
  "plan-notion-business": {
    id: "plan-notion-business",
    productId: "product-notion",
    name: "Business",
    description: "Lower tier with a fictional platform base plus seat price.",
    pricing: {
      kind: "base-plus-seat",
      monthlyBaseCents: 772_500,
      monthlyPerSeatCents: 2_500,
    },
  },
  "plan-zoom-business": {
    id: "plan-zoom-business",
    productId: "product-zoom",
    name: "Business",
    description: "Fictional blended meeting-host seat price.",
    pricing: { kind: "per-seat", monthlyPerSeatCents: 5_000 },
  },
  "plan-miro-enterprise": {
    id: "plan-miro-enterprise",
    productId: "product-miro",
    name: "Enterprise",
    description: "Fictional enterprise collaboration seat price.",
    pricing: { kind: "per-seat", monthlyPerSeatCents: 6_000 },
  },
  "plan-datadog-commit": {
    id: "plan-datadog-commit",
    productId: "product-datadog",
    name: "Usage commit",
    description: "Fixed fictional infrastructure usage commitment.",
    pricing: { kind: "flat", monthlyFlatCents: 4_453_500 },
  },
  "plan-atlassian-enterprise": {
    id: "plan-atlassian-enterprise",
    productId: "product-atlassian",
    name: "Enterprise suite",
    description: "Fixed fictional Jira and Confluence enterprise commitment.",
    pricing: { kind: "flat", monthlyFlatCents: 2_800_000 },
  },
  "plan-loom-business": {
    id: "plan-loom-business",
    productId: "product-loom",
    name: "Business",
    description: "Fixed fictional month-to-month workspace price.",
    pricing: { kind: "flat", monthlyFlatCents: 901_000 },
  },
  "plan-grammarly-business": {
    id: "plan-grammarly-business",
    productId: "product-grammarly",
    name: "Business",
    description: "Fictional blended writing-assistance seat price.",
    pricing: { kind: "per-seat", monthlyPerSeatCents: 5_000 },
  },
};

export const ORBIT_PLAN_TRANSITIONS: PlanTransition[] = [
  {
    id: "transition-notion-enterprise-to-business",
    productId: "product-notion",
    fromPlanId: "plan-notion-enterprise",
    toPlanId: "plan-notion-business",
    capabilityEffect: "preserving",
    approved: true,
    description:
      "ORBIT's contracted Business conversion preserves every capability used by the current workspace; this is a commercial packaging change, not a user-facing downgrade.",
  },
];

export const ORBIT_DEPENDENCIES: OperationalDependency[] = [
  {
    id: "dependency-adobe-creative",
    productId: "product-adobe",
    teamIds: ["team-design", "team-marketing"],
    criticality: "important",
    description: "Required for active creative production workflows.",
  },
  {
    id: "dependency-figma-product",
    productId: "product-figma",
    teamIds: ["team-engineering", "team-design", "team-product"],
    criticality: "important",
    description:
      "Connects product specifications, prototypes, and implementation.",
  },
  {
    id: "dependency-figma-marketing",
    productId: "product-figma",
    teamIds: ["team-marketing"],
    criticality: "supporting",
    description: "Supports campaign and lightweight brand collaboration.",
  },
  {
    id: "dependency-slack-company",
    productId: "product-slack",
    teamIds: [...ORBIT_TEAM_ORDER],
    criticality: "important",
    description:
      "Primary company-wide communication and incident coordination channel.",
  },
  {
    id: "dependency-notion-knowledge",
    productId: "product-notion",
    teamIds: [...ORBIT_TEAM_ORDER],
    criticality: "supporting",
    description: "Shared internal knowledge and process documentation.",
  },
  {
    id: "dependency-zoom-revenue",
    productId: "product-zoom",
    teamIds: ["team-sales", "team-marketing", "team-people"],
    criticality: "important",
    description: "Supports external calls, webinars, and candidate interviews.",
  },
  {
    id: "dependency-miro-workshops",
    productId: "product-miro",
    teamIds: ["team-design", "team-product", "team-marketing"],
    criticality: "supporting",
    description: "Used for occasional planning and discovery workshops.",
  },
  {
    id: "dependency-datadog-production",
    productId: "product-datadog",
    teamIds: ["team-engineering"],
    criticality: "critical",
    description:
      "Removing service would break production monitoring and incident response.",
  },
  {
    id: "dependency-atlassian-delivery",
    productId: "product-atlassian",
    teamIds: ["team-engineering", "team-product"],
    criticality: "critical",
    description:
      "System of record for software delivery and operational runbooks.",
  },
  {
    id: "dependency-loom-async-video",
    productId: "product-loom",
    teamIds: ["team-sales", "team-operations"],
    criticality: "supporting",
    description:
      "Optional asynchronous video workflow with no observed recent use.",
  },
  {
    id: "dependency-grammarly-writing",
    productId: "product-grammarly",
    teamIds: ["team-marketing", "team-sales", "team-people"],
    criticality: "supporting",
    description:
      "Assists customer-facing writing but is not operationally critical.",
  },
];

export const ORBIT_CATALOG: OrbitCatalog = {
  version: 1,
  company: {
    id: "orbit",
    name: "ORBIT",
    description:
      "A fictional 312-person software company built for the SHADOW demo.",
    fictional: true,
    teamIds: [...ORBIT_TEAM_ORDER],
  },
  teams: ORBIT_TEAMS,
  people: ORBIT_PEOPLE,
  products: ORBIT_PRODUCTS,
  plans: ORBIT_PLANS,
  planTransitions: ORBIT_PLAN_TRANSITIONS,
  contracts: ORBIT_CONTRACTS,
  dependencies: ORBIT_DEPENDENCIES,
  usageCohorts: ORBIT_USAGE_COHORTS,
  policies: {
    protectedActiveTeamIds: ["team-engineering"],
    maximumContractPenaltyCents: 0,
    blockCriticalServiceDisruption: true,
  },
};
