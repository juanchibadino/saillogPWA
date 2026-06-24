# PROGRESS.md

Last updated: 2026-06-24
Repository: `juanchibadino/saillogPWA`
Branch: `main`

## 2026-06-24 - Mobile Setup edit dropdown fix

- Fixed mobile Setup edit mode for `/team-sessions/[id]` by rendering the Setup
  mobile trigger as a controlled button instead of the Drawer trigger wrapper.
- Updated shared dropdown menus to render above Drawer/Sheet overlays with
  pointer events enabled, and made `Multiselect` dropdowns non-modal so nested
  TWD and Boat setup option menus can be tapped inside the mobile Drawer.
- Stabilized the Setup edit form fieldset helpers at module scope so text
  inputs and option selections no longer remount the form, drop focus, or reset
  the Setup scroll position after every draft change.
- Scoped nested setup metric create/edit/delete dialogs to the active
  Drawer/Sheet and constrained their mobile height/options textarea so metric
  inputs, options, and close controls remain tappable inside the Samsung J6
  viewport.
- Browser verification with Samsung J6 viewport `360x740` on session
  `426f673c-ad6f-46ff-a2c1-a468efcb305d` confirmed adding `SE 135º` to TWD,
  typing `mobile playwright day` in Type of Day, and adding `-2` to Primaries
  all update `setupPayload`.
- Follow-up browser verification on the same viewport/session confirmed Type of
  Day accepts `alpha beta gamma` without losing focus, Primaries option
  selection no longer resets the Setup scroller to the top, and the Primaries
  metric edit dialog accepts label/options input and closes by tap.
- Refined the mobile Setup Drawer summary so the initial read-only view only
  renders metrics with recorded values, removed Boat metric drag/reorder
  controls and their `@dnd-kit` dependencies, moved Delete into the edit metric
  flow, and made mobile Drawer action buttons taller.
- Adjusted the edit metric dialog spacing and control heights so the metric
  name, input kind, options, Delete, and Save controls share the same mobile
  rhythm.
- Browser verification with Samsung J6 viewport `360x740` on the same session
  confirmed the read-only Setup summary has no dash placeholders, mobile action
  buttons measure 44px, row delete/reorder buttons are absent, Delete appears
  inside the Primaries edit dialog, and the input-kind select is taller.
- Validation: `npm run lint` passes with existing warnings in
  `app/sign-in/sign-in-content.tsx` and
  `features/onboarding/onboarding-flow.tsx`; `./node_modules/.bin/tsc --noEmit`;
  `npm run build`; `git diff --check`; `git diff --cached --check`.

## 2026-06-23 - Team session asset tab runtime fallback

- Updated `features/sessions/detail-data.ts` so Images and Analytics first use
  thumbnail-aware `session_assets` selects, then fall back to the legacy asset
  columns when a database is missing the optional thumbnail migration columns.
- Kept the tab payload shape stable by normalizing missing thumbnail metadata to
  `null`, so the existing asset panels can render while older databases are
  brought up to date.
- Browser verification on `localhost:3000` with the reported session confirmed
  both `tab-data?tab=images` and `tab-data?tab=analytics` return `200`, and the
  Images and Analytics tabs render their asset lists without the runtime error
  fallback.
- Validation: `./node_modules/.bin/tsc --noEmit`; `npm run lint` passes with
  existing warnings in `app/sign-in/sign-in-content.tsx` and
  `features/onboarding/onboarding-flow.tsx`; `npm run build`;
  `git diff --check`.

## 2026-06-23 - Team session audit Step 4 implementation

- Added `app/api/team-sessions/[id]/catalog/route.ts` for scoped bounded
  catalog loading behind the existing active org/team/session checks.
- Updated `features/sessions/detail-data.ts` and
  `features/sessions/detail-types.ts` so Info and Gear tab payloads include
  explicit catalog page metadata and preserve already-linked rows outside the
  current page.
- Updated `features/sessions/detail/info-panel.tsx` so Standard Moves and Wind
  Patterns search/load a 30-item server page with `Load more` inside the
  existing mobile Drawer / desktop Sheet editors.
- Updated `features/sessions/detail/gear-panel.tsx` so Gear links use a
  24-item server page, category-specific loading, search, `Load more`, and
  scoped barcode lookup instead of requiring the full team gear catalog.
- Updated `features/sessions/actions.ts` so save and quick-create responses no
  longer refetch full Info catalogs after mutations.
- Added `supabase/migrations/030_bound_session_catalog_indexes.sql` for the new
  catalog paging/filter paths.
