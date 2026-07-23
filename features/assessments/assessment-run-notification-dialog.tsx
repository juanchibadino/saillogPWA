"use client";

import * as React from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { confirmVenueAssessmentRunNotificationAction } from "@/features/venues/assessment-actions";
import type { NavigationScope } from "@/lib/navigation/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

function clearAssessmentRunNotificationPromptParam(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("notifyAssessmentRun");
  url.searchParams.delete("notifyAssessmentRunId");
  url.searchParams.delete("notifyAssessmentTeamVenueId");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

export function AssessmentRunNotificationDialog(input: {
  defaultOpen: boolean;
  runId: string | null;
  scope: NavigationScope;
  selectedYear?: number;
  teamVenueId: string | null;
}) {
  const canOpen = input.defaultOpen && Boolean(input.runId) && Boolean(input.teamVenueId);
  const [isOpen, setIsOpen] = React.useState(canOpen);
  const [notifyEmail, setNotifyEmail] = React.useState(true);
  const [notifyPush, setNotifyPush] = React.useState(true);
  const [isPending, setIsPending] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState("");
  const openedPromptRunIdRef = React.useRef<string | null>(
    canOpen ? input.runId : null,
  );

  React.useEffect(() => {
    if (
      !input.defaultOpen ||
      !input.runId ||
      !input.teamVenueId ||
      openedPromptRunIdRef.current === input.runId
    ) {
      return;
    }

    openedPromptRunIdRef.current = input.runId;
    setNotifyEmail(true);
    setNotifyPush(true);
    setErrorMessage("");
    setIsOpen(true);
  }, [input.defaultOpen, input.runId, input.teamVenueId]);

  function closeDialog(): void {
    openedPromptRunIdRef.current = null;
    setIsOpen(false);
    clearAssessmentRunNotificationPromptParam();
  }

  async function confirmNotifications(): Promise<void> {
    if (isPending || !input.runId || !input.teamVenueId) {
      return;
    }

    setIsPending(true);
    setErrorMessage("");

    const formData = new FormData();
    formData.set("runId", input.runId);
    formData.set("scopeOrgId", input.scope.activeOrgId);
    formData.set("scopeVenueId", input.teamVenueId);

    if (typeof input.selectedYear === "number" && Number.isFinite(input.selectedYear)) {
      formData.set("scopeYear", String(input.selectedYear));
    }

    if (input.scope.activeTeamId) {
      formData.set("scopeTeamId", input.scope.activeTeamId);
    }

    if (notifyEmail) {
      formData.set("notifyEmail", "on");
    }

    if (notifyPush) {
      formData.set("notifyPush", "on");
    }

    try {
      const result = await confirmVenueAssessmentRunNotificationAction(formData);

      if (!result.ok) {
        setErrorMessage("Could not notify the crew. Confirm permissions and try again.");
        return;
      }

      toast.success("Crew notified.", {
        description: `${result.notifiedCount} crew notification${
          result.notifiedCount === 1 ? "" : "s"
        } queued.`,
      });
      closeDialog();
    } catch {
      setErrorMessage("Could not notify the crew. Confirm permissions and try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setIsOpen(true);
          return;
        }

        closeDialog();
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        forceOverlayRender
        overlayClassName="bg-black/20 backdrop-blur-sm supports-backdrop-filter:backdrop-blur-sm"
      >
        <DialogHeader>
          <DialogTitle>Notify crew?</DialogTitle>
          <DialogDescription>
            Assessment was created. Send the request to the active crew.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <Label className="flex min-h-12 items-center justify-between gap-4 rounded-lg border bg-muted/30 px-3 py-2">
            <span className="min-w-0 text-sm font-medium">Email</span>
            <Checkbox
              checked={notifyEmail}
              onCheckedChange={(checked) => {
                setNotifyEmail(checked === true);
              }}
            />
          </Label>
          <Label className="flex min-h-12 items-center justify-between gap-4 rounded-lg border bg-muted/30 px-3 py-2">
            <span className="min-w-0 text-sm font-medium">Push notification</span>
            <Checkbox
              checked={notifyPush}
              onCheckedChange={(checked) => {
                setNotifyPush(checked === true);
              }}
            />
          </Label>
          {errorMessage ? (
            <p className="text-sm text-destructive">{errorMessage}</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={isPending} onClick={closeDialog}>
            Skip
          </Button>
          <Button
            type="button"
            disabled={isPending || !input.runId || !input.teamVenueId}
            onClick={() => {
              void confirmNotifications();
            }}
          >
            {isPending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Confirm"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
