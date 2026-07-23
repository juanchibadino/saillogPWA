# Email And Push Notification Patterns

Source of truth for Sailog/Dock Out update notifications that can create
in-app notifications, email notifications, and web push notifications.

Current reference flows:

- Camp Goals confirmation flow:
  - `features/camps/actions.ts`
  - `features/notifications/camp-goal-core.mjs`
  - `features/notifications/email.ts`
  - `features/notifications/push.ts`
- Venue Assessment Run confirmation flow:
  - `app/(app)/team-assessments/page.tsx`
  - `features/assessments/actions.ts`
  - `features/assessments/assessment-run-notification-dialog.tsx`
  - `features/assessments/team-assessments-page-client.tsx`
  - `features/venues/assessment-actions.ts`
  - `features/venues/venue-assessments-panel.tsx`
  - `features/notifications/core.mjs`
  - `features/notifications/email.ts`
  - `features/notifications/push.ts`

## Core Rule

Email and push are delivery channels for an in-app notification event. Do not
send email or push as the only record of the update.

The standard flow is:

1. Save the domain change.
2. Redirect back with a prompt flag only after the save succeeds.
3. Show a confirmation dialog with Email and Push notification toggles.
4. On confirm, re-check auth, scope, permissions, and entity ownership on the
   server.
5. Insert deduped rows into `notifications`.
6. Send email and push only to the recipients that received new notification
   rows.
7. Revalidate the app layout and `/notifications`.

## Confirmation Prompt

Use the Camp Goals confirmation model for update broadcasts:

- Prompt only after a successful save/publish.
- Default Email and Push notification toggles to on.
- Provide a Skip action that only dismisses the prompt.
- Clear prompt query params with `window.history.replaceState()` when the dialog
  closes.
- Keep the server action idempotent by deduping existing notification rows.
- Do not trust the prompt route params. The confirm action must reload and
  validate the entity scope before creating notifications.

## Recipients

Recipient selection belongs in the server action or a focused server helper.

Rules:

- Exclude the actor.
- Send only to active profiles.
- For crew broadcasts, intersect the intended respondent/member set with active
  crew memberships.
- For email, require a usable email and
  `email_notifications_enabled !== false`.
- For push, load `push_subscriptions` by the delivery recipients' profile IDs.
- Delivery recipients must come from newly inserted notification rows, not from
  the original candidate list.

## In-App Notification Rows

Notification row builders belong in `features/notifications/*-core.mjs` or
`features/notifications/core.mjs`.

Each row must include:

- `actor_profile_id`
- `recipient_profile_id`
- `team_id`
- `event_type`
- `message`
- `target_href`
- `metadata`

Deduping should use the event type plus a stable metadata key such as `campId`,
`assessmentRunId`, `gearItemId`, or another event-specific identifier.

When adding a new event type:

- update `NOTIFICATION_EVENT_TYPES` in `features/notifications/core.mjs`;
- update `getNotificationEventTitle()`;
- update `features/notifications/core.d.mts`;
- add or update tests;
- add a Supabase migration if the database enum does not already include the
  event value.

Current event types:

- `camp_goals_added`
- `session_review_added`
- `session_goals_added`
- `assessment_run_created`
- `gear_warning`
- `gear_critical`

## Email Pattern

Use the shared branded shell from
`buildUpdateNotificationEmailPayload()` in `features/notifications/core.mjs`.

Email layout:

1. Dock Out app icon.
2. Clear `h1` heading.
3. One body message.
4. One primary CTA button.
5. Signoff:

```text
See you on the water,
The Dock Out team
```

6. Smaller notification-management line after the signoff:

```text
To stop receiving Dock Out update emails, Manage email notifications.
```

Rules:

- Do not add a second explanatory paragraph such as
  `The goals for ... were shared with the active crew.`
- Escape all dynamic HTML through the shared email payload helper.
- Use absolute URLs for email `targetUrl` and `preferencesUrl` when possible.
- Build preferences with `buildUpdateNotificationSettingsHref({ orgId, teamId })`
  and then convert it to an absolute app URL.
- Text fallback must include the message, CTA URL, signoff, and manage
  notifications URL.
- Send through `features/notifications/email.ts`.
- Use the Dock Out sender wrapper so configured sender addresses render as
  `"Dock Out" <address>`.
- Add unsubscribe headers when `EMAIL_UNSUBSCRIBE_SECRET` and a HTTPS
  `NEXT_PUBLIC_APP_URL` are available.
- If Resend is not configured, warn and return `0`; do not fail the primary
  domain action.

## Push Pattern

Use `sendWebPushNotifications()` from `features/notifications/push.ts`.

Push payload shape:

```ts
{
  title: "Assessment request",
  body: message,
  url: targetHref,
  tag: "assessment-run-<id>",
}
```

Rules:

- Keep the push title short and aligned with `getNotificationEventTitle()`.
- Use the same message as the in-app notification body.
- Use a stable event-specific `tag` so repeated browser notifications collapse
  predictably.
- Use the same `target_href` as the in-app notification row.
- Load subscriptions only for delivery recipients.
- Delete stale endpoints returned by `sendWebPushNotifications()`.
- If VAPID is not configured, `sendWebPushNotifications()` logs and returns
  `sentCount: 0`; do not fail the notification confirmation.

## Testing Checklist

For each new email/push notification flow:

- Unit test the target href.
- Unit test the notification row builder and dedupe behavior.
- Unit test the email HTML for:
  - branded heading and CTA;
  - escaped dynamic text;
  - no extra active-crew explanatory paragraph;
  - signoff before manage-notifications text;
  - smaller manage-notifications styling;
  - correct scoped settings URL.
- Unit test the text fallback.
- Unit test the push payload title, body, URL, and tag.
- Run:

```bash
./node_modules/.bin/tsc --noEmit
npm run lint
npm test
npm run build
git diff --check
```

After `npm run build`, check `next-env.d.ts` and restore generated route-type
drift if the build changed it.

## Do Not

- Do not send email or push before creating in-app notification rows.
- Do not send email or push to recipients skipped by dedupe.
- Do not bypass user email notification preferences.
- Do not add HTML directly in each event-specific email helper when the shared
  update email shell can be reused.
- Do not make notification delivery block the saved domain action. Delivery
  should be best-effort after confirmation.
- Do not introduce a new event type without updating the title mapping, typings,
  tests, and database enum where needed.
