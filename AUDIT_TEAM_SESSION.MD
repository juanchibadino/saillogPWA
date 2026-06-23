# Team Session ID Audit

Date: 2026-06-22

Scope: `/team-sessions/[id]`, all tabs, all edit surfaces, setup, server actions,
validation, loading states, storage access, and supporting route handlers.

Important performance caveat: `@vercel/speed-insights` is not installed and
`app/layout.tsx` does not mount Speed Insights, so there is no live Vercel RES
or real-user Core Web Vitals sample to read. The performance score below is a
RES-style proxy based on code risk for TTFB, FCP/LCP, INP, CLS, loading
fidelity, and observability readiness.

## Scorecard

| Category | Score | Audit result |
| --- | ---: | --- |
| Performance, RES-style proxy | 3/5 | Good streaming shell and skeletons, but too much deferred data and client code load for every visit. No live RES, no Speed Insights, no structured timings. |
| UI consistency | 4/5 | Strong mobile Drawer + desktop Sheet pattern across Setup, metadata edit, Info, Goals, Results, and Gear. Minor label/copy drift remains. |
| Code tidiness | 3/5 | Lint has no errors, but the main client file is 6034 lines and mixes many concerns. Some JSX indentation/readability issues remain. |
| Scalability | 3/5 | Schema indexes/RLS are mostly in place, but all tab data, all gear, all assets, all setup metrics, and all catalog options load as one route payload. |
| Best practices | 4/5 | App Router, server-first access checks, Zod validation, route loading, optimistic Info/Setup saves, and image compression are good. Missing route-specific error boundary and observability. |
| Modularity | 2/5 | The route works, but `session-detail-tabs-client.tsx` owns tabs, setup, notes, assets, image viewer, barcode scanner, and gear linking in one module. |
| Security | 4/5 | Server actions recheck auth, role, org/team/session scope, RLS exists, uploads are size/type restricted. Remaining risks are transactionality and stronger file/content validation. |

Overall: 3.3/5. The implementation is functional and mostly safe, but it is
heavy and concentrated in too few files.

## Route And Loading Architecture

Entry points:

- `app/(app)/team-sessions/[id]/page.tsx`
- `app/(app)/team-sessions/[id]/loading.tsx`
- `features/sessions/detail-data.ts`
- `features/sessions/session-detail-tabs-client.tsx`
- `features/sessions/actions.ts`
- `lib/validation/sessions.ts`
- `app/api/session-assets/[id]/content/route.ts`
- `app/api/team-sessions/[id]/breadcrumb/route.ts`

What is good:

- The page is server-first and gates the route through
  `requireAuthenticatedAccessContext()` plus `resolveNavigationScope()`.
- The visible shell is separated from deferred tab/header data:
  `getSessionDetailShellData()` renders the header summary first, while
  `getSessionDetailDeferredData()` streams into Suspense slots.
- `loading.tsx` delegates to `SessionDetailPageSkeleton`, and the skeleton
  mirrors the real title, summary cards, and six tabs.
- The tab fallback keeps the current selected tab visible and shows a compact
  spinner rather than blanking the page.

Main performance risk:

- The UI visually defers tabs, but `getSessionDetailDeferredData()` loads every
  tab's data before the tab client becomes ready. That includes Info, Goals,
  Results, Images, Analytics, Gear, Setup, Standard Moves, Wind Patterns, and
  setup metric options. This is the biggest RES-style risk.

## Query And RES-Style Performance Audit

Shell query path:

- `sessions` by `id`
- `camps` by `session.camp_id`
- `team_venues` by `camp.team_venue_id` and active team
- `teams` and `venues` in parallel by resolved team/venue/org

Deferred query path:

- Parallel batch for `session_reviews`, `session_setups`,
  `session_regatta_results`, `session_assets`, `gear_items`,
  `session_gear_usage`, `team_setup_items`, `team_standard_moves`,
  `session_standard_moves`, `team_venue_wind_patterns`, and
  `session_wind_patterns`
- Conditional second batch for `team_setup_item_options` and
  `session_setup_item_values`
