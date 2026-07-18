# PROGRESS.md

Last updated: 2026-07-17
Repository: `juanchibadino/saillogPWA`
Branch: `main`

## 2026-07-17 - Team Notes route implementation

- Added `AUDIT_TEAM_NOTES.md` for the current `/team-notes` route state against
  `LOADING_PATTERNS.md`, `MOBILE_UI_PATTERNS.md`, and `DESKTOP_UI_PATTERNS.md`.
- Kept Notes as cards on both mobile and desktop while fixing filter trigger
  wiring, mobile filter Drawer behavior, mobile search height/labeling, and
  phase-one mobile header handling for `/team-notes`.
- Split `/team-notes` into chrome/results loading, added a local results retry
  surface, card-list loading overlay, pending `Load more sessions`, card-top
  scroll/focus after load more completes, and active search highlighting across
  visible card text.
- Added `features/notes/list-route-state.mjs` with Node coverage and included
  the new test in `npm test`.
- Data bounding remains the next follow-up: the current UX pass preserves the
  existing card hydration behavior while making the route responsive.
- Follow-up UI polish removed the local desktop `Notes` content title from the
  route shell/skeleton and reduced the mobile Weather value size while keeping
  the desktop emphasis.
- Follow-up search/card UX made note search explicit with a button/Enter submit
  and collapsed Boat Setup by default on mobile cards while preserving the open
  desktop card.
- Initial validation: `node --test features/notes/list-route-state.test.mjs`,
  `./node_modules/.bin/tsc --noEmit`, `npm run lint`, `npm test`,
  `npm run build`, and `git diff --check` passed.
- Follow-up validation: `./node_modules/.bin/tsc --noEmit`, `npm run lint`,
  `git diff --check`, and `npm run build` passed.

## 2026-07-15 - Onboarding sign-in routing and class options

- Updated `/sign-in` so authenticated users without completed app access can
  still view the sign-in form instead of being forced through `/post-auth` to
  `/onboarding`.
- Added `49erFX` to the onboarding class select, server action type, and Zod
  validation so final onboarding submit can create `49erFX` teams.
- Validation: `./node_modules/.bin/tsc --noEmit`, `npm run lint`,
  `git diff --check`, and `npm run build` passed.

## 2026-07-14 - Subscription, Polar billing, quotas, and Dock Out PWA

- Renamed the app-facing Billing surface to Subscription, added the
  `/subscription` route with Billing and Invoice tabs, and kept `/billing` as a
  redirect to the new scoped Subscription URL.
- Added Polar checkout, portal, webhook, live invoice routes, subscription
  skeleton/loading states, and plan data APIs for the Monthly Pro plan.
- Replaced Olympic-facing plan copy with Premium, kept Premium as a contact-us
  manual plan, and added Free/Pro/Premium quota and entitlement rules.
- Added Free quota upgrade dialogs across teams, venues, camps, sessions, camp
  detail, team home, and session asset upload paths; Free organizations cannot
  upload session images/files.
- Updated seed/migration and billing resolution defaults so Test Organization
  stays Free while America One Racing and ENARD Argentina stay Pro.
- Updated the sidebar user dropdown with Subscription entry, plan badges, Assets
  Pro Plan badge, and account-row alignment tweaks.
- Rebranded PWA-visible metadata from Sailog to Dock Out, regenerated PWA icons
  with more blue padding around the sail logo, and bumped the shell cache name
  for refreshed manifest/icon assets.

## 2026-07-04 - Mobile card-list standards consolidation

- Merged the mobile card-list rules into `MOBILE_UI_PATTERNS.md` so mobile
  sizing, Drawers, tabs, card/list behavior, loading states, actions, and
  accessibility live in one canonical mobile standard.
- Updated `DESKTOP_UI_PATTERNS.md`, `LOADING_PATTERNS.md`, and
  `AUDIT_TEAM_CAMP_ID.MD` to reference `MOBILE_UI_PATTERNS.md` as the mobile
  source of truth for card lists.
- Removed the separate mobile card-list document to avoid split mobile UI
  guidance.

## 2026-07-01 - Team Camp ID loading patterns

- Replicated the Team Session ID loading approach on `/team-camps/[id]`: camp
  chrome now loads separately from KPI aggregation and selected-tab payloads.
- Updated the Camp detail page so KPIs and the selected tab stream behind
  `Suspense`, with the camp name/location chrome rendering as soon as the
  lighter camp/venue data is available.
- Rebuilt the Camp detail skeletons in `components/shared/page-skeletons.tsx`
  to mirror final mobile/desktop UI: divided KPI card, desktop KPI grid,
  mobile tabs, Sessions toolbar/cards/FAB, desktop Sessions table/pagination,
  Goals panel, and Notes cards.
- Reused the Camp panel skeleton for deferred client-side tab loads in
  `features/camps/camp-detail-tabs-client.tsx`.

## 2026-07-01 - Team Session ID loading patterns

- Updated `/team-sessions/[id]` so the static title renders before session shell
  data, while header actions, summary KPIs, and selected-tab content stream
  behind `Suspense` with route-shaped skeletons.
- Expanded `components/shared/page-skeletons.tsx` with reusable Team Session ID
  skeleton pieces for header actions, summary cards, tabs, and list/table-style
  deferred panels across mobile and desktop.
- Added `LOADING_PATTERNS.md` as the Sailog source of truth for route skeletons,
  deferred sections, secondary loading, and compact spinner use.
- Renamed `TABLE_DESKTOP_PATTERNS_UI.md` to `DESKTOP_UI_PATTERNS.md` and added
  desktop header/breadcrumb rules, including Team Camp detail
  `[Team Name] > [Venue Name] > [Camp Name]`.
- Updated `MOBILE_UI_PATTERNS.md` with the Team Camp detail mobile header/body
  split and mobile loading skeleton rules.

## 2026-06-29 - Team Camp mobile header copy

- Updated `/team-camps/[id]` mobile header behavior so the title resolves to
  the camp name instead of generic `Team Camps`.
- Added scoped `/api/team-camps/[id]/breadcrumb` lookup for camp name and
  parent team-venue id, reusing the Camp detail shell scope checks.
- Updated the camp detail mobile back action to return to the parent venue on
  the `camps` tab.
- Changed the route header copy to `Team Session` and reduced the supporting line
  to location only.
