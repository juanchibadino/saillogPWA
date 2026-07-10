# Core User Pages Feels Fast Plan

Implementation plan for bringing the RomaFC `Cache-first near-window tab loading`
pattern into Sailog core user pages without weakening server-first auth,
permission checks, or scoped data correctness.

Target pages:

- Venues: `/team-venues`
- Venue ID: `/venues/[id]`
- Camps: `/team-camps`
- Camp ID: `/team-camps/[id]`
- Sessions: `/team-sessions`
- Session ID: `/team-sessions/[id]`

## Goal

Make repeated navigation feel instant by rendering useful cached content before
fresh network reads finish, while keeping the current Sailog guarantees:

- auth, scope, and permissions stay server-first;
- cache keys include organization, team, role-relevant scope, route entity, tab,
  year, filters, and page;
- stale data is visibly replaced or revalidated, not trusted forever;
- mutations invalidate only the affected route slices;
- skeletons remain available for cold loads and direct route entry.

## Pattern To Import

From `LOADING_PATTERNS_OTHER PROJECT.md`:

- keep route guard and access checks minimal;
- mount stable UI chrome immediately;
- fetch the most useful operational window, not all history;
- reuse warm cache as initial UI when available;
- revalidate in the background;
- keep rows/cards visible during revalidation;
- defer secondary tabs and form option catalogs until needed;
- prefetch likely detail pages from the first visible rows.

In Sailog terms this becomes:

```text
server auth/scope/perms
  -> stable route shell
  -> cached current-window rows/tab payload if available
  -> fresh scoped API revalidation
  -> narrow invalidation after mutations
```

## Implementation Principles

1. Do one pilot first: `/team-sessions`.
2. Do not introduce a global cache until one route proves the shape.
3. Prefer a small Sailog cache helper before adding a new data-fetching library.
4. Keep App Router `loading.tsx` and nested `Suspense` fallbacks as the cold-load
   path.
5. Do not cache authorization decisions in the client.
6. Do not cache across org/team/scope changes.
7. Use short stale windows for operational rows and longer retention for warm
   navigation.
8. Log timings before and after each route change.

## Shared Foundation

### Step 1: Add A Scoped Client Cache Helper

Create a small shared helper for client-side cached route payloads.

Candidate file:

- `features/shared/scoped-route-cache.ts`

Responsibilities:

- build stable cache keys from explicit parts;
- store payload, `cachedAt`, `staleAt`, and schema version;
- read only if scope key matches exactly;
- return stale payloads for immediate paint;
- expire unusable payloads after a longer max age;
- clear entries by prefix after mutations.

Key shape:

```text
sailog:v1:{orgId}:{teamId}:{route}:{entityId?}:{tab?}:{year?}:{filters}:{page}
```

Initial timing policy:

- stale after 2 minutes for list rows;
- stale after 5 minutes for stable detail tabs;
- retain for 24 hours unless scope changes or mutation invalidates.

### Step 2: Add A Revalidation Hook

Create a hook that reads cache first, renders cached data, then fetches fresh
data from a scoped API endpoint.

Candidate file:

- `features/shared/use-stale-route-data.ts`

Required states:

- `idle`: no cached data and no fetch yet;
- `cached`: rendering cached data while fetch is pending;
- `fresh`: rendering fresh server response;
- `revalidating`: rendering previous data while refreshing;
- `error`: show in-panel retry without collapsing the whole route.

Required behavior:

- never blank current rows/cards during revalidation;
- expose `isRevalidating` for dimmed overlay or small spinner;
- ignore late responses when scope/entity changes;
- persist fresh payload only after validating route/entity metadata.

### Step 3: Add API Slice Contracts

For each route, add or reuse scoped API endpoints that return only the payload
needed by the visible surface.

Contract rules:

- every endpoint verifies auth, organization, team, and route entity ownership;
- every endpoint accepts current route filters explicitly;
- every endpoint returns the resolved cache key metadata;
- every endpoint returns a small payload, not a full page model;
- endpoint errors map to retryable in-panel states.

### Step 4: Add Mutation Invalidation

After create/update/delete/upload actions, clear only affected prefixes.

Examples:

```text
/team-sessions create
  -> invalidate sessions list for active team
  -> invalidate parent camp detail sessions tab
  -> invalidate venue detail sessions/year tab

/team-camps update
  -> invalidate camps list
  -> invalidate affected camp detail
  -> invalidate parent venue camps/year tab

/venues update
  -> invalidate team venues list
  -> invalidate venue detail chrome and tabs
```

Server `revalidatePath()` remains required. Client cache invalidation is an
additional UX layer for already-open tabs and fast back/forward navigation.

### Step 5: Add Measurement

Add route-specific timing logs for:

- `scope_resolved`;
- `chrome_visible`;
- `cache_hit`;
- `cache_miss`;
- `fresh_payload_loaded`;
- `rows_visible`;
- `tab_visible`;
- `revalidation_error`;
- `mutation_invalidated`.

Use the existing list timing style from Team Sessions/Camps/Venues.

## Route Implementation Steps

## 1) Sessions: `/team-sessions`

Why first:

- most operational list;
- already has `TeamSessionsRouteShell`;
- already splits `getTeamSessionsChromeData()` and
  `getTeamSessionsResultsData()`;
- already prefetches detail rows and keeps rows mounted during transitions.

Steps:

1. Add a scoped API endpoint for the results payload.
   - Candidate: `app/api/team-sessions/list/route.ts`
   - Inputs: org scope, team scope, venue, camp, highlight, page, loadMore.
   - Output: same shape as `TeamSessionsResultsData`.
2. Keep `page.tsx` server-first for auth, scope, permissions, and initial
   chrome.
3. Move the results area to a cache-aware client boundary.
   - Seed it with the server `initialResultsData` when available.
   - Read `sessions:list` cache before fetching.
   - Revalidate via the new API endpoint.
4. Add a current-window default.
   - Default page remains bounded at `TEAM_SESSIONS_PAGE_SIZE`.
   - Keep most recent sessions first.
   - Add an optional future `window=current-season` only after validating
     expected date semantics with real data.
5. Preserve existing behavior:
   - desktop table;
   - mobile cards;
   - `Load more sessions`;
   - detail prefetch on hover/focus;
   - local row spinner when opening Session ID.
6. Invalidate cache prefixes from session create/update/delete/detail actions.

Acceptance:

- cold direct load still shows `TeamSessionsPageSkeleton`;
- warm back navigation shows rows immediately;
- filter changes keep previous rows dimmed while fresh rows load;
- scope change never shows rows from a previous team;
- mutation updates list after redirect without stale rows sticking around.

## 2) Camps: `/team-camps`

Current state:

- already follows the Sessions list shell/results structure;
- uses `TeamCampsRouteShell`;
- has bounded results and `Load more camps`.

Steps:

1. Add `app/api/team-camps/list/route.ts` for results-only payloads.
2. Cache by org/team/venue/type/status/page/loadMore.
3. Seed client results from server data, then revalidate.
4. Keep active/current camps as the first operational slice.
5. Defer expensive session count refresh if it blocks rows.
   - Render camp rows first if count data can be separated.
   - Fill counts after the row list is stable.
6. Invalidate from camp create/update/delete and session mutations that affect
   camp counts.

Acceptance:

- warm `/team-camps` renders the previous camp rows immediately;
- counts may show stale for a short period but refresh visibly;
- active/status filters do not reuse the wrong cached list;
- mobile `Load more camps` preserves existing cards.

## 3) Venues: `/team-venues`

Current state:

- has a shell/results split;
- still loads broad linked venue and organization venue data before the shell
  can settle;
- delete-rule and camp-count data can make the results heavier.

Steps:

1. Keep linked venue options as chrome data.
2. Split row metrics into a results API:
   - current-year camp count;
   - total camp count for delete rules;
   - visible page only.
3. Add `app/api/team-venues/list/route.ts`.
4. Cache by org/team/status/page/loadMore/currentYear.
5. Render venue rows from cache first; revalidate camp counts after paint.
6. Keep create/link venue options fresh enough for correctness.
   - Do not cache available venue options for long.
   - Invalidate immediately after link/create/delete.

Acceptance:

- venue cards/table appear quickly on warm navigation;
- delete disabled state is correct after revalidation;
- newly linked venues appear after mutation redirect;
- no previous-team venue names appear during scope changes.

## 4) Venue ID: `/venues/[id]`

Current state:

- route is `/venues/[id]`, where `id` is `team_venues.id`;
- chrome loads before deferred KPI/tab payload;
- client already caches loaded tab/year data in component state;
- tab API requests currently use `cache: "no-store"`.

Steps:

1. Keep server chrome authoritative:
   - venue identity;
   - team-venue ownership;
   - permissions;
   - scope warnings.
2. Add scoped cache around the existing tab-data API.
   - Cache key includes org/team/teamVenueId/tab/year/page/filter/loadMore.
   - Reuse cached tab payload immediately.
   - Revalidate the selected tab in the background.
3. Add a current-year warm path.
   - When entering Venue ID, warm current year tabs likely to be opened:
     `camps`, `sessions`, and `wind-patterns`.
   - Keep reports and assessments deferred unless selected.
4. Split KPI refresh from tab refresh when possible.
   - Cached tab data can render before KPI refresh finishes.
   - KPI skeletons should not block tab labels or tab chrome.