- Conditional third query for `session_setup_item_selected_options`

RES proxy by metric:

- TTFB: 3/5. The shell has a sequential session -> camp -> team_venue waterfall
  before it can render. The deferred path is parallelized, but still broad.
- FCP/LCP: 4/5. The static `Team Session` title, summary skeletons, and tab
  fallback are good for perceived load.
- INP: 2/5. One client module imports and ships all tab/edit logic, DnD setup,
  image compression/viewer code, barcode scanner code, asset actions, and gear
  linking even when the user only opens Info.
- CLS: 4/5. The route uses stable skeleton dimensions and fixed Drawer/Sheet
  surfaces. Asset thumbnails use fixed aspect ratios.
- Observability: 1/5. No `@vercel/speed-insights`, no Speed Insights component,
  no `instrumentation.ts`, and no structured route/action timing logs.

Recommended performance priority:

1. Split the deferred data by route need. Load shell + selected tab first, then
   lazy load inactive tabs on demand.
2. Move Setup, Assets, Gear, image preview, and barcode scanner into separate
   client modules with dynamic boundaries.
3. Reduce shell waterfalls with a single joined query, RPC, or view for
   session -> camp -> team_venue -> team -> venue.
4. Add basic structured timing logs around shell load, deferred load, asset
   signed URL route, and save actions while Speed Insights remains absent.
5. Add limits or pagination for assets and gear. The current path loads all
   team gear and all session assets.

## UI Consistency Audit

Strong patterns:

- Desktop uses right-side Sheets.
- Mobile uses Drawers.
- Main edit surfaces keep fixed headers/footers with scrollable content.
- Save buttons show pending spinners across metadata, setup, Info, Goals,
  Results, Gear, uploads, and deletes.
- Mobile tabs handle overflow with a `More` menu and keep the selected tab
  reachable.

Inconsistencies:

- Metadata edit submit says `Save changes`; other tab edit surfaces say `Save`.
- Gear submit says `Save links`; Info/Goals/Results say `Save`.
- Some descriptions are intentionally empty but still render description nodes.
- Results has an empty conditional description expression for both session
  types.
- Gear barcode feedback has copy typo: `Barcode is not registerd`.

Score rationale: 4/5. The interaction standard is consistent, but copy and
small presentation details need a pass.

## Surface Audit

### Header: Setup + Edit Session

Good:

- Header actions are permission-gated by `canManageSession`.
- The Setup and Edit buttons have Suspense fallback buttons while deferred data
  loads.
- Metadata edit is Drawer on mobile and Sheet on desktop.
- The server action recalculates `dock_in_at` from date, start time, and
  duration rather than trusting a client timestamp.

Risks:

- The edit form labels start time as `Start Time (UTC)`. That may be correct
  technically, but it is operationally awkward if coaches think in local venue
  time.
- Metadata save is redirect-based, not optimistic.

### Setup

Good:

- Read and edit modes are clear.
- Weather metrics are locked from template controls; Boat metrics can be
  added, edited, deleted, and reordered.
- TWS allocation gets client-side rebalance and server-side validation.
- Setup save has optimistic local update, close-on-save, rollback on error, and
  toast feedback.
- Server mutation validates item scope, active options, single vs multi select,
  fixed metric restrictions, and team ownership.

Risks:

- Setup save touches multiple tables with separate Supabase calls and no single
  database transaction/RPC. Partial failure can leave a mixed state.
- Reordering updates positions in loops, two passes, one row at a time.
- Setup UI, DnD, create/edit/delete metric dialogs, optimistic state, and
  validation helpers live in the main 6034-line client module.

### Info Tab

Good:

- Info is the strongest tab. It has optimistic save with action result payloads,
  rollback on failure, and `router.refresh()` after success.
- Coaching Notes, Standard Moves, and Wind Patterns reuse the same Drawer/Sheet
  edit surface.
- Quick-create exists for Standard Moves and Wind Patterns.
- Standard Move and Wind Pattern selections are validated on the server against
  active team or venue-scoped records.
- Legacy `wind_patterns` JSON is preserved for display while new linked records
  are used.

Risks:

