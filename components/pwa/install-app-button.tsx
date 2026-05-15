"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

function isRunningStandaloneMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const isDisplayModeStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const isNavigatorStandalone = (window.navigator as NavigatorWithStandalone).standalone === true;

  return isDisplayModeStandalone || isNavigatorStandalone;
}

export function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [isPromptOpen, setIsPromptOpen] = useState(false);

  useEffect(() => {
    if (isRunningStandaloneMode()) {
      return;
    }

    const handleBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const canInstall = deferredPrompt !== null;

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    setIsPromptOpen(true);

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;

      if (choice.outcome === "accepted") {
        setDeferredPrompt(null);
      }
    } finally {
      setIsPromptOpen(false);
      setDeferredPrompt(null);
    }
  };

  if (!canInstall) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => void handleInstall()}
      disabled={isPromptOpen}
      aria-label="Install Sailog app"
    >
      <Download aria-hidden="true" />
      {isPromptOpen ? "Installing..." : "Install App"}
    </Button>
  );
}