- Browser verification on the existing local dev server at `localhost:3000`
  confirmed `/team-sessions/[id]` renders without a Next.js overlay, Info
  Standard Moves search calls the scoped catalog endpoint while preserving
  already-linked rows, Gear loads through `tab-data?tab=gear`, Gear search calls
  the bounded catalog endpoint, category tabs call category-specific catalog
  requests, and barcode lookup returns a scoped gear row.
- Fixed a Gear dialog reset found during browser verification: catalog result
  updates no longer clear the active search while the Sheet remains open.
- Validation: `./node_modules/.bin/tsc --noEmit`; `npm run lint` passes with
  existing warnings in `app/sign-in/sign-in-content.tsx` and
  `features/onboarding/onboarding-flow.tsx`; `npm run build`;
  `git diff --check`.

## 2026-06-23 - Team session audit Step 3 implementation

- Removed the initial manager-render `getSessionDetailSetupData()` call from
  `app/(app)/team-sessions/[id]/page.tsx`.
- Added `app/api/team-sessions/[id]/setup/route.ts` to fetch Setup data only
  after the user opens the Setup Drawer/Sheet, with authenticated access,
  active scope, session scope, and `canManageTeamSessions()` checks.
- Updated `features/sessions/session-detail-tabs-client.tsx` to lazy-fetch and
  cache Setup data for the current visit, with retry and scoped error messages.
- Updated `features/sessions/detail/setup-dialog.tsx` to show loading and retry
  states inside the existing mobile Drawer / desktop Sheet before metrics are
  available.
- Updated `AUDIT_TEAM_SESSION.MD` to mark Step 3 as implemented and make bounded
  large catalogs the next Team Session audit priority.
- Validation: `npm run lint`; `./node_modules/.bin/tsc --noEmit`;
  `npm run build`; `git diff --check`.

## 2026-06-23 - Team session audit Step 2 implementation

- Collapsed the `/team-sessions/[id]` shell data path in
  `features/sessions/detail-data.ts` from sequential session, camp, team venue,
  team, and venue reads into one embedded Supabase shell query.
- Preserved the active team and active organization checks before rendering the
  detail shell, so out-of-scope sessions still return the existing unavailable
  state.
- Added `queryShape: "joined_shell"` to the `load_shell` timing metadata for
  comparison against prior timing logs.
- Updated `AUDIT_TEAM_SESSION.MD` to mark Step 2 as implemented and keep Setup
  lazy-loading as the next Team Session audit priority.
- Validation: `./node_modules/.bin/tsc --noEmit`; `npm run build`;
  `git diff --check`.

## 2026-06-23 - Team session audit Step 1 implementation

- Installed `@vercel/speed-insights` and mounted
  `SpeedInsights` from `@vercel/speed-insights/next` once in `app/layout.tsx`.
- Kept the existing `/team-sessions/[id]` `team_session_timing` structured logs
  in place so Vercel Speed Insights can be compared with shell, tab, setup,
  asset signing, and save-action timings after deploy.
- Updated `AUDIT_TEAM_SESSION.MD` to mark Step 1 as implemented and keep
  post-deploy real-user metric review as the remaining measurement task.
- Validation: `npm run lint` passes with existing warnings in
  `app/sign-in/sign-in-content.tsx` and
  `features/onboarding/onboarding-flow.tsx`; `npx tsc --noEmit`;
  `npm run build`.

## 2026-06-23 - Team session audit Step 9 implementation

- Optimized Images and Analytics asset loading across
  `features/sessions/detail-data.ts`, `features/sessions/detail/assets-panel.tsx`,
  `features/sessions/actions.ts`, and
  `app/api/session-assets/[id]/content/route.ts`.
- Images now receive batched direct Supabase signed display URLs for the current
  page, with optional thumbnail signed URLs, avoiding per-card content route
  redirects during initial grid render.
- Analytics now renders cards from metadata only; `Open` and `Download` use the
  authenticated asset content route only when clicked, with `download=1`
  requesting a fresh download URL.
- Added `supabase/migrations/029_session_asset_thumbnails.sql` plus
  `types/database.ts` fields for nullable thumbnail metadata. New photo uploads
  save a 720px WebP display image and a 320px WebP thumbnail, while existing
  images continue to fall back to the display image until a later backfill.
- Validation: `npm run lint` passes with existing warnings in
  `app/sign-in/sign-in-content.tsx` and
  `features/onboarding/onboarding-flow.tsx`; `npx tsc --noEmit`;
  `npm run build`. Browser smoke/measurement is pending until the thumbnail
  metadata migration is applied to the target database.

## 2026-06-23 - Team session audit Step 9 plan