- Three separate Info dialogs carry hidden copies of the fields they are not
  editing. This works, but it is fragile because each section must preserve the
  whole Info payload.
- Quick-create state names are Standard Move oriented even when creating Wind
  Patterns, which hurts readability.
- Search/filter for catalogs is client-only after loading all options.

### Goals Tab

Good:

- Simple edit surface, Drawer/Sheet split, fixed footer, pending spinner.
- Server action rechecks role and scoped session before update.
- Validation caps text at 4000 chars.

Risks:

- Save is redirect-based, not optimistic/result-returning like Info.
- Goals client state initializes from props but does not resync if props change
  without remount while the dialog stays mounted.

### Results Tab

Good:

- Same Drawer/Sheet and pending save pattern as Goals.
- Server action upserts `session_regatta_results` after scope validation.

Risks:

- It renders for training and regatta, but the description conditional is empty
  for both branches.
- Save is redirect-based, not optimistic/result-returning.

### Images Tab

Good:

- Client compresses photos to WebP, max dimension 720px, max 2 MB.
- Upload button has pending state and status labels for compressing/uploading.
- Thumbnails lazy-load and use fixed aspect ratio.
- Delete action has confirmation and visible deleting overlay.
- Server validates asset type, size, MIME type, permissions, scoped session,
  and stores with admin storage only after app-level authorization passes.

Risks:

- Every displayed asset image uses `/api/session-assets/[id]/content`, which
  creates a signed URL and redirects. A grid of many assets means many extra
  route handler invocations and redirects.
- Server validates MIME and file name for PDFs/images, but does not inspect file
  magic bytes.
- No asset pagination or count cap is visible in the detail payload.

### Analytics Tab

Good:

- Upload is restricted to PDF by client accept list and server checks.
- Uses the same asset card/preview/download/delete behavior.

Risks:

- Same signed URL N+1 route behavior as Images.
- PDF preview is basically open/download, not inline analytics extraction.

### Gear Tab

Good:

- Link Gear uses Drawer/Sheet, selected state, category tabs, barcode scanning,
  hidden inputs, pending save button, and server-side gear scope validation.
- Server action verifies every submitted gear item belongs to the active team.

Risks:

- Loads every `gear_items` row for the team on every session detail visit, even
  when Gear tab is never opened.
- Save deletes all usage rows and reinserts selected rows. This is simple but
  not transactional.
- Barcode scanner code ships with the main session detail client bundle.

## Code Tidiness And Modularity

Positive:

- `npm run lint` completed with 0 errors. The only warnings are unrelated
  unused variables in `app/sign-in/sign-in-content.tsx` and
  `features/onboarding/onboarding-flow.tsx`.
- Validation is centralized in `lib/validation/sessions.ts`.
- Navigation helpers are centralized in `features/sessions/navigation.ts`.
- Detail read types are explicit and avoid `any`.

Problems:

- `features/sessions/session-detail-tabs-client.tsx` is 6034 lines.
- `features/sessions/actions.ts` is 3644 lines.
- The client file mixes tab routing, setup templates, DnD, form state,
  optimistic mutations, image compression, image zooming, asset CRUD, gear
  barcode scanning, mobile tab measurement, and all rendered panels.
- There is repeated Drawer/Sheet/footer/button structure that should be a
  shared local abstraction.
- Some helper components are still nested inside large components, making them
  harder to test and easier to remount accidentally.

Recommended module split:

- `features/sessions/detail/session-detail-tabs-client.tsx`
- `features/sessions/detail/session-header-actions.tsx`
- `features/sessions/detail/setup-dialog.tsx`
- `features/sessions/detail/info-panel.tsx`
- `features/sessions/detail/goals-panel.tsx`
- `features/sessions/detail/results-panel.tsx`
- `features/sessions/detail/assets-panel.tsx`
- `features/sessions/detail/gear-panel.tsx`
- `features/sessions/detail/mobile-tabs.tsx`
- `features/sessions/detail/responsive-edit-surface.tsx`
- `features/sessions/detail/actions-info.ts`
- `features/sessions/detail/actions-setup.ts`
- `features/sessions/detail/actions-assets.ts`
- `features/sessions/detail/actions-gear.ts`

