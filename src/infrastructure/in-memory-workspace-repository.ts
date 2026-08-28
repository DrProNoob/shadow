import type { WorkspaceRepository } from "@/application/workspace-repository";
import { parseWorkspace, serializeWorkspace } from "@/data/orbit/seed";
import type { WorkspaceState } from "@/domain/model";

export class InMemoryWorkspaceRepository implements WorkspaceRepository {
  private serialized: string | null;

  constructor(initial?: WorkspaceState) {
    this.serialized = initial ? serializeWorkspace(initial) : null;
  }

  load(): WorkspaceState | null {
    return this.serialized ? parseWorkspace(this.serialized) : null;
  }

  save(next: WorkspaceState): void {
    this.serialized = serializeWorkspace(next);
  }
}
