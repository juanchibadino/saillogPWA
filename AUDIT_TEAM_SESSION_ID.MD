# Team Session ID Audit

Date: 2026-06-23

Scope: current `/team-sessions/[id]` implementation after the Team Session ID
performance, loading, editing, transaction-safety, and media changes.

File note: renamed from `AUDIT_TEAM_SESSION.MD` on 2026-06-25 so the generic
audit filename can track the `/team-sessions` list page.

Performance measurement caveat: `@vercel/speed-insights` is now installed and
mounted in `app/layout.tsx`, but live RES/Core Web Vitals still require a
deployed build and real-user traffic. Until that data exists, the performance
score remains a RES-style proxy based on current code paths, build behavior,
local timing hooks, loading fidelity, and interaction risk.

## Scorecard

| Category | Score | Current result |
| --- | ---: | --- |
| Performance, RES-style proxy | 4.7/5 | Initial render now loads shell plus selected tab instead of all tabs. Heavy tab panels are dynamically split, shell data uses one joined fetch, Setup loads only when opened, assets are paged, image thumbnails use direct signed URLs, analytics files defer content signing until open/download, large catalogs are bounded, and Speed Insights is mounted for real-user metrics after deploy. Remaining gap is no collected live RES sample yet. |
| UI consistency | 4.8/5 | Desktop Sheet and mobile Drawer patterns are now consistent across metadata, Setup, Info, Goals, Results, and Gear. Save buttons have visible pending states and labels are normalized to `Save` / `Saving...`. Minor copy risk remains around `Start Time (UTC)`, which may be operationally too technical. |
| Code tidiness | 4.0/5 | The old 6034-line tab client is now a 974-line shell with focused modules under `features/sessions/detail/`. Validation and timing helpers are explicit. Remaining large files are `features/sessions/actions.ts`, `info-panel.tsx`, `setup-dialog.tsx`, and `assets-panel.tsx`. |
| Scalability | 4.7/5 | Tab-specific data loading, 24-item asset pages, asset `Load more`, bounded Info/Gear catalog pages, search, category-specific Gear loading, and transaction-safe setup/gear RPCs remove the largest scaling problems. Remaining scalability work is mostly automated coverage and post-deploy metric review. |
| Best practices | 4.9/5 | App Router server-first access, Zod validation, route skeletons, Suspense fallbacks, route-level `error.tsx`, deferred tab retry states, structured timing logs, Speed Insights, and build/type checks are in place. Missing pieces are automated tests for these flows and post-deploy metric review. |
| Modularity | 4.0/5 | Setup, Info, Goals, Results, Assets, Gear, mobile tabs, and shared responsive edit surfaces are now separated. The shell still owns tab cache/orchestration, and several extracted modules remain large enough to justify later internal cleanup. |
| Security | 4.8/5 | Server actions recheck auth, role, org/team/session scope, and RLS remains the database backstop. Setup and Gear saves use transactional RPCs. Asset uploads validate size, MIME, extension, and WebP/PDF signatures; asset content signing now verifies active org/team scope through the asset -> session -> camp -> team venue chain. Remaining risk is best-effort cleanup between storage upload and DB insert. |

Overall: 4.8/5. The Team Session ID surface is now substantially stronger than
the prior audit baseline. The implementation is product-ready, with remaining
work concentrated in measurement, automated tests, and a few large extracted
modules.

## Relevant Changes Made

- Split the old monolithic client into focused modules:
  - `features/sessions/session-detail-tabs-client.tsx`
  - `features/sessions/detail/setup-dialog.tsx`
  - `features/sessions/detail/info-panel.tsx`
  - `features/sessions/detail/goals-panel.tsx`
  - `features/sessions/detail/results-panel.tsx`
  - `features/sessions/detail/assets-panel.tsx`
  - `features/sessions/detail/gear-panel.tsx`
  - `features/sessions/detail/mobile-tabs.tsx`
  - `features/sessions/detail/responsive-edit-surface.tsx`
- Added dynamic client boundaries for Setup, Info, Goals, Results, Assets, and
  Gear so the tab shell no longer ships every heavy panel at once.
- Changed initial detail loading to shell plus selected tab data. Inactive tabs
  load on demand through `app/api/team-sessions/[id]/tab-data/route.ts`.
- Added client tab payload caching, tab-specific retry states, and asset
  pagination with `Load more`.