## Security Audit

Good:

- Route access requires authenticated context.
- Read shell scopes session through active team and organization.
- Mutations recheck `canManageTeamSessions`.
- Mutations resolve the scoped session before writing related rows.
- RLS is enabled for session detail related tables in migrations.
- Scope triggers exist for setup item values, selected setup options, Standard
  Moves, Wind Patterns, and Gear usage.
- Uploads use server-side type and size checks, not just client accept lists.
- Storage admin is used only after app-level permission checks.

Risks:

- Multi-table mutations are not transactionally atomic.
- Asset content route relies on authenticated Supabase/RLS select, then creates
  a storage signed URL. It does not explicitly receive or verify the active
  org/team scope from the route.
- File validation should inspect content signatures for PDFs/images, not only
  MIME type, extension, and client-generated WebP.
- No route-specific error boundary is present for `/team-sessions/[id]`.

Score rationale: 4/5. Authorization posture is good; consistency under partial
failure and file hardening are the main gaps.

## Highest Priority Fixes

1. Add timing instrumentation without installing Speed Insights:
   `console.log(JSON.stringify({ route, phase, ms, sessionId }))` around shell
   load, deferred load, asset signed URL generation, and each save mutation.
2. Split route data loading by selected tab. Do not block Info UI on assets,
   gear, and setup catalogs.
3. Dynamically split heavy client modules: Setup, Assets/Image viewer,
   Gear/barcode scanner.
4. Move setup save and gear save into transaction-safe RPCs or database
   functions.
5. Extract a shared responsive edit surface for mobile Drawer + desktop Sheet.
6. Add route-level `error.tsx` for the detail route.
7. Add file magic validation for PDF/image uploads.
8. Add pagination or load-more for session assets and gear.

## Improvement Plan

### Step 1: Add Measurement Before Refactors

Goal: improve Performance and Best Practices without installing Speed Insights.

- Add structured timing logs to `getSessionDetailShellData()`,
  `getSessionDetailDeferredData()`, `/api/session-assets/[id]/content`, and the
  main save actions.
- Log route, phase, duration in ms, session id, active team id, and success/error
  state.
- Keep the logs temporary or behind a small helper so they can later map to
  Vercel Speed Insights or drains.
- Expected score movement: Performance `3 -> 3.5`, Best Practices `4 -> 4.5`.

### Step 2: Fix Low-Risk UI And Copy Drift

Goal: raise UI consistency without changing behavior.

- Normalize edit submit labels where possible: prefer `Save` across metadata,
  Info, Goals, Results, and Gear unless a domain-specific label is needed.
- Remove empty description nodes in Info/Results/Images/Analytics.
- Fix the typo `Barcode is not registerd` to `Barcode is not registered`.
- Review `Start Time (UTC)` and decide whether it should stay technical or be
  rendered as venue/local operational time.
- Expected score movement: UI Consistency `4 -> 4.5`, Code Tidiness `3 -> 3.2`.

### Step 3: Split Heavy Client Modules

Goal: improve Modularity, Code Tidiness, INP risk, and future maintainability.

- Extract `SetupDialog` and setup helper logic into
  `features/sessions/detail/setup-dialog.tsx`.
- Extract Info, Goals, Results panels into separate files.
- Extract Assets/Image viewer/upload logic into an assets module.
- Extract Gear/barcode scanner logic into a gear module.
- Extract mobile tab measurement into `mobile-tabs.tsx`.
- Add a shared `ResponsiveEditSurface` for mobile Drawer + desktop Sheet.
- Keep behavior identical while moving code.
- Expected score movement: Modularity `2 -> 3.5`, Code Tidiness `3 -> 4`,
  Performance `3.5 -> 4` if dynamic imports are added where useful.

### Step 4: Split Data Loading By Selected Tab

Goal: improve route performance and scalability.

- Status: implemented 2026-06-23.
- Keep shell data minimal: session, camp, team venue, team, venue, and summary
  metrics.