- Validation: `npm run lint` and `git diff --check` passed after the
  `Team Session` copy correction. Full lint still reports the two unrelated
  existing unused-var warnings in `app/sign-in/sign-in-content.tsx` and
  `features/onboarding/onboarding-flow.tsx`.

## 2026-06-28 - Team Camp mobile tab height

- Updated `/team-camps/[id]` mobile tabs to match the Team Session ID fixed
  `h-11` wrapper plus inner `TabsList h-full` pattern.
- Updated `MOBILE_UI_PATTERNS.md` so taller mobile tabs are the canonical
  simple tabs pattern instead of relying on the shared primitive default height.
- Validation: `npm run lint`, `npm test`, `npm run build`, and `git diff
  --check` passed. Full lint still reports the two unrelated existing
  unused-var warnings in `app/sign-in/sign-in-content.tsx` and
  `features/onboarding/onboarding-flow.tsx`.

## 2026-06-28 - Team Camp route resilience and tests

- Added scoped `/team-camps/[id]` route error boundary with a local retry
  surface.
- Added `features/camps/detail-route-state.mjs` plus `node --test` coverage for
  Camp detail tab/page/notes-offset normalization and Goals save redirect
  preservation.
- Routed the Camp detail page through the shared route-state helper for initial
  tab/page/Notes offset normalization.
- Added `team_camp_timing` logs for `load_shell`, `load_tab`, `load_notes`, and
  `save_camp_goals` phases.
- Updated `AUDIT_TEAM_CAMP_ID.MD` so Step 5 is marked implemented.
- Validation: `npm test`, `npm run lint`, `npm run build`, and `git diff
  --check` passed. Full lint still reports the two unrelated existing
  unused-var warnings in
  `app/sign-in/sign-in-content.tsx` and
  `features/onboarding/onboarding-flow.tsx`.

## 2026-06-28 - Team Camp bounded Notes tab

- Bounded `/team-camps/[id]` Notes loading to one camp-session chunk at a time
  instead of loading every session plus all note/review/setup/move/wind rows
  when the tab opens.
- Added `notesOffset` support to `/api/team-camps/[id]/tab-data` and note
  pagination metadata to the Camp detail tab payload.
- Updated `CampDetailTabsClient` so Notes appends chunks with `Load more notes`,
  visible pending/error states, unique card merging, and stale-response
  protection.
- Kept existing note field labels unchanged.
- Updated `AUDIT_TEAM_CAMP_ID.MD` so Step 4 is marked implemented.
- Validation: `npm run lint`, `git diff --check`, `npm run build`, and
  `npm test` passed. Full lint still reports the two unrelated existing
  unused-var warnings in `app/sign-in/sign-in-content.tsx` and
  `features/onboarding/onboarding-flow.tsx`.

## 2026-06-28 - Team Camp selected-tab data split

- Split `/team-camps/[id]` detail loading into shell data plus selected-tab
  payloads: camp/venue context, KPI summary, Sessions, Goals, and Notes now
  have separate server loaders.
- Added scoped `/api/team-camps/[id]/tab-data` for inactive tabs, reusing the
  shell loader so active org/team/camp checks stay server-side.
- Updated `CampDetailTabsClient` to keep per-tab payload state, lazy-load
  inactive tabs, show retry/loading surfaces, and use per-tab request versions
  so stale responses cannot overwrite newer state.
- Updated `AUDIT_TEAM_CAMP_ID.MD` so Step 2 is marked implemented.
- Validation: `npm run lint`, `git diff --check`, `npm run build`, and
  `npm test` passed. Full lint still reports the two unrelated existing
  unused-var warnings in `app/sign-in/sign-in-content.tsx` and
  `features/onboarding/onboarding-flow.tsx`.

## 2026-06-28 - Team Camp Sessions list UI

- Replaced the `/team-camps/[id]` Sessions tab list with the shared
  `/team-sessions` table/cards UI: desktop table, mobile cards, row action menu,
  desktop New button, mobile FAB, and Highlight filter bar/drawer.
- Added camp-detail return-path support to Team Session create/update/delete
  actions so mutations from the camp screen return to `tab=sessions`.
- Validation: `npm test`, `./node_modules/.bin/tsc --noEmit`, `npm run lint`,
  scoped `git diff --check`, `npm run build`, and an agent-browser smoke check
  passed. Lint still reports the two unrelated existing unused-var warnings in
  `app/sign-in/sign-in-content.tsx` and `features/onboarding/onboarding-flow.tsx`.

## 2026-06-28 - Team Camp mobile tabs pattern

- Updated `/team-camps/[id]` tabs so mobile uses a full-width `h-11` tab row
  with equal-width triggers, while desktop keeps the compact tab list.
- Added the mobile tabs standard to `MOBILE_UI_PATTERNS.md`, including the
  `More` overflow pattern from Team Session ID for routes with too many tabs to
  fit in one mobile row.
- Validation: `./node_modules/.bin/tsc --noEmit`, `npm run lint`,
  `git diff --check`, direct trailing-whitespace scan, and `npm run build`
  passed. Full lint still reports the two unrelated existing unused-var
  warnings in `app/sign-in/sign-in-content.tsx` and
  `features/onboarding/onboarding-flow.tsx`.

## 2026-06-28 - Team Camp summary cards and date range

- Updated `/team-camps/[id]` summary KPIs to imitate Team Session ID gradient
  cards: one `GradientCard` with divided rows on mobile and a desktop grid of
  `GradientCard` KPI cards.
- Updated Camp date range formatting from repeated long ranges like
  `Mar 25, 2026 to Mar 29, 2026` to `Mar 25 - Mar 29 2026` in Camp detail and
  Team Camps list surfaces.
- Updated `AUDIT_TEAM_CAMP_ID.MD` to reflect the current summary-card state and
  validation.
- Validation: `./node_modules/.bin/tsc --noEmit`, `npm run lint`,
  `git diff --check`, direct trailing-whitespace scan, `npm run build`, and a
  local date-format smoke check passed. Full lint still reports the two
  unrelated existing unused-var warnings in `app/sign-in/sign-in-content.tsx`
  and `features/onboarding/onboarding-flow.tsx`.

## 2026-06-28 - Team Camp Goals edit surface