- Added route-level recovery with `app/(app)/team-sessions/[id]/error.tsx`.
- Added structured `team_session_timing` logs for shell load, tab load, setup
  load, asset content signing, and key save actions through
  `features/sessions/detail-timing.ts`.
- Collapsed `getSessionDetailShellData()` from sequential
  session -> camp -> team venue -> team/venue reads into one embedded shell
  query, while preserving the same active team/org checks and unavailable
  session behavior.
- Lazy-loaded Setup through `app/api/team-sessions/[id]/setup/route.ts`, so
  manager visits no longer start `getSessionDetailSetupData()` during initial
  page render.
- Installed `@vercel/speed-insights` and mounted `SpeedInsights` once in
  `app/layout.tsx` for production Core Web Vitals collection after deploy.
- Added transaction-safe setup and gear save paths through
  `save_session_setup_atomic` and `replace_session_gear_usage_atomic` in
  `supabase/migrations/028_transaction_safe_session_saves.sql`.
- Hardened asset access in `app/api/session-assets/[id]/content/route.ts` by
  requiring active org/team scope and resolving the full asset ownership chain
  before creating a short-lived signed URL.
- Added photo thumbnail metadata in
  `supabase/migrations/029_session_asset_thumbnails.sql`.
- Updated image upload flow to create a 720px WebP display file plus a 320px
  WebP thumbnail, with server-side WebP signature validation.
- Updated analytics upload validation to require PDF MIME, `.pdf` filename, and
  `%PDF-` signature.
- Updated Images tab payloads to include direct signed image/thumbnail URLs for
  the current page, avoiding one signed-content route redirect per image card.
- Updated Analytics tab so initial render uses metadata only; signed content URL
  generation happens only when the user opens or downloads a file.
- Normalized edit submit copy to `Save` / `Saving...` and fixed Gear barcode
  feedback to `Barcode is not registered`.
- Added `app/api/team-sessions/[id]/catalog/route.ts` for scoped bounded
  catalog pages, search, load-more, category-specific Gear pages, and barcode
  lookup.
- Updated Info so Standard Moves and Wind Patterns load a 30-item catalog page
  plus already-linked rows, with server search and `Load more` in the existing
  Drawer/Sheet editors.
- Updated Gear so the tab loads a 24-item page plus linked rows, the link
  dialog fetches category/search pages on demand, and barcode scans resolve one
  server-scoped row instead of requiring the full team gear list in memory.
- Added `supabase/migrations/030_bound_session_catalog_indexes.sql` with indexes
  for the new catalog paging/filter paths.

## Current Route Shape

Entry points:

- `app/(app)/team-sessions/[id]/page.tsx`
- `app/(app)/team-sessions/[id]/loading.tsx`
- `app/(app)/team-sessions/[id]/error.tsx`
- `app/api/team-sessions/[id]/setup/route.ts`
- `app/api/team-sessions/[id]/tab-data/route.ts`
- `app/api/team-sessions/[id]/catalog/route.ts`
- `app/api/session-assets/[id]/content/route.ts`
- `features/sessions/detail-data.ts`
- `features/sessions/session-detail-tabs-client.tsx`
- `features/sessions/detail/*`
- `features/sessions/actions.ts`
- `lib/validation/sessions.ts`

Loading behavior:

- The route renders authenticated, scoped shell data first.
- The selected tab is loaded server-side for first render.
- Inactive tabs load on demand through a scoped API route and stay cached in the
  client for the current visit.
- Info and Gear catalog editors use scoped bounded catalog pages with search and
  `Load more`; linked rows are fetched separately so already-linked selections
  stay visible even when outside the current page.
- `loading.tsx` uses the shared `SessionDetailPageSkeleton`.
- Deferred tab failures show in-card retry states instead of collapsing the
  whole route.

Security behavior:

- The page requires authenticated access and active organization/team scope.
- Server mutations call `canManageTeamSessions()` and resolve the scoped session
  again before writing.
- Current role rules allow `team_admin`, `coach`, and `crew` to manage Team
  Sessions. The page still has a read-only branch, but that branch is not the
  normal path for active team members under the current role model.
- Asset content and upload paths verify the same active org/team/session scope
  before storage signing or writes.

## Remaining Risks

1. Speed Insights is mounted, but no live RES/Core Web Vitals sample has been
   reviewed yet. This requires a deployed build and real-user traffic.
2. `features/sessions/actions.ts` is still large and mixes multiple session
   mutation families. The extracted panel modules are better, but `info-panel`,
   `setup-dialog`, and `assets-panel` can still be simplified later.
