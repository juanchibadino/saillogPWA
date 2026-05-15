"use client";

import { useCallback, useEffect, useState } from "react";
import { BugIcon, RefreshCwIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type PwaDebugPanelProps = {
  enabled: boolean;
};

type PwaDebugSnapshot = {
  displayMode: "standalone" | "fullscreen" | "minimal-ui" | "browser";
  isStandalone: boolean;
  isSecureContext: boolean;
  isOnline: boolean;
  serviceWorkerSupported: boolean;
  serviceWorkerControllerState: string | null;
  serviceWorkerScope: string | null;
  serviceWorkerActiveState: string | null;
  serviceWorkerWaitingState: string | null;
  serviceWorkerInstallingState: string | null;
  manifestHref: string | null;
  beforeInstallPromptSeen: boolean;
  appInstalledSeen: boolean;
  generatedAt: string;
};

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

function resolveDisplayMode(): PwaDebugSnapshot["displayMode"] {
  if (typeof window === "undefined") {
    return "browser";
  }

  if (window.matchMedia("(display-mode: standalone)").matches) {
    return "standalone";
  }

  if (window.matchMedia("(display-mode: fullscreen)").matches) {
    return "fullscreen";
  }

  if (window.matchMedia("(display-mode: minimal-ui)").matches) {
    return "minimal-ui";
  }

  return "browser";
}

function toYesNo(value: boolean): string {
  return value ? "yes" : "no";
}

export function PwaDebugPanel({ enabled }: PwaDebugPanelProps) {
  const [beforeInstallPromptSeen, setBeforeInstallPromptSeen] = useState(false);
  const [appInstalledSeen, setAppInstalledSeen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [snapshot, setSnapshot] = useState<PwaDebugSnapshot | null>(null);

  const refreshSnapshot = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }

    setIsRefreshing(true);

    try {
      const navigatorStandalone = (window.navigator as NavigatorWithStandalone).standalone === true;
      const displayMode = resolveDisplayMode();
      const isStandalone = displayMode !== "browser" || navigatorStandalone;
      const manifestElement = document.querySelector(
        "link[rel='manifest']",
      ) as HTMLLinkElement | null;

      const nextSnapshot: PwaDebugSnapshot = {
        displayMode,
        isStandalone,
        isSecureContext: window.isSecureContext,
        isOnline: window.navigator.onLine,
        serviceWorkerSupported: "serviceWorker" in navigator,
        serviceWorkerControllerState: null,
        serviceWorkerScope: null,
        serviceWorkerActiveState: null,
        serviceWorkerWaitingState: null,
        serviceWorkerInstallingState: null,
        manifestHref: manifestElement?.href ?? null,
        beforeInstallPromptSeen,
        appInstalledSeen,
        generatedAt: new Date().toISOString(),
      };

      if ("serviceWorker" in navigator) {
        nextSnapshot.serviceWorkerControllerState =
          navigator.serviceWorker.controller?.state ?? null;

        try {
          const registration =
            (await navigator.serviceWorker.getRegistration("/")) ??
            (await navigator.serviceWorker.getRegistration());

          if (registration) {
            nextSnapshot.serviceWorkerScope = registration.scope;
            nextSnapshot.serviceWorkerActiveState = registration.active?.state ?? null;
            nextSnapshot.serviceWorkerWaitingState = registration.waiting?.state ?? null;
            nextSnapshot.serviceWorkerInstallingState = registration.installing?.state ?? null;
          }
        } catch {
          // Ignore registration inspection errors in unsupported/private contexts.
        }
      }

      setSnapshot(nextSnapshot);
    } finally {
      setIsRefreshing(false);
    }
  }, [appInstalledSeen, beforeInstallPromptSeen]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleBeforeInstallPrompt = () => {
      setBeforeInstallPromptSeen(true);
    };

    const handleAppInstalled = () => {
      setAppInstalledSeen(true);
    };

    const handleConnectionChange = () => {
      void refreshSnapshot();
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("online", handleConnectionChange);
    window.addEventListener("offline", handleConnectionChange);
    navigator.serviceWorker?.addEventListener("controllerchange", handleConnectionChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("online", handleConnectionChange);
      window.removeEventListener("offline", handleConnectionChange);
      navigator.serviceWorker?.removeEventListener(
        "controllerchange",
        handleConnectionChange,
      );
    };
  }, [enabled, refreshSnapshot]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void refreshSnapshot();
  }, [enabled, refreshSnapshot]);

  if (!enabled) {
    return null;
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-[0.7rem]"
            aria-label="Open PWA debug panel"
          />
        }
      >
        <BugIcon aria-hidden="true" />
        PWA
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100%-1.5rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>PWA Debug</DialogTitle>
          <DialogDescription>
            Internal status panel for installability and service worker checks.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Mode: {snapshot?.displayMode ?? "loading"}</Badge>
            <Badge variant="secondary">Online: {toYesNo(snapshot?.isOnline ?? false)}</Badge>
            <Badge variant="secondary">
              SW: {toYesNo(snapshot?.serviceWorkerSupported ?? false)}
            </Badge>
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Standalone</dt>
            <dd>{snapshot ? toYesNo(snapshot.isStandalone) : "..."}</dd>

            <dt className="text-muted-foreground">Secure context</dt>
            <dd>{snapshot ? toYesNo(snapshot.isSecureContext) : "..."}</dd>

            <dt className="text-muted-foreground">Manifest link</dt>
            <dd className="truncate">{snapshot?.manifestHref ?? "not found"}</dd>

            <dt className="text-muted-foreground">Install event seen</dt>
            <dd>{snapshot ? toYesNo(snapshot.beforeInstallPromptSeen) : "..."}</dd>

            <dt className="text-muted-foreground">App installed event</dt>
            <dd>{snapshot ? toYesNo(snapshot.appInstalledSeen) : "..."}</dd>

            <dt className="text-muted-foreground">SW controller</dt>
            <dd>{snapshot?.serviceWorkerControllerState ?? "none"}</dd>

            <dt className="text-muted-foreground">SW scope</dt>
            <dd className="truncate">{snapshot?.serviceWorkerScope ?? "none"}</dd>

            <dt className="text-muted-foreground">SW active</dt>
            <dd>{snapshot?.serviceWorkerActiveState ?? "none"}</dd>

            <dt className="text-muted-foreground">SW waiting</dt>
            <dd>{snapshot?.serviceWorkerWaitingState ?? "none"}</dd>

            <dt className="text-muted-foreground">SW installing</dt>
            <dd>{snapshot?.serviceWorkerInstallingState ?? "none"}</dd>

            <dt className="text-muted-foreground">Snapshot time</dt>
            <dd>{snapshot?.generatedAt ?? "..."}</dd>
          </dl>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isRefreshing}
              onClick={() => void refreshSnapshot()}
            >
              <RefreshCwIcon aria-hidden="true" className={isRefreshing ? "animate-spin" : ""} />
              Refresh
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