- Extracted the `/team-camps/[id]` Goals edit form from
  `features/camps/camp-detail-tabs-client.tsx` into
  `features/camps/detail/camp-goals-edit-surface.tsx`.
- Replaced the old all-viewport Dialog with a desktop right Sheet and mobile
  bottom Drawer, preserving `updateCampGoalsAction`, scope hidden inputs,
  validation, and redirect behavior.
- Added fixed header/footer layout, one scrollable form body, mobile
  keyboard-safe textarea focus behavior, and `Save` / `Saving...` pending
  feedback with disabled fieldset and submit button.
- Updated `AUDIT_TEAM_CAMP_ID.MD` so Step 1 is marked implemented and Step 2
  remains the next engineering priority.
- Validation: `./node_modules/.bin/tsc --noEmit`, `npm run lint`,
  `git diff --check`, direct trailing-whitespace scan, and `npm run build`
  passed. Full lint still reports the two unrelated existing unused-var
  warnings in `app/sign-in/sign-in-content.tsx` and
  `features/onboarding/onboarding-flow.tsx`.

## 2026-06-28 - Team Camp detail audit

- Added `AUDIT_TEAM_CAMP_ID.MD` for `/team-camps/[id]`, using the
  Team Session ID audit structure as the reference.
- Reviewed `MOBILE_UI_PATTERNS.md` and `DESKTOP_UI_PATTERNS.md` against the
  current Camp detail page,
  data layer, tabs client, loading skeleton, and shared mobile header.
- Captured the current scorecard, UI pattern gaps, remaining risks, and next
  engineering priority sequence for Goals edit, tab-data splitting,
  Sessions table/cards, bounded Notes, and focused tests.
- Validation: `git diff --check` passed, plus direct trailing-whitespace scan
  passed for the new untracked audit file.

## 2026-06-28 - Team Sessions desktop skeleton alignment

- Updated `TeamSessionsPageSkeleton` so the `/team-sessions` loading state
  matches the current desktop list UI: `Sessions` header, filter/action row,
  seven-column table shell, row actions column, and pagination placeholders.
- Hid the mobile card skeleton on desktop so the loading state no longer shows
  both mobile cards and the desktop table at the same time.
- Validation: `npm run lint`, `git diff --check`, and `npm run build` passed.
  Full lint still reports the two unrelated existing unused-var warnings in
  `app/sign-in/sign-in-content.tsx` and
  `features/onboarding/onboarding-flow.tsx`.

## 2026-06-26 - Team Sessions row actions menu and delete

- Replaced direct row/card `Edit` controls on `/team-sessions` with a
  horizontal-more `SessionActionsMenu` matching the Team Camps action pattern.
- Added `Edit` and `Delete` actions for both desktop table rows and mobile
  session cards; desktop edit remains a Dialog and mobile edit remains a
  Drawer.
- Added `deleteSessionAction()` in `features/sessions/list-actions.ts` with
  input validation, active org/team/session ownership checks, redirect
  preservation, route revalidation, and best-effort cleanup for linked Storage
  objects after the session row is deleted.
- Added blurred overlays for session Dialog modals used by table edit and
  delete confirmation, plus pending `Deleting...` feedback on delete submit.
- Updated `AUDIT_TEAM_SESSION.MD` to reflect row/card action menus and delete
  behavior.
- Validation: scoped `eslint`, `./node_modules/.bin/tsc --noEmit`, `npm test`,
  `git diff --check`, and `npm run build` passed. Existing dev server on
  `localhost:3000` returned `200 OK` for `/team-sessions`; `agent-browser` was
  not installed, so visual automation was unavailable.

## 2026-06-26 - Team Sessions action module split

- Split the old broad `features/sessions/actions.ts` surface into
  `features/sessions/list-actions.ts` for `/team-sessions` create/update
  mutations and `features/sessions/detail-actions.ts` for
  `/team-sessions/[id]` mutations.
- Kept `features/sessions/actions.ts` as a compatibility export barrel while
  updating current list and detail consumers to import from the narrower
  modules directly.
- Updated `AUDIT_TEAM_SESSION.MD` and `AUDIT_TEAM_SESSION_ID.MD` so the audits
  no longer list the list/detail action split as pending.
- Validation: `npm test`, scoped `eslint`, `./node_modules/.bin/tsc --noEmit`,
  `git diff --check`, `npm run build`, and full `npm run lint` passed. Full
  lint still reports the two unrelated existing unused-var warnings in
  `app/sign-in/sign-in-content.tsx` and
  `features/onboarding/onboarding-flow.tsx`.

## 2026-06-26 - Team Sessions final audit snapshot

- Rewrote `AUDIT_TEAM_SESSION.MD` as the post-implementation audit for the
  `/team-sessions` list route.
- Added a `Snapshot Register` with `Foto anterior` and `Foto nueva` to record
  the baseline before the implementation sequence and the current state after
  mobile UI, pending states, timing logs, update-scope hardening, and tests.
- Replaced the old implemented-step backlog with a new forward-looking
  engineering priority: collect live timing samples, optimize the data path only
  if logs justify it, add browser/database integration coverage, and split large
  action modules later.
- Kept the audit scoped to `/team-sessions`; `AUDIT_TEAM_SESSION_ID.MD` remains
  the separate detail-route audit.
- Validation: `git diff --check`, `npm test`, `./node_modules/.bin/tsc --noEmit`,
  and `npm run build` passed.

## 2026-06-26 - Team Sessions audit Step 5 tests

- Implemented `AUDIT_TEAM_SESSION.MD` Step 5 for `/team-sessions`.
- Added `features/sessions/list-route-state.mjs` plus `node --test` coverage
  for invalid venue/camp filter normalization, defensive list request parsing,
  pagination, desktop page hrefs, mobile `Load more`, create/update redirect
  params, and forbidden redirects.
- Added `lib/auth/capability-rules.mjs` and routed
  `canManageTeamSessions()` through it so permission tests cover the same rule
  used before create/update actions.
- Fixed create/update form scope preservation for the active Highlight filter
  by carrying `scopeHighlight` through the form and redirect helper.
- Added `npm test` without adding a new dependency.
- Updated `AUDIT_TEAM_SESSION.MD` with the Step 5 current state and validation.
- Validation: `npm test`, scoped `eslint`, and `./node_modules/.bin/tsc --noEmit`
  passed.