- Added Step 9 to `AUDIT_TEAM_SESSION.MD` for Images/Analytics performance:
  baseline signed URL redirect cost, lazy Analytics open/download URLs, batched
  image URLs, thumbnail generation, pagination/cache preservation, and explicit
  validation/measurement targets.

## 2026-06-23 - Team session audit Step 8

- Seeded and verified the hosted `USER_TEST` account as an active `coach` on
  `Test Organization` / `Test Team` before validation.
- Fixed a lazy-tab race in `features/sessions/session-detail-tabs-client.tsx`:
  Goals now uses the same pending/error fallback as the other deferred tabs
  while its payload loads.
- Completed Step 8 validation: `npm run lint` passes with the existing
  unrelated warnings in `app/sign-in/sign-in-content.tsx` and
  `features/onboarding/onboarding-flow.tsx`; `npm run build`; `git diff --check`;
  `git diff --cached --check`.
- Browser smoke with the seeded Test Team session confirmed desktop shell,
  Setup/Info/Goals/Results save flows, image upload/delete, analytics PDF
  upload/delete, gear link/save, mobile Info Drawer, no mobile horizontal
  overflow, and no framework overlay or browser errors.
- Final hosted cleanup verification confirmed the smoke text/assets were removed
  and the seeded test user remained active on Test Team.

## 2026-06-23 - Team session audit Step 7

- Added the hosted test user `tester@sailog.test` with password `123456` and
  active `coach` membership on `Test Team`, and mirrored that user in
  `supabase/seed.sql` for deterministic local resets.
- Added `app/(app)/team-sessions/[id]/error.tsx` with a compact route-level
  retry state for runtime failures on `/team-sessions/[id]`.
- Updated `features/sessions/session-detail-tabs-client.tsx` so failed deferred
  tab loads show specific recovery messages for expired auth, missing team
  scope, unavailable sessions, invalid tab requests, and runtime tab failures.
- Updated `AUDIT_TEAM_SESSION.MD` Step 7 status.
- Validation: `npm run lint` passes with existing warnings in
  `app/sign-in/sign-in-content.tsx` and
  `features/onboarding/onboarding-flow.tsx`; `npm run build`;
  `git diff --check`; browser check with `tester@sailog.test` on
  `Test Organization` / `Test Team` confirmed desktop route load, coach
  Setup/Edit controls, deferred tab failure recovery + retry, mobile shell, and
  no browser overlay, console errors, page errors, or mobile horizontal
  overflow.

## 2026-06-23 - Team session audit Step 6

- Hardened `/team-sessions/[id]` Images and Analytics asset access by attaching
  the active org/team scope to asset content URLs and rechecking the asset ->
  session -> camp -> team venue -> team/venue chain in
  `app/api/session-assets/[id]/content/route.ts`.
- Added server-side WebP and PDF magic-byte validation in
  `features/sessions/actions.ts` before uploading session assets to Supabase
  Storage.
- Added 24-item paginated asset payloads, asset total counts, and a `Load more`
  control across `features/sessions/detail-data.ts`,
  `features/sessions/session-detail-tabs-client.tsx`, and
  `features/sessions/detail/assets-panel.tsx`.
- Updated `AUDIT_TEAM_SESSION.MD` Step 6 status.
- Validation: `npm run lint` passes with existing warnings in
  `app/sign-in/sign-in-content.tsx` and
  `features/onboarding/onboarding-flow.tsx`; `npx tsc --noEmit`;
  `npm run build`; `git diff --check`.

## 2026-06-23 - Team session audit Step 5

- Added `supabase/migrations/028_transaction_safe_session_saves.sql` with transaction-safe RPCs for session setup saves/reorders and session gear link replacement.
- Updated `features/sessions/actions.ts` so setup save, setup metric reorder, and gear replacement call the RPCs after the existing app-level permission and scope checks.
- Added a result-returning `saveSessionGearUsageAction` while keeping `updateSessionGearUsageAction` as the redirect fallback, and updated `features/sessions/detail/gear-panel.tsx` to use visible saving state plus success/error toasts.
- Updated `AUDIT_TEAM_SESSION.MD` Step 5 status.
- Validation: `npm run lint` passes with existing warnings in
  `app/sign-in/sign-in-content.tsx` and
  `features/onboarding/onboarding-flow.tsx`; `npm run build`;
  `git diff --check`. Local `supabase` CLI is unavailable, so migration
  application was not verified locally.

## 2026-06-23 - Team session audit Step 4

