"use client";

import { getPeopleOverview } from "@/application/queries";
import { PeopleView } from "@/components/reality/people-view";
import { useWorkspace } from "@/components/shell/workspace-provider";

export default function PeoplePage() {
  const { workspace } = useWorkspace();
  return <PeopleView overview={getPeopleOverview(workspace)} />;
}