- Validation: `git diff --check` and `npm run build` passed.

## 2026-06-26 - Team Sessions audit Step 3 and Step 4

- Implemented `AUDIT_TEAM_SESSION.MD` Step 3 for `/team-sessions` by adding
  `team_sessions_list_timing` server logs for `scope`, `filters`, and
  `sessions` phases.
- The list data logs now include counts/page metadata for filter construction
  and session count/page reads without changing page size, desktop pagination,
  or mobile `Load more` accumulation.
- Implemented Step 4 by requiring `updateSessionAction()` to resolve the
  existing session -> camp -> team venue -> venue chain against the active
  org/team before updating.
- Target camp validation now checks active team and active organization through
  the camp -> team venue -> venue chain.
- Updated `AUDIT_TEAM_SESSION.MD` with the current state and validation notes.
- Validation: `./node_modules/.bin/eslint 'app/(app)/team-sessions/page.tsx'
  features/sessions/data.ts features/sessions/list-timing.ts
  features/sessions/actions.ts`, `./node_modules/.bin/tsc --noEmit`,
  `git diff --check`, and `npm run build` passed.

## 2026-06-26 - Team Session detail header camps navigation

- Updated the mobile header action on `/team-sessions/[id]` so it returns to
  the scoped Team Camps context instead of Team Home.
- When the session breadcrumb is available, the header returns to the session's
  camp detail on the `sessions` tab; otherwise it falls back to scoped
  `/team-camps`.
- Validation: `npx eslint components/site-header.tsx` and `git diff --check`
  passed.

## 2026-06-26 - Team Sessions mobile header home navigation

- Fixed the mobile Team Sessions header action so `/team-sessions` and
  `/team-sessions/[id]` always navigate to scoped Team Home instead of using
  browser history as a back action.
- Updated the mobile header action label for Team Sessions to `Go to Team Home`
  while preserving the existing header layout.
- Validation: `npx eslint 'components/site-header.tsx'`,
  `./node_modules/.bin/tsc --noEmit`, `git diff --check`, and `npm run build`
  passed.

## 2026-06-26 - Team Sessions mobile filter pending

- Updated mobile `/team-sessions` filter navigation so Apply/Clear keeps the
  current cards visible, disables and dims the card list, disables `Load more`,
  and shows one centered spinner over the cards while the filtered route loads.
- Kept the mobile filter controls free of extra per-control spinners; the
  visible pending state belongs to the card-list surface after the Drawer
  closes.
- Updated the mobile card-list rules now carried by `MOBILE_UI_PATTERNS.md`
  with the mobile filter pending pattern and its separation from `Load more`
  button loading.
- Follow-up fixed long accumulated lists by centering the filter spinner in the
  visible mobile shell area between the fixed header and bottom navigation,
  instead of centering against the full rendered card-list height.
- Validation: `npx eslint 'features/sessions/sessions-table.tsx'`,
  `./node_modules/.bin/tsc --noEmit`, `git diff --check`, and `npm run build`
  passed.

## 2026-06-26 - Team Sessions filter pending and clear controls

- Updated `/team-sessions` filters so active desktop filters show a right-side
  `X` clear button for Venue, Camp, and Highlight.
- Routed desktop filter apply/clear through the same table navigation pending
  state used by pagination, so filter changes disable controls, dim the table,
  and show one centered table spinner.
- Kept filter and pagination controls free of extra spinners to avoid duplicate
  loading indicators.
- Updated `DESKTOP_UI_PATTERNS.md` and the mobile card-list rules now carried
  by `MOBILE_UI_PATTERNS.md` with the filter pending and clear-control
  standards.
- Validation: `npx eslint 'features/sessions/sessions-table.tsx'
  'features/sessions/team-sessions-toolbar.tsx'`,
  `./node_modules/.bin/tsc --noEmit`, `git diff --check`, and `npm run build`
  passed.

## 2026-06-26 - Team Sessions table pagination overlay

- Updated desktop `/team-sessions` page transitions so pagination controls no
  longer render competing spinners.
- Added a single centered loading spinner over the desktop table while page
  navigation is pending.
- Disabled and dimmed the desktop table during page navigation while preserving
  the current rows until the next page arrives.
- Updated `DESKTOP_UI_PATTERNS.md` so the desktop table standard now
  requires one table-centered spinner and disabled pagination controls, instead
  of spinner indicators inside pagination buttons.
- Validation: `npx eslint 'features/sessions/sessions-table.tsx'`,
  `./node_modules/.bin/tsc --noEmit`, `git diff --check`, and `npm run build`
  passed.
- Browser validation: existing dev server on `localhost:3000`, authenticated as
  `tester@sailog.test`, desktop viewport `1280x900`; during page 1 -> page 2
  navigation confirmed table `aria-busy="true"`, disabled table wrapper,
  `tableSpinCount: 1`, `navSpinCount: 0`, then final URL
  `/team-sessions?page=2` with active page `2`.

## 2026-06-26 - Team Sessions pagination pending and UI pattern docs

- Added a visible desktop pagination pending state in
  `features/sessions/sessions-table.tsx`: the target page/Previous/Next control
  shows a spinner, the pagination nav exposes `aria-busy`, and duplicate page
  navigations are blocked while pending.
- Added `DESKTOP_UI_PATTERNS.md` to document the Sailog desktop table
  pattern across performance, filters, title, pagination, actions, states,
  cache, and accessibility.
- Added the paired mobile card-list pattern across accumulated loading,
  filters, cards, FABs, actions, states, cache, and accessibility. This
  guidance now lives in `MOBILE_UI_PATTERNS.md`.
- Validation: `npx eslint 'features/sessions/sessions-table.tsx'`,
  `./node_modules/.bin/tsc --noEmit`, `git diff --check`, and `npm run build`
  passed.
- Browser validation: existing dev server on `localhost:3000`, authenticated as
  `tester@sailog.test`, desktop viewport `1280x900`; confirmed
  `/team-sessions` renders without a Next.js overlay, clicking page 2 sets the
  pagination nav to `aria-busy="true"` and changes the target label to
  `Loading page 2`, then finishes at `/team-sessions?page=2` with active page
  `2`.

## 2026-06-26 - Team Sessions desktop pagination