- Split `/team-sessions/[id]` deferred data loading by selected tab so the route no longer blocks the initial tab on assets, analytics files, gear, results, and Info catalogs together.
- Added typed tab payload loaders in `features/sessions/detail-data.ts` plus a scoped `app/api/team-sessions/[id]/tab-data/route.ts` handler for client-side tab switches.
- Updated `features/sessions/session-detail-tabs-client.tsx` to cache tab payloads on demand, keep Goals from the shell payload, and show the existing compact in-card loader/error retry state while inactive tabs fetch.
- Split the header Setup data into its own Suspense promise through `getSessionDetailSetupData()` so setup catalogs no longer gate the tab payload.
- Validation: `npm run lint` passes with existing warnings in `app/sign-in/sign-in-content.tsx` and `features/onboarding/onboarding-flow.tsx`; `npx tsc --noEmit`; `npm run build`; `git diff --check`.

## 2026-06-23 - Team session audit Step 3

- Split `features/sessions/session-detail-tabs-client.tsx` into focused client modules under `features/sessions/detail/`: setup dialog, Info panel, Goals panel, Results panel, assets/image viewer, Gear/barcode scanner, and mobile tab measurement.
- Kept `session-detail-tabs-client.tsx` as the tab/header shell and loaded heavy tab modules through `next/dynamic` so Setup, Info editors, assets/image compression/preview, and Gear scanner code are behind separate client boundaries.
- Added `features/sessions/detail/responsive-edit-surface.tsx` and moved the duplicated Goals/Results Drawer-or-Sheet shell onto that shared surface while preserving their existing fixed footer save controls.
- Preserved the existing server action names, hidden scope fields, optimistic Info save flow, Drawer/Sheet behavior, asset upload/delete behavior, and Gear linking/scanner behavior.
- Validation: `npm run lint` passes with existing warnings in `app/sign-in/sign-in-content.tsx` and `features/onboarding/onboarding-flow.tsx`; `npx tsc --noEmit`; `npm run build`; `git diff --check`.

## 2026-06-23 - Team session audit Step 2

- Normalized `/team-sessions/[id]` edit submit copy in `features/sessions/session-detail-tabs-client.tsx` so metadata and Gear use `Save` / `Saving...` like Info, Goals, and Results.
- Removed empty description rendering from Info edit headers, the Results tab header, and Images/Analytics asset panels; fixed the Gear barcode feedback typo to `Barcode is not registered`.
- Reviewed `Start Time (UTC)` and kept the current UTC label/behavior because the save path still builds `dock_out_at` as a UTC timestamp and there is no venue timezone field to render reliable local operational time yet.
- Validation: `npm run lint` passes with existing warnings in `app/sign-in/sign-in-content.tsx` and `features/onboarding/onboarding-flow.tsx`; `npm run build`; `git diff --check`.

## 2026-06-22 - Team session images and files

