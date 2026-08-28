import { ORBIT_CATALOG } from "@/data/orbit/catalog";
import { parsePersistedWorkspace } from "@/data/orbit/persistence-schema";
import { ORBIT_ASSIGNMENTS, ORBIT_SUBSCRIPTIONS } from "@/data/orbit/usage";
import type { WorkspaceState } from "@/domain/model";

export const ORBIT_STORAGE_KEY = "shadow:orbit-workspace:v1";

const subscriptions = Object.values(ORBIT_SUBSCRIPTIONS);

const orbitSeed: WorkspaceState = {
  schemaVersion: 1,
  counters: {
    shadow: 0,
    change: 0,
    receipt: 0,
    activity: 0,
  },
  catalog: ORBIT_CATALOG,
  reality: {
    version: 1,
    asOfDate: "2026-08-28",
    companyId: "orbit",
    companyName: "ORBIT",
    employeeCount: Object.keys(ORBIT_CATALOG.people).length,
    subscriptionCount: subscriptions.length,
    monthlySoftwareCostCents: subscriptions.reduce(
      (total, subscription) => total + subscription.monthlyCostCents,
      0,
    ),
    currency: "USD",
    subscriptions: ORBIT_SUBSCRIPTIONS,
    assignments: ORBIT_ASSIGNMENTS,
  },
  shadows: {},
  receipts: {},
  activity: [],
};

export function serializeWorkspace(workspace: WorkspaceState): string {
  return JSON.stringify(workspace);
}

export function createOrbitSeed(): WorkspaceState {
  return JSON.parse(serializeWorkspace(orbitSeed)) as WorkspaceState;
}

export function parseWorkspace(value: string): WorkspaceState | null {
  try {
    return parsePersistedWorkspace(JSON.parse(value) as unknown);
  } catch {
    return null;
  }
}