- Updated `/team-sessions` list pagination so desktop shows page numbers,
  active page state, ellipses, and Previous/Next controls instead of only
  `Page {currentPage}`.
- Added filtered session `pageCount` in `features/sessions/data.ts`, including
  valid-page clamping and preserving mobile `loadMore=1` accumulation.
- Passed `pageCount` through `app/(app)/team-sessions/page.tsx` into
  `features/sessions/sessions-table.tsx`.
- Preserved the existing mobile full-width `Load more sessions` behavior.
- Validation: `npx eslint 'app/(app)/team-sessions/page.tsx'
  'features/sessions/data.ts' 'features/sessions/sessions-table.tsx'`,
  `./node_modules/.bin/tsc --noEmit`, `npm run build`, and `git diff --check`
  passed.
- Browser validation: existing dev server on `localhost:3000`, authenticated as
  `tester@sailog.test`, desktop viewport `1280x900`; confirmed
  `/team-sessions` renders without a Next.js overlay, shows desktop page
  buttons `1`, `2`, `3`, and updates `aria-current` to `2` after selecting page
  2.

## 2026-06-25 - Team Sessions submit pending states

- Implemented `AUDIT_TEAM_SESSION.MD` Step 2 for `/team-sessions`.
- Refactored create/edit submit actions in
  `features/sessions/session-form-dialogs.tsx` so the buttons live inside the
  submitted form and use `useFormStatus()`.
- Create and edit session forms now disable fields/actions while pending and
  show spinner labels: `Creating...` and `Saving...`.
- Follow-up fixed headerless mobile Create/Edit Drawer scrolling by making the
  Drawer content a flex column with a constrained scroll region, without
  restoring visible mobile Drawer headers.
- Follow-up added hidden accessible Drawer titles/descriptions to the headerless
  mobile Create/Edit Drawers to satisfy Vaul/Radix screen-reader requirements.
- Follow-up switched `/team-sessions` create/update success and error feedback
  to the shared bottom toast mode already used by `/team-sessions/[id]`.
- Follow-up removed the old inline success/error banner branch from
  `SessionsFeedback`; session feedback now only emits bottom toasts and clears
  the URL params.
- Follow-up made mobile incremental loading explicit with a full-width `h-11`
  `Load more sessions` action below the cards, while preserving the existing
  `loadMore=1` accumulation and `Loading more...` spinner behavior.
- Preserved existing row/card navigation spinners.
- Validation: scoped `eslint` on `app/(app)/team-sessions/page.tsx`,
  `features/sessions/session-form-dialogs.tsx`, and
  `features/sessions/sessions-feedback.tsx`; follow-up scoped `eslint` on
  `features/sessions/sessions-table.tsx`; `./node_modules/.bin/tsc --noEmit`;
  and `git diff --check` passed with no output/errors.

## 2026-06-25 - Team Sessions mobile operational surface

- Implemented `AUDIT_TEAM_SESSION.MD` Step 1 for `/team-sessions`.
- Moved the mobile `New` session CTA out of the toolbar and into the shared
  `mobile-floating-action size-14` FAB pattern while keeping the desktop
  dropdown filters and desktop right Sheet trigger unchanged.
- Updated mobile create/edit session Drawers in
  `features/sessions/session-form-dialogs.tsx` to use fixed header/footer
  layout, scrollable content, full-width `h-11` primary actions, `h-11`
  form controls, `h-11 w-11` stepper/icon controls, date-first edit titles,
  a larger Highlighted-by-coach Switch surface, and `h/m` Net time display
  such as `1h 15m` instead of decimal hours.
- Updated mobile session filters in
  `features/sessions/team-sessions-toolbar.tsx` to keep toolbar scope focused
  on filters, use `h-11` Drawer controls, and place the mobile `Session` title
  left with the filter icon action on the right.
- Updated mobile session card actions in `features/sessions/sessions-table.tsx`
  to use the touch-size icon action standard and render the mobile FAB through
  the list surface.
- Validation: scoped `eslint` on the touched TSX files,
  `./node_modules/.bin/tsc --noEmit`, `git diff --check`, and `npm run build`
  passed with no output/errors.
- Browser validation: production local server on `localhost:3003`, authenticated
  as `tester@sailog.test`, viewport `390x844`, confirmed `/team-sessions`
  renders without overlay, shows the mobile filter button plus `New session`
  FAB, opens Create Session and Edit Session Drawers, opens the Filters Drawer,
  and reports 44px controls/footer actions in those mobile Drawers.

## 2026-06-25 - Team Sessions list audit

- Renamed the previous `/team-sessions/[id]` audit from
  `AUDIT_TEAM_SESSION.MD` to `AUDIT_TEAM_SESSION_ID.MD` so the filename matches
  the Team Session detail scope.
- Added a new `AUDIT_TEAM_SESSION.MD` for the `/team-sessions` list page,
  covering the current desktop table, mobile cards, toolbar filters, pagination,
  `Load more`, and `New` session CTA before starting UI changes.
- Captured the same audit categories used by the Team Session ID audit:
  performance, UI consistency, code tidiness, scalability, best practices,
  modularity, security, current route shape, remaining risks, validation, and
  next engineering priorities.

## 2026-06-25 - Team Session nested dialog click fix

- Removed the Team Session detail summary collapse behavior; the Type / Date /
  Dock Out / Duration card is now static again to avoid short-tab scroll
  feedback loops.
- Fixed nested Team Session edit dialogs so the Gear scanner and Info quick
  create dialogs for Wind Patterns / Std. Moves stay clickable above their
  parent Drawer or Sheet.
- Added pointer-event safety to the shared dialog portal/content wrapper and
  taught the mobile Drawer to treat portaled Dialog/Select/Dropdown content as
  internal interactive content instead of outside clicks.
- Raised only the affected nested scanner/quick-create dialog layers above the
  parent edit surfaces without changing their save/create flows.
- Validation: scoped `eslint` on `components/ui/dialog.tsx`,
  `components/ui/drawer.tsx`, `features/sessions/detail/info-panel.tsx`, and
  `features/sessions/detail/gear-panel.tsx`; `git diff --check` for those
  files; `npm run build`; `agent-browser` smoke on
  `/team-sessions/f70b085c-287c-49dc-b55a-36a11be51066` with Test Team
  confirmed desktop Gear scanner, desktop Std. Moves/Wind Patterns quick-create,
  mobile Gear scanner, and mobile Wind Patterns quick-create open/close paths.
