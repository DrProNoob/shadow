"use client";

import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  createWorkspaceStore,
  type WorkspaceSnapshot,
  type WorkspaceStore,
} from "@/application/workspace-store";
import { ORBIT_STORAGE_KEY } from "@/data/orbit/seed";
import type { WorkspaceState } from "@/domain/model";
import { BrowserWorkspaceRepository } from "@/infrastructure/browser-workspace-repository";
import {
  useWebMcpRegistrar,
  type WebMcpStatus,
} from "@/webmcp/webmcp-registrar";

type WorkspaceContextValue = WorkspaceSnapshot & {
  store: WorkspaceStore;
  webMcpStatus: WebMcpStatus;
  activeShadowId: string | null;
  selectReality(): void;
  selectShadow(shadowId: string): void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  initialState,
  children,
}: {
  initialState: WorkspaceState;
  children: ReactNode;
}) {
  const [store] = useState(() =>
    createWorkspaceStore(
      initialState,
      new BrowserWorkspaceRepository(ORBIT_STORAGE_KEY),
    ),
  );
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  const [selectedShadowId, setSelectedShadowId] = useState<
    string | null | undefined
  >(undefined);
  const automaticallySelectedShadowId = snapshot.hydrated
    ? Object.values(snapshot.workspace.shadows)
        .filter(
          (shadow) =>
            shadow.status === "draft" &&
            shadow.baseRealityVersion === snapshot.workspace.reality.version,
        )
        .at(-1)?.id
    : undefined;
  const activeShadowId =
    selectedShadowId === undefined
      ? (automaticallySelectedShadowId ?? null)
      : selectedShadowId !== null &&
          snapshot.workspace.shadows[selectedShadowId]
        ? selectedShadowId
        : null;
  const replaceUrlContext = useCallback((context: string) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("context", context);
    window.history.replaceState(window.history.state, "", url);
  }, []);
  const selectReality = useCallback(() => {
    setSelectedShadowId(null);
    replaceUrlContext("reality");
  }, [replaceUrlContext]);
  const selectShadow = useCallback(
    (shadowId: string) => {
      setSelectedShadowId(shadowId);
      replaceUrlContext(shadowId);
    },
    [replaceUrlContext],
  );
  const handleWebMcpMutation = useCallback(
    ({ shadowId }: { shadowId: string }) => selectShadow(shadowId),
    [selectShadow],
  );
  const webMcpStatus = useWebMcpRegistrar(
    store,
    snapshot.hydrated,
    handleWebMcpMutation,
  );

  useEffect(() => {
    store.hydrate();
  }, [store]);

  useEffect(() => {
    if (!snapshot.hydrated || selectedShadowId !== undefined) return;
    const task = window.setTimeout(() => {
      const context = new URL(window.location.href).searchParams.get("context");
      if (context === "reality") {
        setSelectedShadowId(null);
      } else if (context && snapshot.workspace.shadows[context]) {
        setSelectedShadowId(context);
      }
    }, 0);
    return () => window.clearTimeout(task);
  }, [selectedShadowId, snapshot.hydrated, snapshot.workspace.shadows]);

  return (
    <WorkspaceContext.Provider
      value={{
        ...snapshot,
        store,
        webMcpStatus,
        activeShadowId,
        selectReality,
        selectShadow,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return value;
}
