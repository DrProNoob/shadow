import type { ReactNode } from "react";
import { WorkspaceProvider } from "@/components/shell/workspace-provider";
import { WorkspaceShell } from "@/components/shell/workspace-shell";
import { createOrbitSeed } from "@/data/orbit/seed";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider initialState={createOrbitSeed()}>
      <WorkspaceShell>{children}</WorkspaceShell>
    </WorkspaceProvider>
  );
}