- Follow-up fixed quick-create input focus by opening the nested Info/Gear
  dialogs with explicit controlled buttons and portalizing their content into
  the parent Drawer/Sheet surface; Playwright verification confirmed mobile
  Wind Patterns and Std. Moves `Description` inputs receive `activeElement`,
  accept typed text, and auto-generate `Name`, and the Gear scanner opens and
  closes from the Gear Drawer.
- Follow-up removed backdrop blur from the shared dialog overlay and the Info
  quick-create overlay, and set explicit inline z-index values for the nested
  dialog overlays so the popup remains visually above the backdrop.
- Follow-up removed the Info edit Drawer/Sheet `blur-[2px]` surface filter that
  blurred the nested quick-create popup after it was portalized inside the edit
  surface for focus safety.
- Follow-up changed the mobile Wind Patterns / Std. Moves quick-create flow from
  a stacked Drawer to an in-place Drawer subview with a setup-style back arrow,
  while keeping the desktop Dialog.
- Follow-up aligned the shared Wind Patterns / Std. Moves quick-create modal
  controls with mobile patterns: taller touch targets, mobile text sizing, and
  full-width footer actions on small screens.
- Follow-up aligned `Edit Coaching Notes` with `MOBILE_UI_PATTERNS.md`: mobile
  textareas now use taller note sizing, focus-visible scrolling, a larger
  `Correct` action target, and the Drawer save footer uses the standard
  `h-11 w-full` button with a border.
- Follow-up aligned the Standard Moves and Wind Patterns search fields with
  `MOBILE_UI_PATTERNS.md`: mobile `h-11` search inputs, preserved left search
  icon padding, desktop compact height, and focus-visible scrolling.
- Follow-up removed the visible `Edit Standard Moves` surface title from the
  Standard Moves mobile Drawer while keeping an accessible hidden title.
- Follow-up added vertical breathing room around the shared mobile Drawer handle
  so the top grip no longer crowds the Drawer border or first control.
- Follow-up documented the no-visible-title catalog Drawer pattern and shared
  Drawer handle margin rule in `MOBILE_UI_PATTERNS.md`.
- Follow-up applied the same no-visible-title mobile Drawer treatment to
  `Edit Wind Patterns`; the shared Drawer handle margin already applies there.
- Follow-up generalized the no-visible-title mobile Drawer treatment across
  `InfoEditDialog` main Drawer views in `info-panel.tsx`, while keeping titles
  visible for back-arrow subviews such as quick-create.
- Follow-up applied `MOBILE_UI_PATTERNS.md` to the Goals edit Drawer: hidden
  accessible Drawer title, fixed `85dvh` Drawer body, mobile textarea sizing,
  focus-visible scrolling, and standard `h-11 w-full` save CTA.
- Follow-up expanded the Goals Drawer textarea to fill the available mobile
  Drawer body height, reducing unused vertical space above the fixed Save
  footer.
- Follow-up fixed the Goals Drawer focus loss/runtime error by hoisting form
  helper components out of `GoalsEditDialog`, capturing the focus target before
  delayed scrolling, and removing the oversized mobile bottom padding.
- Follow-up applied the same mobile Drawer fixes to Results: hidden accessible
  Drawer title/description, fixed `85dvh` Drawer body, textarea filling the
  available height, standard `h-11 w-full` save CTA, and hoisted helper
  components to keep textarea focus while typing.
- Follow-up applied the no-visible-title mobile Drawer pattern to Setup edit,
  Boat Metrics, and metric edit views in `setup-dialog.tsx`; titles remain
  accessible and the shared Drawer handle margin applies.
- Follow-up restored Setup Drawer scrolling after the header/title change by
  replacing nested `h-full` scroll bodies with flex-safe scroll containers and
  making Setup/metric edit fieldsets `flex flex-col`.
- Follow-up restored visible Setup subview titles for Boat Metrics and metric
  edit next to the back arrow, and disabled the active button y-translation so
  the arrow no longer jumps downward when tapped.
- Follow-up replaced editable TWS allocation percentage inputs in Setup with
  `-`/`+` stepper buttons, moved the `%` label after the `+` action, and made
  increases round through 5-point steps (`33` -> `35`, `34` -> `40`) while
  keeping the value display read-only.
- Follow-up fixed TWS stepper rebalance after repeated edits: the clicked
  bucket now keeps priority and the required compensation comes from other
  buckets, so `-`/`+` controls do not freeze once edited values already sum to
  `100`.
- Follow-up improved mobile Setup multiselect UX after text input focus: tapping
  a setup selector now blurs the active text field, waits for the keyboard
  viewport to settle, and then opens the selector to avoid the Drawer staying
  shifted upward.
- Follow-up removed search inputs from Setup edit selectors so opening a
  selector does not introduce another keyboard focus path inside the Drawer.

## 2026-06-25 - Team Session asset tab refresh

- Updated `features/sessions/detail/assets-panel.tsx` so image/PDF upload and
  delete no longer call a full `router.refresh()` after success.
- Added a tab-scoped asset refresh callback from
  `features/sessions/session-detail-tabs-client.tsx`, reloading only the
  current `Images` or `Analytics` tab through the existing deferred tab-data
  path so the detail screen does not jump back to `Info`.
- Persisted the active Team Session tab in the URL with the native History API
  and kept same-session server refreshes from forcing `selectedTab` back to the
  server `initialTab`.
- Removed broad session-slice revalidation from asset upload/delete server
  actions; the asset tab refresh now owns the immediate UI update.
- Forced dialog backdrops to render for nested Base UI dialogs and gave the
  asset delete confirm an explicit blurred overlay.
- Validation: `npm run lint` passes with existing warnings in
  `app/sign-in/sign-in-content.tsx` and
  `features/onboarding/onboarding-flow.tsx`; `npm run build`; Playwright
  browser check with `tester@sailog.test` uploaded and deleted
  `codex-tab-retention-test.pdf` in `Analytics`, confirmed the URL and active
  tab stayed on `tab=analytics`, and confirmed delete overlay
  `backdrop-filter: blur(8px)`; `git diff --check`.

## 2026-06-25 - Team Session Setup edit polish