5. Keep per-tab retry states.
6. Invalidate by mutation:
   - venue update invalidates chrome and all Venue ID tabs;
   - camp mutation invalidates `camps`, `sessions`, and KPI slices;
   - session mutation invalidates `sessions`, reports dependencies, and KPIs;
   - wind pattern mutation invalidates `wind-patterns` and Session Info
     catalogs.

Acceptance:

- returning to the same venue/year shows the last selected tab immediately;
- switching tabs never waits for URL navigation before showing the tab shell;
- stale year/tab data is never reused across a different team venue;
- selected tab shows a small revalidation state instead of a full route skeleton.

## 5) Camp ID: `/team-camps/[id]`

Current state:

- route loads camp chrome, KPIs, and selected tab separately;
- client keeps loaded tab data in component state;
- tab API uses `cache: "no-store"`;
- notes already support incremental loading.

Steps:

1. Add scoped cache around `app/api/team-camps/[id]/tab-data`.
2. Cache by org/team/campId/tab/page/highlight/notesOffset/loadMore.
3. Seed cache from server `initialTabData`.
4. Revalidate selected tab in background.
5. Warm the `sessions` tab when entering Camp ID because it is the most
   operational tab.
6. Keep `goals` and `notes` deferred until selected unless they are already
   cached.
7. Keep notes incremental loading separate from initial tab cache.
8. Invalidate from:
   - camp goal saves;
   - session create/update/delete in the camp;
   - session review/setup changes that affect notes.

Acceptance:

- back from Session ID to Camp ID shows cached Sessions tab immediately;
- notes load more still appends, not replaces;
- save actions clear affected cached tabs;
- unavailable camp still comes only from server access checks.

## 6) Session ID: `/team-sessions/[id]`

Current state:

- server resolves scope and session shell;
- header actions and tab payloads are deferred;
- client keeps loaded tab data in state;
- dynamic tab panels use a compact generic spinner fallback.

Steps:

1. Add scoped cache around `app/api/team-sessions/[id]/tab-data`.
2. Cache by org/team/sessionId/tab/assetOffset/catalogOffset.
3. Seed cache from server `initialTabData`.
4. Revalidate selected tab in background.
5. Replace generic dynamic panel fallback with mirrored tab skeletons where the
   final layout is known.
6. Keep `info` as the warm/default tab.
7. Load catalogs only when needed:
   - standard moves catalog only when editing/linking in Info;
   - wind pattern catalog only when editing/linking in Info;
   - gear catalog only on Gear tab;
   - setup definitions only when opening Setup.
8. Preserve asset pagination and signed URL freshness.
   - Do not persist signed URLs beyond their safe lifetime.
   - Cache asset metadata separately from signed content URLs if needed.
9. Invalidate from:
   - info saves;
   - goals/results/setup saves;
   - asset upload/delete;
   - gear changes.

Acceptance:

- opening an already visited session tab paints immediately;
- asset tabs do not reuse expired signed URLs;
- Info edit stays desktop Sheet and mobile Drawer;
- save buttons keep pending spinner and disabled state;
- stale tab content never survives a successful mutation affecting that tab.

## Rollout Order

1. Sessions list pilot.
2. Camp ID return path from Session ID.
3. Session ID tab cache and mirrored dynamic skeletons.
4. Camps list.
5. Venue ID current-year tab cache.
6. Venues list row-metric split.
7. Promote proven pieces into `LOADING_PATTERNS.md`.
8. Refresh route audit files only after implementation is measured.

## Validation Gate Per Route

Run after each route implementation:

```text
npm run lint
./node_modules/.bin/tsc --noEmit --pretty false
npm test
git diff --check
```

For docs-only updates:

```text
git diff --check
```

Manual checks:

- cold direct navigation;
- warm back navigation;
- filter change;
- page/load-more action;
- tab switch;
- mutation redirect;
- scope change between teams;
- mobile card flow;
- desktop table flow.

## What Not To Do

- Do not cache server permission decisions in browser storage.
- Do not show previous org/team data while a new scope is resolving.
- Do not replace route-level skeletons with generic spinners.
- Do not load all historical sessions/camps for first paint.
- Do not make available venue/create form options long-lived without mutation
  invalidation.
- Do not add global realtime or broad polling for the first implementation.
- Do not adopt a new query library until the Sessions pilot shows that the
  local helper is insufficient.

## Done Definition

This plan is complete when all six pages can:

- render useful warm content immediately after repeat navigation;
- revalidate without collapsing the route;
- keep auth and permissions server-first;
- invalidate stale slices after mutations;
- preserve mobile PWA behavior;
- show route-specific timing improvements in logs.
