import type { WorkspaceRepository } from "@/application/workspace-repository";
import { parseWorkspace, serializeWorkspace } from "@/data/orbit/seed";
import type { WorkspaceState } from "@/domain/model";

export class BrowserWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly key: string) {}

  load(): WorkspaceState | null {
    if (typeof window === "undefined") return null;
    try {
      const value = window.localStorage.getItem(this.key);
      return value ? parseWorkspace(value) : null;
    } catch {
      return null;
    }
  }

  save(next: WorkspaceState): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(this.key, serializeWorkspace(next));
  }
}