- Load selected tab data first instead of loading all tab payloads together.
- Move Setup catalog, assets, analytics files, and gear data behind tab-specific
  loaders or route handlers.
- Add load-more or limits for assets and gear.
- Preserve the existing Suspense fallback and skeleton fidelity.
- Implemented with typed tab payload loaders in `features/sessions/detail-data.ts`,
  a scoped tab-data route at `app/api/team-sessions/[id]/tab-data/route.ts`, and
  client-side tab payload caching in
  `features/sessions/session-detail-tabs-client.tsx`.
- Remaining follow-up: add load-more or hard limits for assets and gear.
- Expected score movement: Performance `4 -> 4.5`, Scalability `3 -> 4`,
  Best Practices `4.5 -> 4.7`.

### Step 5: Make Saves Transaction-Safe

Goal: improve Security, Scalability, and correctness under partial failure.

- Status: implemented 2026-06-23.
- Move setup value save, selected-option replacement, and boat metric reorder
  into a database RPC or transactional server-side operation.
- Move gear usage replacement into a transaction-safe operation.
- Keep app-level permission checks before calling the RPC.
- Return structured action results for JS clients and keep redirect fallbacks.
- Implemented with `save_session_setup_atomic` and
  `replace_session_gear_usage_atomic` in
  `supabase/migrations/028_transaction_safe_session_saves.sql`, typed Supabase
  RPC calls in `features/sessions/actions.ts`, and a JS result-returning Gear
  save path in `features/sessions/detail/gear-panel.tsx`.
- Expected score movement: Security `4 -> 4.5`, Scalability `4 -> 4.3`,
  Best Practices `4.7 -> 5`.

### Step 6: Harden Asset Access And Upload Validation

Goal: improve Security and scalability of Images/Analytics.

- Status: implemented 2026-06-23.
- Verified file magic bytes for server-side WebP image uploads and PDF analytics
  uploads before anything is written to storage.
- Added active org/team scope checks to the asset content route and resolved
  asset access through asset -> session -> camp -> team venue -> team/venue.
- Returned asset content redirect URLs with the current org/team scope attached.
- Added bounded 24-item asset pages for Images and Analytics, total counts, and
  a `Load more` control in the session detail UI.
- Expected score movement: Security `4.5 -> 5`, Performance `4.5 -> 4.7`,
  Scalability `4.3 -> 4.5`.

### Step 7: Add Route Error Boundaries And Recovery States

Goal: improve Best Practices and operational resilience.

- Status: implemented 2026-06-23.
- Added `app/(app)/team-sessions/[id]/error.tsx` with a compact runtime
  failure state and route-level retry.
- Added specific deferred tab recovery messages for expired auth, missing team
  scope, unavailable sessions, invalid requests, and runtime tab failures.
- Kept existing active-scope, team-required, read-only, and unavailable-session
  states as normal route states instead of sending them through the runtime
  error boundary.
- Expected score movement: Best Practices `5` maintained, UI Consistency
  `4.5 -> 5`.

### Step 8: Validate With Manual And Build Checks

Goal: prevent regressions after the refactor.

- Status: implemented 2026-06-23.
- Seeded and verified the hosted `USER_TEST` account as an active `coach` on
  `Test Organization` / `Test Team`, matching `.env.local`, and kept the same
  account in `supabase/seed.sql` for deterministic local resets.
- Ran `npm run lint`; it passes with the existing unrelated warnings in
  `app/sign-in/sign-in-content.tsx` and
  `features/onboarding/onboarding-flow.tsx`.
- Ran `npm run build`.
- Ran `git diff --check` and `git diff --cached --check`.
- Manually verified `/team-sessions/[id]` on desktop and mobile with the seeded
  Test Team session:
  - shell skeleton structure and six-tab shell
  - Info edit and save
  - Setup edit and save
  - Goals edit and save
  - Results edit and save
  - image upload/delete
  - analytics PDF upload/delete
  - gear link/save
  - mobile Info Drawer and no horizontal overflow
- Captured timing logs for shell, selected tabs, setup, save actions, asset
  signed URLs, and heavy tabs in `.next/dev/logs/next-development.log`.
