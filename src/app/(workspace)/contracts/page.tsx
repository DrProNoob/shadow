"use client";

import { listContracts } from "@/application/queries";
import { ContractsView } from "@/components/reality/contracts-view";
import { useWorkspace } from "@/components/shell/workspace-provider";

export default function ContractsPage() {
  const { workspace } = useWorkspace();
  return <ContractsView contracts={listContracts(workspace)} />;
}