- Updated `features/sessions/detail/setup-dialog.tsx` so the main Setup edit
  flow edits only session setup values, while Boat metric definition edits move
  into a dedicated `Boat metrics` subview opened from the Boat section settings
  icon.
- Removed the in-form Boat metric creation/edit controls from the main Setup
  value editor; the Boat metrics subview lists definitions without saved session
  values and opens the existing metric editor from each pencil action.
- Applied the mobile Setup sizing/focus rules from `MOBILE_UI_PATTERNS.md`:
  `h-11` controls, larger mobile icon buttons, padded scroll regions, and a
  local focus helper to keep active fields visible above the keyboard.
- Follow-up polish removed the visible bottom spacer from Setup scroll bodies,
  narrowed the TWS percentage inputs, centered them on a muted background, gave
  the Boat settings action a muted background, and reduced `Boat metrics` rows
  to metric name/type only.
- Validation: `npm run lint` passes with existing warnings in
  `app/sign-in/sign-in-content.tsx` and `features/onboarding/onboarding-flow.tsx`;
  `npm run build`; `git diff --check`; browser smoke with `tester@sailog.test`
  on `/team-sessions/f70b085c-287c-49dc-b55a-36a11be51066` confirmed mobile
  Drawer edit mode, visible focused input, compact muted TWS percentage fields,
  Boat metrics manager without option/value summaries, metric editor Back flow,
  and desktop Sheet Boat metrics manager.

## 2026-06-25 - Mobile UI standard

- Expanded `MOBILE_UI_PATTERNS.md` into the mobile UI standard for Sailog,
  covering main-action FABs, Save CTAs, mobile input/select/search heights,
  icon-button sizing, keyboard focus visibility, and Drawer/Sheet form
  structure.
- Captured the current Setup/Gear conventions as canonical: mobile FABs use
  `mobile-floating-action size-14`, mobile Save/actions use `h-11 w-full`, and
  mobile icon buttons use `h-11 w-11`.
- Validation: documentation-only; `git diff --check -- MOBILE_UI_PATTERNS.md
  PROGRESS.md`.

## 2026-06-25 - Team Session Gear link selector

- Updated `features/sessions/detail/gear-panel.tsx` so the session Gear link
  surface keeps the `Link gear to session` title, removes the description copy,
  and replaces the category tabs with a single select while preserving search,
  linked count, category filtering, barcode linking, and load-more behavior.
- Made the scanner dialog ignore outside-click dismissal while keeping the
  built-in close X available.
- Matched the Gear drawer footer controls to the Setup edit drawer pattern:
  `Scan` and `Save` now use the same full-width `h-11` treatment on mobile.
- Validation: `npm run lint` passes with existing warnings in
  `app/sign-in/sign-in-content.tsx` and
  `features/onboarding/onboarding-flow.tsx`; `npm run build`;
  `git diff --check -- features/sessions/detail/gear-panel.tsx PROGRESS.md`.

## 2026-06-25 - Bottom nav Team Home gradient

- Reused the shared Team Home card gradient CSS variable on the mobile bottom
  navigation background so the fixed nav matches the card surface treatment
  without duplicating color values.
- Kept the existing active/inactive nav item behavior and desktop sidebar
  unchanged.
- Validation: `npm run lint` passes with existing warnings in
  `app/sign-in/sign-in-content.tsx` and
  `features/onboarding/onboarding-flow.tsx`; `npm run build`;
  `git diff --check`; authenticated browser verification at `375x667`
  confirmed the bottom nav and Team Home cards resolve to the same computed
  `background-image` with no horizontal overflow.

## 2026-06-25 - Team Session mobile loading state

- Updated the `/team-sessions/[id]` mobile header fallback so the detail route
  keeps the back button, date/time label, and menu trigger on mobile instead of
  briefly exposing the desktop theme controls.
- Updated both the route skeleton and deferred tab fallback so the mobile tabs
  render `Info`, `Goals`, `Results`, `Images`, and `More` without horizontal
  scrolling.
- Removed the fallback card `Info` title and spinner, leaving only skeleton
  content while the selected tab data resolves.
- Validation: `npm run lint` passes with existing warnings in
  `app/sign-in/sign-in-content.tsx` and
  `features/onboarding/onboarding-flow.tsx`; `npm run build`;
  `git diff --check`; authenticated browser verification at `375x667`
  confirmed `Mar 29 12:00 PM`, back/menu controls, `More`, and no horizontal
  overflow on `/team-sessions/[id]`.

## 2026-06-25 - Mobile bottom nav client state

- Moved the mobile bottom navigation behind a client-only dynamic wrapper so
  active route styling is resolved after client navigation state is available.
- Simplified active item detection to use the current pathname directly and
  animated the active label width/opacity without changing the desktop sidebar.
- Validation covered with the same `npm run lint`, `npm run build`,
  `git diff --check`, and mobile browser verification pass above.

## 2026-06-24 - Mobile tooltip viewport cap

- Updated the shared Tooltip wrapper to cap popup width to the mobile viewport
  (`100vw - 2rem`), wrap long text, and use collision padding so opened
  tooltips stay inside the screen.
- Updated Team Session Info Standard Move and Wind Pattern tooltips so their
  wider `max-w-sm` treatment applies only from `sm` upward.
- Validation: `./node_modules/.bin/eslint components/ui/tooltip.tsx
  features/sessions/detail/info-panel.tsx`; `./node_modules/.bin/tsc --noEmit`;
  Playwright CSS check at `360x740` confirmed a long tooltip resolves to `328px`
  wide with no viewport overflow.

## 2026-06-24 - Mobile bottom nav active color

- Changed the selected mobile bottom nav item from primary blue to neutral
  foreground colors: white in dark theme and black in light theme.
- Removed the conflicting base `text-muted-foreground` class from active links
  so the active link no longer hydrates with competing text-color classes.
- Validation: `./node_modules/.bin/eslint components/app-mobile-bottom-nav.tsx`;
  `./node_modules/.bin/tsc --noEmit`;
  Playwright computed-style check confirmed `text-foreground` resolves light in
  dark mode and dark in light mode; class-string check confirmed the active
  item has no `text-muted-foreground` or `text-primary`; `git diff --check -- PROGRESS.md`.

## 2026-06-24 - RomaFC safe-area shell alignment