- Validation found and fixed one lazy-tab race: Goals now renders the same
  pending/error fallback as the other deferred tabs while its tab payload loads.
- Separate read-only team-role behavior is not applicable in the current role
  model because `team_admin`, `coach`, and `crew` all satisfy
  `canManageTeamSessions()`. The seeded coach path verified the expected
  permission-gated controls.

### Step 9: Optimize Images And Analytics Asset Loading

Goal: remove the per-asset signed URL redirect cost from the initial Images and
Analytics tab experience.

- Status: implemented 2026-06-23; browser timing smoke pending after applying
  migration `029_session_asset_thumbnails.sql`.
- Baseline captured before implementation:
  - Images tab payload time.
  - Analytics tab payload time.
  - number of `/api/session-assets/[id]/content` calls.
  - signed URL redirect duration.
- Keep the measured bottleneck clear: current tab payloads are around 200ms,
  while asset signed URL redirects are around 2300-2500ms each in local dev
  against hosted Supabase.
- Optimized Analytics first:
  - PDF cards now render from metadata plus authenticated click targets.
  - Initial Analytics payload returns `signedUrl: null`; `Open` and `Download`
    use `/api/session-assets/[id]/content` only when clicked.
- Optimized Images second:
  - The scoped Images tab-data loader batches Supabase Storage signing with
    `createSignedUrls()` for the current page after the session/org/team access
    chain has already been verified.
  - Image payloads include direct signed display URLs and optional direct signed
    thumbnail URLs, avoiding one route handler invocation plus one `307`
    redirect per image card.
  - `/api/session-assets/[id]/content` remains the explicit open/download
    fallback and supports `download=1` for fresh download URLs.
- Added real photo thumbnails:
  - Uploads now create the existing compressed 720px WebP display image plus a
    320px WebP thumbnail capped at 256 KB.
  - Added nullable thumbnail metadata fields to `session_assets` in migration
    `029_session_asset_thumbnails.sql`.
  - The grid prefers thumbnails and falls back to the 720px display URL for
    existing images without thumbnail metadata.
  - Backfill is still deferred and not required for current images to render.
- Preserved lazy loading and pagination:
  - URL signing is limited to the current asset page.
  - Existing `Load more` behavior and client tab cache remain unchanged.
  - Grid images still use `loading="lazy"`.
  - Signed URL expiry stays short at 5 minutes.
- Validation:
  - `npm run lint` passes with the existing unrelated warnings in
    `app/sign-in/sign-in-content.tsx` and
    `features/onboarding/onboarding-flow.tsx`.
  - `npx tsc --noEmit`.
  - `npm run build`.
  - `git diff --check`.
  - Browser smoke for Images tab load, Analytics tab load, image upload/delete,
    PDF upload/delete, and open/download behavior remains pending until the new
    migration is applied to the target database.
- Measurement target:
  - Images tab payload remains around 200-350ms for current test data.
  - Analytics initial render makes no asset content route calls.
  - No 2300ms+ signed URL calls occur in the initial tab path.
  - Asset signed URL work happens only for visible image thumbnails or explicit
    open/download actions.

### Target Score After Plan

| Category | Current | Target |
| --- | ---: | ---: |
| Performance, RES-style proxy | 3/5 | 4.5/5 |
| UI consistency | 4/5 | 5/5 |
| Code tidiness | 3/5 | 4/5 |
| Scalability | 3/5 | 4.5/5 |
| Best practices | 4/5 | 5/5 |
| Modularity | 2/5 | 4/5 |
| Security | 4/5 | 5/5 |

## Final Assessment

The current Team Session ID implementation is product-complete and follows the
Sailog mobile/desktop interaction standard well. The biggest issue is not UI or
basic security; it is weight. Too much data and too much client functionality
are loaded for the initial detail route, and the implementation is concentrated
in one very large client module.

Before adding new features to this surface, the best next engineering move is a
performance/modularity pass: split the payload by tab, split the client bundle by
feature, and add minimal timing logs so future RES or Speed Insights numbers can
be connected to exact query/action phases.
