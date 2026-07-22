import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { Inter } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeColorMeta } from "@/components/theme-color-meta";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { Toaster } from "@/components/ui/sonner";

const DEVELOPMENT_SW_CLEANUP_SCRIPT = `
(function () {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  var reloadKey = "dockout-dev-sw-cleanup-reloaded";
  var appCacheNamePattern = /^(dockout-|sailog-)/;

  function clearAppCaches() {
    if (!("caches" in window)) {
      return Promise.resolve(0);
    }

    return caches.keys().then(function (cacheNames) {
      var appCacheNames = cacheNames.filter(function (cacheName) {
        return appCacheNamePattern.test(cacheName);
      });

      return Promise.all(
        appCacheNames.map(function (cacheName) {
          return caches.delete(cacheName);
        })
      ).then(function () {
        return appCacheNames.length;
      });
    });
  }

  function clearServiceWorkers() {
    return navigator.serviceWorker.getRegistrations().then(function (registrations) {
      var sameOriginRegistrations = registrations.filter(function (registration) {
        return new URL(registration.scope).origin === window.location.origin;
      });

      return Promise.all(
        sameOriginRegistrations.map(function (registration) {
          return registration.unregister();
        })
      ).then(function () {
        return sameOriginRegistrations.length;
      });
    });
  }

  var wasControlled = Boolean(navigator.serviceWorker.controller);

  Promise.all([clearServiceWorkers(), clearAppCaches()])
    .then(function (results) {
      var cleanedSomething = wasControlled || results[0] > 0 || results[1] > 0;

      if (!cleanedSomething) {
        window.sessionStorage.removeItem(reloadKey);
        return;
      }

      if (window.sessionStorage.getItem(reloadKey) === "true") {
        return;
      }

      window.sessionStorage.setItem(reloadKey, "true");
      window.location.reload();
    })
    .catch(function () {});
})();
`;

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Dock Out | Sailing Logbook App",
  description:
    "Dock Out is a sailing logbook app made by pro sailors for pro sailors. Track sessions, camps, venues, media and reports.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      {
        url: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Dock Out",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("h-full antialiased", "font-sans", inter.variable)}
    >
      <body className="min-h-full flex flex-col">
        {process.env.NODE_ENV !== "production" ? (
          <Script
            id="dockout-dev-sw-cleanup"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{ __html: DEVELOPMENT_SW_CLEANUP_SCRIPT }}
          />
        ) : null}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ThemeColorMeta />
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster position="bottom-center" />
        </ThemeProvider>
        <ServiceWorkerRegister />
        <SpeedInsights />
      </body>
    </html>
  );
}
