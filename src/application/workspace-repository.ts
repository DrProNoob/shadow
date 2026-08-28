import type { WorkspaceState } from "@/domain/model";

export interface WorkspaceRepository {
  load(): WorkspaceState | null;
  save(next: WorkspaceState): void;
}