- Added private Supabase Storage setup in `supabase/migrations/027_session_assets_storage.sql` for `session-photos` and `session-files`, with path-scoped storage policies aligned to existing team-session read/manage permissions.
- Updated `/team-sessions/[id]` Images and Analytics tabs in `features/sessions/session-detail-tabs-client.tsx` to use Drive-style file cards, preview dialogs, download/open actions, and pending upload feedback.
- Adjusted the mobile Images and Analytics asset cards to a compact two-column grid with smaller thumbnail card spacing and metadata.
- Fixed the Images tab desktop horizontal overflow by removing layout impact from the hidden file input, and constrained the mobile image preview dialog while removing the extra `Open image` action.
- Expanded the mobile image preview dialog to near-full viewport, added in-dialog image zoom controls plus pinch/drag zoom behavior, and added manager-only Delete actions with confirmation and pending spinner state.
- Replaced embedded asset signed URLs with an authenticated `/api/session-assets/[id]/content` redirect route so thumbnails/previews request a fresh storage URL, added image load fallbacks, and softened zoom behavior to avoid browser/UI zoom.
- Added client-side photo compression to WebP with max 720px longest edge before upload, plus server-side WebP/2 MB validation in `features/sessions/actions.ts` and signed asset URLs from `features/sessions/detail-data.ts`.
- Validation: `npm run lint` passes with existing warnings in `app/sign-in/sign-in-content.tsx` and `features/onboarding/onboarding-flow.tsx`; `npm run build`; `git diff --check`; browser check on `Test Organization` / `Test Team` desktop and mobile Images/Analytics tabs. Local `supabase` CLI is unavailable, so migration application was not verified locally.
- Additional validation for the mobile grid adjustment: `npm run lint` passes with the same existing warnings; `npm run build`; `git diff --check`.
- Additional validation for the overflow/dialog adjustment: browser check on `Test Organization` / `Test Team` confirmed desktop Images tab `scrollWidth` equals viewport width and mobile image dialog stays within the viewport with no `Open image` action; `npm run lint` passes with the same existing warnings; `npm run build`; `git diff --check`.
- Additional validation for the zoom/delete adjustment: browser check on `Test Organization` / `Test Team` confirmed the mobile image dialog renders at 378x832 inside a 390x844 viewport, zoom controls change the preview to 150% without page overflow, and the card action menu opens the Delete confirmation without submitting deletion; `npm run lint` passes with the same existing warnings; `npm run build`; `git diff --check`.
- Additional validation for the asset route/zoom fix: browser check on `Test Organization` / `Test Team` confirmed thumbnail and dialog image use `/api/session-assets/[id]/content`, image `naturalWidth` is 720, the dialog remains 378x832 inside a 390x844 viewport, first zoom step changes to 125%, `visualViewport.scale` stays 1, and page `scrollWidth` stays 390; `npm run lint` passes with the same existing warnings; `npm run build`; `git diff --check`.
- Additional validation for the contained image preview fix: browser check on `Test Organization` / `Test Team` confirmed thumbnails and dialog image use `object-fit: contain`, desktop internal wheel zoom changes only the preview transform while `visualViewport.scale` remains 1, and mobile reset state fits the image at 336x260 inside a 378x832 dialog with page `scrollWidth` still 390.
- Tuned image preview interaction so the first zoom step is 135%, pinch/wheel zoom is more responsive, and normal wheel/trackpad movement pans the zoomed image. Validation confirmed preview transform changed from scale-only to translated pan while `visualViewport.scale` stayed 1 and page width stayed fixed.
- Limited Analytics uploads to PDF only by changing the picker accept list to `application/pdf,.pdf`, enforcing `application/pdf` plus `.pdf` server-side, and narrowing the `session-files` storage bucket MIME allowlist to `application/pdf`.
- Added small asset-card loading states: image thumbnails show a spinner until they load or fall back, and confirmed deletes keep the card in a spinner overlay until the refreshed session asset list removes it.

## 2026-06-22 - Team session detail loading shell

- Updated `/team-sessions/[id]` so the page title is a static `Team Session` while `Type`, `Date`, `Dock Out`, and `Duration` stay as fixed summary labels with data-only values.
- Reworked the route skeleton and deferred Suspense fallbacks to mirror the real mobile/desktop layout, keep tab labels visible, and use compact spinners only for secondary deferred content/actions.
- Validation: `npm run lint` passes with existing warnings in `app/sign-in/sign-in-content.tsx` and `features/onboarding/onboarding-flow.tsx`; `npm run build`; `git diff --check`; browser check on `Test Organization` / `Test Team` desktop and mobile.

## 2026-06-22 - Venue-scoped wind patterns catalog

- Added `supabase/migrations/026_wind_patterns_v1.sql` for reusable Wind Patterns scoped to `team_venues`, plus session links, RLS, indexes, updated-at handling, and trigger validation for same-venue active links.
- Added venue-detail Wind Patterns management with active/archived/all filters, create/edit/archive/restore actions, usage counts, and existing session-management permission checks.
- Updated `/team-sessions/[id]` Info so Wind Patterns are selected from the venue-scoped catalog with quick-create, saved as pattern links, and displayed as tooltip badges with legacy `session_reviews.wind_patterns` fallback.
- Updated camp detail and team notes displays to show linked Wind Pattern names before falling back to legacy free text.
- Validation: `npm run lint`, `npm run build`, and `git diff --check`.

## 2026-06-21 - Session header actions restored

- Restored `/team-sessions/[id]` header actions so `Setup` and `Edit` render together on the right side of the session title row.
- Moved the session metadata edit trigger back out of the title area and restored the visible `Edit` label while preserving the mobile Drawer and desktop Sheet edit surfaces.
- Validation: `git diff --check` and `npm run build`.

## 2026-06-20 - Session header edit action placement

- Updated `/team-sessions/[id]` header so `Setup` remains in the right-side action area while the session metadata edit action moves next to the session type title.
- Changed the session metadata edit trigger in `features/sessions/session-detail-tabs-client.tsx` to an icon-only pencil button that still opens the mobile Drawer or desktop Sheet.
- Validation: `git diff --check` and `npm run build`.

## 2026-06-20 - Setup save performance audit fixes

- Optimized `/team-sessions/[id]` Setup saves in `features/sessions/session-detail-tabs-client.tsx` and `features/sessions/actions.ts` so the client submits only changed setup items and only sends boat metric order when it actually changed.
- Updated `saveSessionSetupAction` to bulk delete/upsert/insert changed setup values/options, skip unchanged reorder work, avoid the full post-save setup snapshot query, and revalidate only the session detail path for Setup value saves.
- Removed intermediate `Saving...` toasts from Setup and Info optimistic saves so the user only sees confirmation or error feedback.
- Validation: `git diff --check` and `npm run build`.