3. Storage upload plus DB insert cannot be a single atomic transaction. The code
   now does best-effort cleanup on failure, but orphaned storage objects are
   still possible under rare partial-failure conditions.
4. There are no automated tests for selected-tab loading, catalog search/load
   more, asset pagination, upload validation, or transaction-safe save flows.

## Validation

- `npm i @vercel/speed-insights`: installed `@vercel/speed-insights@2.0.0`
  and updated `package.json` / `package-lock.json`.
- `npm run lint`: passes with 0 errors and 2 unrelated warnings:
  - `app/sign-in/sign-in-content.tsx`: unused `isRegisterMode`
  - `features/onboarding/onboarding-flow.tsx`: unused `Label`
- `./node_modules/.bin/tsc --noEmit`: passes after the joined shell query and
  lazy Setup changes.
- `npm run build`: passes after the lazy Setup change with Next.js
  16.2.2 and confirms
  `/team-sessions/[id]`, `/api/team-sessions/[id]/setup`,
  `/api/team-sessions/[id]/tab-data`, `/api/team-sessions/[id]/catalog`, and
  `/api/session-assets/[id]/content` are dynamic routes.
- `git diff --check`: passes after the lazy Setup change.

## Next Engineering Priority

Step 1: Add real performance measurement.

- Status: implemented 2026-06-23 with `@vercel/speed-insights` and
  `SpeedInsights` in `app/layout.tsx`.
- Keep the existing `team_session_timing` logs mapped to shell, selected
  tab, setup, asset signing, and save phases.
- Post-deploy validation: confirm `/team-sessions/[id]` reports real Web Vitals
  in Vercel Speed Insights and still logs the current structured timing events.

Step 2: Collapse the shell data waterfall.

- Status: implemented 2026-06-23 with one embedded Supabase shell query in
  `features/sessions/detail-data.ts`.
- Replaced the sequential session -> camp -> team venue -> team/venue reads with
  a single route-shell fetch.
- Preserved active team/org checks and the existing unavailable-session return
  path.
- Added `queryShape: "joined_shell"` to `load_shell` timing metadata so
  post-deploy logs can distinguish the new path.
- Validation: `./node_modules/.bin/tsc --noEmit`, `npm run build`, and
  `git diff --check` pass.

Step 3: Lazy-load Setup only when opened.

- Status: implemented 2026-06-23 with
  `app/api/team-sessions/[id]/setup/route.ts` and lazy client fetch in
  `features/sessions/session-detail-tabs-client.tsx`.
- Stopped starting `getSessionDetailSetupData()` during the initial manager page
  render.
- Fetches the Setup payload when the user opens the Setup Drawer/Sheet.
- Preserves scoped auth, active team/org checks, and `canManageTeamSessions()`
  before returning setup data.
- Setup now shows in-surface loading and retry states before the metric payload
  is available.
- Validation: `npm run lint`, `./node_modules/.bin/tsc --noEmit`,
  `npm run build`, and `git diff --check` pass.

Step 4: Bound large catalogs.

- Status: implemented 2026-06-23 with bounded catalog pages in
  `features/sessions/detail-data.ts` and
  `app/api/team-sessions/[id]/catalog/route.ts`.
- Gear now loads a 24-item page plus linked rows, supports server search,
  category-specific pages, `Load more`, and scoped barcode lookup.
- Info Standard Moves and Wind Patterns now load a 30-item page plus linked
  rows, with server search and `Load more` in the existing edit surfaces.
- Save and quick-create responses no longer reload full Info catalogs.
- Added supporting catalog page indexes in
  `supabase/migrations/030_bound_session_catalog_indexes.sql`.
- Validation: `./node_modules/.bin/tsc --noEmit`, `npm run lint`,
  `npm run build`, and `git diff --check` pass.
- Browser smoke on `localhost:3000` with the Test Team session confirmed the
  detail route renders with no Next.js overlay, Info Standard Moves search uses
  the scoped catalog endpoint while preserving linked rows, Gear lazy-loads its
  tab payload, Gear search/category filters use bounded catalog endpoints, and
  barcode lookup returns one scoped gear row.

Step 5: Add targeted tests.

- Cover selected-tab loading and retry behavior.
- Cover asset pagination plus WebP/PDF upload validation.
- Cover setup and gear transaction-safe save paths.
- Keep the test scope narrow around the current Team Session ID behavior rather
  than broad end-to-end coverage.