- Copied the RomaFC safe-area approach into Sailog: shared `--safe-area-*`
  variables, `viewport-fit=cover`, `black-translucent` iOS status bar,
  `mobile-safe-header`, `mobile-bottom-nav`, `mobile-shell-content`,
  `mobile-floating-action`, and drawer sizing variables.
- Moved the private app shell to the RomaFC-style fixed viewport with only the
  inner content region scrolling, while leaving public pages outside that fixed
  shell so `/sign-in` and the landing page can keep normal page behavior.
- Updated mobile headers, Drawer/Sheet footers, Setup FABs, and the mobile
  bottom nav to use the shared safe-area classes instead of per-component
  `env(safe-area-inset-*)` calculations.
- Browser verification with mobile viewport `360x740` on
  `/team-sessions/426f673c-ad6f-46ff-a2c1-a468efcb305d` confirmed `safe-area`
  variables are present, the header is `56px`, content scrolls inside the shell,
  the bottom nav is `73px`, Sessions stays active, and the setup FAB sits above
  the nav.
- Browser verification opened the setup Drawer and confirmed the shared drawer
  max height resolved to `629px` with a safe footer padding.
- Browser verification with desktop viewport `1024x768` confirmed the bottom nav
  remains hidden and the private content still scrolls inside the shell; mobile
  `/sign-in` also rendered without an overlay or blank state.
- Validation: `./node_modules/.bin/tsc --noEmit`; `npm run lint` passes with
  existing warnings in `app/sign-in/sign-in-content.tsx` and
  `features/onboarding/onboarding-flow.tsx`; `npm run build`;
  `git diff --check`.

## 2026-06-24 - Mobile bottom navigation

- Added a mobile-only bottom navigation with Home, Venues, Camps, and Sessions
  mapped to the existing team routes and scoped org/team query parameters.
- Matched the requested closed/open behavior: inactive items render as icon-only
  controls, while the active route shows the icon, label, and rounded active
  background.
- Added shared mobile nav safe-area variables and bottom content padding based on
  the existing RomaFC shell pattern, without changing the desktop sidebar layout.
- Browser verification with mobile viewport `360x740` confirmed Home, Venues,
  Camps, and Sessions each show exactly one active pill on their route while
  inactive items stay icon-only; `/team-sessions/[id]` keeps Sessions active and
  the setup FAB clears the new bar.
- Browser verification with desktop viewport `1024x768` confirmed the bottom
  nav remains hidden.
- Validation: `./node_modules/.bin/tsc --noEmit`; `npm run lint` passes with
  existing warnings in `app/sign-in/sign-in-content.tsx` and
  `features/onboarding/onboarding-flow.tsx`; `npm run build`;
  `git diff --check`.

## 2026-06-24 - Theme color follows app mode

- Replaced the static blue mobile browser/PWA theme color with light/dark
  viewport colors so initial load uses white in light mode and near-black in
  dark mode.
- Added a client theme-color sync component under the existing `next-themes`
  provider so manual theme toggles also update `meta[name="theme-color"]`.
- Browser verification on mobile `360x740` confirmed dark mode sets
  `meta[name="theme-color"]` to `#0a0a0a`, toggling to light sets it to
  `#ffffff`, and the browser console had no warnings/errors.
- Validation: `./node_modules/.bin/tsc --noEmit`; `npm run lint` passes with
  existing warnings in `app/sign-in/sign-in-content.tsx` and
  `features/onboarding/onboarding-flow.tsx`; `npm run build`;
  `git diff --check`.

## 2026-06-24 - Mobile session tabs full width

- Updated `/team-sessions/[id]` mobile detail tabs so the tab bar always spans
  the full available width, including when some tabs move into the `More`
  overflow menu.
- Increased the mobile tab bar height from 40px to 44px and kept visible tab
  triggers equal-width inside the available space.
- Browser verification with Samsung J6 viewport `360x740` on session
  `426f673c-ad6f-46ff-a2c1-a468efcb305d` measured the mobile tab bar at
  328px wide by 44px tall, matching its 328px container; visible tabs were
  equal-width and the browser console had no warnings/errors.
- Validation: `./node_modules/.bin/tsc --noEmit`; `npm run lint` passes with
  existing warnings in `app/sign-in/sign-in-content.tsx` and
  `features/onboarding/onboarding-flow.tsx`; `npm run build`;
  `git diff --check`.

## 2026-06-24 - Setup metric edit replaces drawer content

- Updated mobile Setup metric editing so selecting a Boat metric edit action
  replaces the current Setup Drawer content with the metric editor instead of
  opening a nested dialog.
- Centered the mobile Setup Drawer title while keeping the metric-edit back
  button from shifting the title off center.
- Saving the metric now returns to the Setup Drawer without closing the drawer;
  the server action returns the updated metric/options payload to keep local
  option IDs in sync without a redirect.
- Moved metric delete into the same fixed footer row as Save, with Delete taking
  the smaller 1/4 column and Save taking the larger 3/4 column.
- Replaced the mobile Setup text button with a fixed bottom-right setup FAB
  using a lucide settings icon, positioned above the mobile bottom navigation
  safe area while keeping the desktop Setup button unchanged.
- Matched the dynamic Setup loading fallback to the same mobile FAB affordance
  so the old text button does not flash on mobile while the setup chunk loads.
- Browser verification with Samsung J6 viewport `360x740` on session
  `426f673c-ad6f-46ff-a2c1-a468efcb305d` confirmed no visible mobile `Setup`
  text button remains, the setup FAB renders as a 56px circle 76px above the
  bottom edge, tapping it opens the `Session setup` Drawer, and the browser
  console stays clear of warnings/errors for this interaction.
- Browser verification with Samsung J6 viewport `360x740` on session
  `426f673c-ad6f-46ff-a2c1-a468efcb305d` confirmed the `Lowers` metric editor
  replaces the Setup drawer content, Delete measures 76px while Save measures
  244px, saving the unchanged metric returns to the Setup drawer, and no nested
  dialog content remains after save.
- Validation: `./node_modules/.bin/tsc --noEmit`; `npm run lint` passes with
  existing warnings in `app/sign-in/sign-in-content.tsx` and
  `features/onboarding/onboarding-flow.tsx`; `npm run build`;
  `git diff --check`.

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