## 2026-06-20 - Setup save optimistic UI

- Added an optimistic save path for `/team-sessions/[id]` Setup edits using a new result-returning `saveSessionSetupAction` while keeping `updateSessionSetupAction` as the redirect fallback.
- Updated `features/sessions/session-detail-tabs-client.tsx` so saving Setup immediately exits edit mode, closes the Drawer/Sheet, shows the edited values/order, uses a stable success/error toast id, reconciles through route refresh, and reopens edit mode on failure.
- Validation: `git diff --check` and `npm run build`.

## 2026-06-20 - Session feedback toast dedupe

- Updated session detail save feedback in `features/sessions/sessions-feedback.tsx` so URL-driven Sonner toasts use stable ids per route/status or route/error.
- Prevents duplicate stacked messages when Setup save redirects are processed more than once during refresh/dev rendering.
- Validation: `git diff --check` and `npm run build`.

## 2026-06-20 - Setup edit metric row layout

- Updated `/team-sessions/[id]` Setup edit rows in `features/sessions/session-detail-tabs-client.tsx` so metric titles like TWD render above the multiselect badge field instead of beside it.
- Kept Boat metric template action icons in the row header while the editable input area stays full-width below the title.
- Validation: `git diff --check` and `npm run build`.

## 2026-06-20 - Setup data editor drawer sheet

- Updated `/team-sessions/[id]` Setup editor in `features/sessions/session-detail-tabs-client.tsx` from a shared Dialog to the standard mobile Drawer and desktop right Sheet pattern.
- Kept the long setup content in a dedicated scrollable middle region with fixed header/footer actions so Weather/Boat metrics remain usable on smaller viewports.
- Validation: `git diff --check` and `npm run build`.

## 2026-06-20 - Session duration stepper

- Updated `/team-sessions/[id]` `Edit Session` duration in `features/sessions/session-detail-tabs-client.tsx` from a free numeric input to a required quarter-hour stepper with `-` and `+` controls and `h/m` display.
- Updated `lib/validation/sessions.ts` so session detail edits require `Start Time (UTC)` and a 15-minute increment `Total Duration`.
- Validation: `git diff --check` and `npm run build`.

## 2026-06-20 - Session edit drawer height

- Updated `/team-sessions/[id]` mobile `Edit Session` drawer in `features/sessions/session-detail-tabs-client.tsx` to use content-sized height with an 85dvh max, removing the large empty gap under the short metadata form while keeping overflow constrained.
- Validation: `git diff --check` and `npm run build`.

## 2026-06-19 - Session detail edit drawer sheet

- Updated `/team-sessions/[id]` session metadata edit in `features/sessions/session-detail-tabs-client.tsx` to use the standard mobile Drawer and desktop right Sheet pattern.
- Kept the existing update action and form fields, with fixed header/footer and scrolleable form content inside the edit surface.
- Changed the session metadata edit fields to a single vertical column in the desktop Sheet instead of the previous 50/50 two-column layout.
- Validation: `git diff --check` and `npm run build`.
- Browser verification note: attempted local browser verification, but `agent-browser` was unavailable and the existing Next dev server lock/port did not respond from the sandbox.

## 2026-06-19 - Session detail header date label

- Updated `/team-sessions/[id]` header behavior in `components/site-header.tsx` so desktop breadcrumbs use the session date/time instead of the generic `Session` crumb.
- Updated the mobile `/team-sessions/[id]` header to show the same `MMM D HH:MM AM/PM` date/time label instead of `Team Sessions` and to include the mobile menu/sidebar trigger.
- Added a `12:00 AM` fallback when a session has no `Dock Out` time, so the header still keeps the requested date/time shape.
- Extended `/api/team-sessions/[id]/breadcrumb` to return `session_date` and `dock_out_at` for the shared header.
- Validation: `git diff --check` and `npm run build`.

## 2026-06-19 - Session standard move quick create persistence

