import { describe, expect, it } from "vitest";
import { createWorkspaceStore } from "@/application/workspace-store";
import { createOrbitSeed, serializeWorkspace } from "@/data/orbit/seed";
import { InMemoryWorkspaceRepository } from "@/infrastructure/in-memory-workspace-repository";

describe("workspace store", () => {
  it("restores the exact seed when reset", () => {
    const seed = createOrbitSeed();
    const repository = new InMemoryWorkspaceRepository();
    const store = createWorkspaceStore(seed, repository);

    store.hydrate();
    store.reset();

    expect(serializeWorkspace(store.getSnapshot().workspace)).toBe(
      serializeWorkspace(seed),
    );
    expect(serializeWorkspace(repository.load()!)).toBe(
      serializeWorkspace(seed),
    );
  });
});
