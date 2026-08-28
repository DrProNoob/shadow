import type { WorkspaceRepository } from "@/application/workspace-repository";
import { serializeWorkspace } from "@/data/orbit/seed";
import type { WorkspaceState } from "@/domain/model";

export type WorkspaceSnapshot = {
  workspace: WorkspaceState;
  hydrated: boolean;
};

export type WorkspaceStore = {
  getSnapshot(): WorkspaceSnapshot;
  getServerSnapshot(): WorkspaceSnapshot;
  subscribe(listener: () => void): () => void;
  hydrate(): void;
  replace(next: WorkspaceState): void;
  reset(): void;
};

function clone(workspace: WorkspaceState): WorkspaceState {
  return JSON.parse(serializeWorkspace(workspace)) as WorkspaceState;
}

export function createWorkspaceStore(
  seed: WorkspaceState,
  repository: WorkspaceRepository,
): WorkspaceStore {
  const cleanSeed = clone(seed);
  const serverSnapshot: WorkspaceSnapshot = {
    workspace: cleanSeed,
    hydrated: false,
  };
  let snapshot = serverSnapshot;
  const listeners = new Set<() => void>();

  function publish(workspace: WorkspaceState, hydrated = true) {
    snapshot = { workspace: clone(workspace), hydrated };
    listeners.forEach((listener) => listener());
  }

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    hydrate() {
      const restored = repository.load();
      publish(restored ?? cleanSeed);
    },
    replace(next) {
      const durableNext = clone(next);
      repository.save(durableNext);
      publish(durableNext);
    },
    reset() {
      const durableSeed = clone(cleanSeed);
      repository.save(durableSeed);
      publish(durableSeed);
    },
  };
}
