export {};

declare global {
  interface BeforeInstallPromptEvent extends Event {
    platforms: string[];
    userChoice: Promise<{
      outcome: "accepted" | "dismissed";
      platform: string;
    }>;
    prompt: () => Promise<void>;
  }

  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}