- Updated `/team-sessions/[id]` Standard Moves read-only card to render linked Std. Moves as badges with shadcn tooltip details: hover/focus on desktop and tap on mobile.
- Fixed the Std. Move badge tooltip open state so desktop/mobile interaction stays controlled and does not trigger React controlled/uncontrolled warnings.
- Updated `/team-sessions/[id]` Standard Moves Info edit in `features/sessions/session-detail-tabs-client.tsx` so closing Quick Create Std. Move discards typed name/description and no longer leaves a pending `Will create and link` placeholder.
- Added immediate Std. Move creation with a `Create` button, disabled/pending spinner state, and automatic selection of the created move in the current edit draft before the final session `Save`.
- Kept the edit Drawer/Sheet open after quick-create by removing the nested quick-create form submit from inside the main session info form.
- Added `createSessionStandardMoveAction` in `features/sessions/actions.ts` and removed save-time quick-create fields from `updateSessionInfoInputSchema`, so `Save` only persists selected `standardMoveId` links.
- Validation: `git diff --check` and `npm run build`.

## 2026-06-19 - Session standard moves edit layout

- Updated `/team-sessions/[id]` Standard Moves Info edit in `features/sessions/session-detail-tabs-client.tsx` so the Std. Moves selector fills the available vertical content area.
- Replaced the native multi-select helper with a searchable checkbox list and removed the Cmd/Ctrl selection instruction.
- Changed Standard Moves so each move row is its own collapsible accordion item: the list shows checkbox + title, descriptions expand per move, and opening one closes the other.
- Removed the forced dark background from the Standard Moves checkbox list container.
- Moved Quick Create Std. Move out of the scrolleable content and into a fixed panel directly above the save footer for both mobile Drawer and desktop Sheet layouts.
- Validation: `git diff --check` and `npm run build`.

## 2026-06-19 - Optimistic session info saves and bottom toasts

- Updated `/team-sessions/[id]` Info edits in `features/sessions/session-detail-tabs-client.tsx` with optimistic card updates, rollback on failed saves, and server snapshot reconciliation for Standard Moves and Wind Patterns.
- Added a result-returning session info save action in `features/sessions/actions.ts` while keeping the existing redirecting action as the fallback.
- Mounted the shadcn/Sonner toaster at bottom center and switched the session detail page from top inline save feedback to toast-only feedback.
- Validation: `git diff --check` and `npm run build`.

## 2026-06-19 - Session coaching note corrector

- Updated `/team-sessions/[id]` Info edit in `features/sessions/session-detail-tabs-client.tsx` with a local Correct action for `Best` and `To Work`.
- Added native spelling/autocorrect/autocapitalize support plus deterministic cleanup for capitalization, spacing, common typos, contractions, and sailing acronyms.
- Kept the form-status and correction controls as stable components so typing in edit textareas does not remount the input and drop focus.
- Validation: `npm run lint`, `git diff --check`, and `npm run build`.

## 2026-06-10 - Password sign-in pending state

- Updated `/sign-in` password submit action in `app/sign-in/sign-in-content.tsx` so the button label is `Sign In`.
- Added a disabled pending state with a spinner on the password sign-in button while `/auth/password` processes and redirects to the next page.
- Validation: `git diff --check` and `npm run build`.

## 2026-06-09 - Root auth-transition loading state

- Replaced the root `app/loading.tsx` fallback with a centered, theme-aware Sailog spinner for refresh/re-entry and auth transition states.
- Added `RootTransitionLoading` in `components/shared/page-skeletons.tsx` using theme tokens so dark mode is respected.
- Kept route-specific skeletons unchanged for `/sign-in`, `/onboarding`, and authenticated app pages.
- Validation: `git diff --check` and `npm run build`.

## 2026-06-09 - Rollback sidebar/dropdown regression

- Reverted commit `b52f4b0b288d0c1799e9d15acd057f6717aee1d6` after it broke the desktop sidebar Team/Org switcher and user dropdown.
- Restored the previous sidebar/dropdown behavior by undoing the mobile session UI and feedback-flow commit as a new revert commit.
- Validation: `npm run build` and `git diff --check` run before publish.

## Current Snapshot

Sailog has completed bootstrap + Milestone 1 auth foundation:

- Next.js App Router + TypeScript + Tailwind + ESLint configured
- Supabase project linked (`gumxfgsvqnhrwgzwnuem`)
- Initial schema migration in repo and applied
- Vercel connected to GitHub and production deploy fixed
- Environment variables managed in Vercel (not in GitHub)
- Local development running with `.env.local`
- Phase 6 kickoff started with first vertical slice: `venues` CRUD
- Magic-link redirect origin fix deployed for production auth emails

## Infrastructure Status

### Supabase
- Link active to project `Sailog` (`gumxfgsvqnhrwgzwnuem`)
- Migrations applied remotely with `npx supabase db push`:
  - `001_initial_schema.sql`
  - `002_auth_access_policies.sql`
  - `003_venues_access_policies.sql`

