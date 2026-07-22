"use client";

import { useEffect } from "react";

const DEVELOPMENT_SW_CLEANUP_RELOAD_KEY = "dockout-dev-sw-cleanup-reloaded";
const APP_CACHE_NAME_PATTERN = /^(dockout-|sailog-)/;

async function clearDevelopmentServiceWorkerState(): Promise<boolean> {
  const registrations = await navigator.serviceWorker.getRegistrations();
  const sameOriginRegistrations = registrations.filter((registration) => {
    const scopeUrl = new URL(registration.scope);
    return scopeUrl.origin === window.location.origin;
  });

  await Promise.all(
    sameOriginRegistrations.map((registration) => registration.unregister()),
  );

  if (!("caches" in window)) {
    return sameOriginRegistrations.length > 0;
  }

  const cacheNames = (await caches.keys()).filter((cacheName) =>
    APP_CACHE_NAME_PATTERN.test(cacheName),
  );

  await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));

  return sameOriginRegistrations.length > 0 || cacheNames.length > 0;
}

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      void (async () => {
        const wasControlledByServiceWorker = Boolean(navigator.serviceWorker.controller);
        const hadDevelopmentServiceWorkerState =
          await clearDevelopmentServiceWorkerState();

        if (!wasControlledByServiceWorker && !hadDevelopmentServiceWorkerState) {
          window.sessionStorage.removeItem(DEVELOPMENT_SW_CLEANUP_RELOAD_KEY);
          return;
        }

        if (window.sessionStorage.getItem(DEVELOPMENT_SW_CLEANUP_RELOAD_KEY) === "true") {
          return;
        }

        window.sessionStorage.setItem(DEVELOPMENT_SW_CLEANUP_RELOAD_KEY, "true");
        window.location.reload();
      })();
      return;
    }

    window.sessionStorage.removeItem(DEVELOPMENT_SW_CLEANUP_RELOAD_KEY);

    const registerServiceWorker = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
      } catch {
        // Ignore registration errors to avoid blocking app usage.
      }
    };

    void registerServiceWorker();
  }, []);

  return null;
}
