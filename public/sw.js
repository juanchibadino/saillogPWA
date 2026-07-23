const SHELL_CACHE_NAME = "dockout-shell-v1";
const APP_SHELL_ASSETS = [
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/icon-192x192-maskable.png",
  "/icons/icon-512x512-maskable.png",
  "/icons/apple-touch-icon.png",
];

function resolveNotificationUrl(value) {
  if (typeof value !== "string" || value.length === 0) {
    return "/";
  }

  try {
    const url = new URL(value, self.location.origin);

    if (url.origin !== self.location.origin) {
      return "/";
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== SHELL_CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (requestUrl.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          return (
            (await caches.match(request)) ??
            new Response("Offline", {
              status: 503,
              statusText: "Service Unavailable",
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        }
      })(),
    );
    return;
  }

  if (requestUrl.pathname.startsWith("/_next/")) {
    return;
  }

  if (requestUrl.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          const responseToCache = networkResponse.clone();
          void caches
            .open(SHELL_CACHE_NAME)
            .then((cache) => cache.put(request, responseToCache));
          return networkResponse;
        });
      }),
    );
  }
});

self.addEventListener("push", (event) => {
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = {
        body: event.data.text(),
      };
    }
  }

  const title =
    typeof payload.title === "string" && payload.title.trim().length > 0
      ? payload.title.trim()
      : "Dock Out";
  const body =
    typeof payload.body === "string" && payload.body.trim().length > 0
      ? payload.body.trim()
      : "You have a new team update.";
  const targetUrl = resolveNotificationUrl(payload.url);
  const tag =
    typeof payload.tag === "string" && payload.tag.trim().length > 0
      ? payload.tag.trim()
      : undefined;

  event.waitUntil(
    self.registration.showNotification(title, {
      badge: "/icons/icon-192x192-maskable.png",
      body,
      data: {
        url: targetUrl,
      },
      icon: "/icons/icon-192x192.png",
      tag,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = resolveNotificationUrl(event.notification.data?.url);

  event.waitUntil(
    (async () => {
      const targetAbsoluteUrl = new URL(targetUrl, self.location.origin).href;
      const windowClients = await self.clients.matchAll({
        includeUncontrolled: true,
        type: "window",
      });

      for (const client of windowClients) {
        const clientUrl = new URL(client.url);

        if (clientUrl.origin === self.location.origin && "focus" in client) {
          await client.focus();

          if ("navigate" in client && client.url !== targetAbsoluteUrl) {
            await client.navigate(targetAbsoluteUrl);
          }

          return;
        }
      }

      await self.clients.openWindow(targetUrl);
    })(),
  );
});