### Vercel
- Active project: `sailog` (renamed from `saillog`)
- Framework preset corrected to `Next.js`
- Domain `https://sailog.vercel.app` was verified serving app (HTTP 200)
- Required env vars should exist in Preview + Production:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SECRET_KEY` (server-only, optional if needed)
- Added `NEXT_PUBLIC_APP_URL` in Production as `https://sailog.vercel.app`

### GitHub
- Remote: `git@github.com:juanchibadino/saillogPWA.git`
- Branch tracking: `main...origin/main`

## Milestone 1 Implemented (Local Code)

### Auth and protected shell
- Added sign-in flow (Email OTP magic link):
  - `/sign-in`
  - `/auth/otp`
  - `/auth/callback`
  - `/sign-out`
- Added protected app shell and dashboard:
  - `/dashboard`
- Added deny-by-default "Access pending" state for users without memberships

### Access context
- Added central server-side auth/access contract in:
  - `lib/auth/access.ts`
- Returns:
  - user
  - profile
  - organization memberships
  - team memberships
  - effective roles

### Database / RLS hardening
- Added migration `002_auth_access_policies.sql` with:
  - `auth_profile_id()`
  - `is_super_admin()`
  - `is_org_member(...)`
  - `is_team_member(...)`
  - trigger function `handle_new_auth_user()` to auto-create/update `public.profiles`
  - baseline RLS policies for:
    - `profiles`
    - `organization_memberships`
    - `team_memberships`
    - `organizations`
    - `teams`

### Typing
- Expanded `types/database.ts` for key auth/access tables and enums used in Milestone 1

## Phase 6 Kickoff Implemented (Local Code)

### Venues vertical slice
- Added `app/(app)/venues/page.tsx` with:
  - venues list
  - create venue form
  - edit venue form
- Added server-side data module:
  - `features/venues/data.ts`
- Added server actions for create/update:
  - `features/venues/actions.ts`
- Added Zod validation for writes:
  - `lib/validation/venues.ts`
- Added baseline RLS policies for venues:
  - `supabase/migrations/003_venues_access_policies.sql`

## Validation Completed

- `npm run lint` passes
- `npm run build` passes
- Build output includes routes:
  - `/`
  - `/sign-in`
  - `/auth/otp`
  - `/auth/callback`
  - `/dashboard`
  - `/sign-out`
  - `/venues`

## Magic Link Redirect Fix Completed

- Root cause addressed: email links were sometimes generated with localhost origin.
- OTP route now resolves callback origin in this order:
  1. `NEXT_PUBLIC_APP_URL`
  2. request `Origin` header
  3. forwarded host/proto headers
  4. request URL origin fallback
- Updated files:
  - `app/auth/otp/route.ts`
  - `lib/supabase/env.ts`
  - `.env.example`
  - `README.md`
- Production redeploy executed after setting `NEXT_PUBLIC_APP_URL`.

## Git Status

- Milestone + Phase 6 kickoff commit pushed:
  - `82f81ba feat: milestone 1 auth, protected shell, baseline RLS, and venues CRUD kickoff`
- Follow-up docs sync commit pushed:
  - `1a9559c docs: refresh progress status after milestone push`
- Magic-link redirect fix commit pushed:
  - `fca6296 fix: stabilize magic-link redirect origin`
- Branch is synced:
  - `main...origin/main`

## Immediate Next Step

1. Continue Phase 6 with `team_venue_seasons` CRUD slice.

Suggested commit message:

`feat: add team_venue_seasons CRUD vertical slice`

Then verify in production:

1. OTP login email delivery
2. Magic-link callback returns to `https://sailog.vercel.app` (not localhost)
3. Access pending for user without memberships
4. Dashboard access for user with team/org membership

## Access Grant Runbook (SQL Editor)

Root cause for error `P0001: No auth user found for that email yet`:

- grant SQL ran before the user existed in `auth.users`
- the user must request sign-in first at `/sign-in`

Recommended sequence:

1. User requests magic link at `/sign-in`.
2. Verify user/profile rows exist:
   - `select id, email from auth.users where lower(email) = lower('<email>');`
   - `select id, email from public.profiles where lower(email) = lower('<email>');`
3. Grant memberships with `insert ... select` from `auth.users`:
   - insert into `organization_memberships` with role `organization_admin`
   - insert into `team_memberships` with role (`team_admin`/`coach`/`crew`) and `is_active = true`
4. Validate app behavior:
   - no membership => `Access pending`
   - active membership => `/dashboard` access

## Notes

- `.env.local` must remain untracked
- Keep `.env.example` as contract template only
- Existing core operational CRUD (teams/venues/camps/sessions) is next after this commit
