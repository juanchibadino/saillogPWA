"use client";

import { useEffect } from "react";

const SAILOG_CACHE_PREFIX = "sailog-";

async function clearDevelopmentServiceWorkerState(): Promise<void> {
  const registrations = await navigator.serviceWorker.getRegistrations();

  await Promise.all(
    registrations
      .filter((registration) => {
        const scopeUrl = new URL(registration.scope);
        return scopeUrl.origin === window.location.origin;
      })
      .map((registration) => registration.unregister()),
  );

  if (!("caches" in window)) {
    return;
  }

  const cacheNames = await caches.keys();

  await Promise.all(
    cacheNames
      .filter((cacheName) => cacheName.startsWith(SAILOG_CACHE_PREFIX))
      .map((cacheName) => caches.delete(cacheName)),
  );
}

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      void clearDevelopmentServiceWorkerState();
      return;
    }

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
