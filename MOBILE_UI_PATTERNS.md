# Sailog Mobile UI Patterns (Phase 1)

This document captures the mobile patterns currently used in Team Sessions and Team Venues, and how to reuse them in other team modules.

Scope:
- Keep desktop behavior unchanged.
- Apply mobile-only behavior behind responsive classes (`md:hidden`, `hidden md:block`) or `useIsMobile()`.

## 1. Header Pattern

Goal:
- Mobile header shows:
  - back arrow (left)
  - current page title (center/truncate)
  - menu icon (right) for selected routes

Current implementation:
- `components/site-header.tsx`
  - phase-1 mobile header branch
  - `showMobileSidebarTrigger` enables menu icon on:
    - `/team-sessions`
    - `/team-venues`

Reuse steps:
1. Ensure the route is included in `shouldUsePhaseOneMobileHeader`.
2. Add the route condition to `showMobileSidebarTrigger` when a menu icon is required.
3. Keep `router.back()` + fallback logic unchanged.

## 2. Mobile Toolbar Pattern (Filter Left / New Right)

Goal:
- One full-width row on mobile:
  - Filter button on the left
  - Primary action (`New`) on the right

Current implementation:
- Sessions: `features/sessions/team-sessions-toolbar.tsx`
- Team Venues: `features/team-venues/team-venues-toolbar.tsx`

Key rules:
- Use `section` with `flex w-full items-center justify-between gap-2`.
- Filter opens a Drawer.
- Use `DrawerTrigger asChild` with a real `Button`.
- Keep desktop dropdown filters unchanged.

Sizing conventions (mobile):
- Filter: `size="default"` + `className="h-9 px-3"`
- New: `size="default"` + `className="h-9 px-3"`

## 3. Mobile List/Card vs Desktop Table

Goal:
- Mobile: cards
- Desktop: table

Current implementation:
- Sessions: `features/sessions/sessions-table.tsx`
- Team Venues: `features/team-venues/team-venues-table.tsx`

Key rules:
- Mobile cards container: `md:hidden`
- Desktop table container: `hidden md:block`
- Card click navigates to detail page.
- Action controls inside card stop propagation (`onClick` / `onKeyDown`).

## 4. Modal Container Pattern (Mobile Drawer / Desktop Dialog)

Goal:
- Mobile forms use Drawer.
- Desktop forms use Dialog.

Current implementation:
- Sessions:
  - `features/sessions/session-form-dialogs.tsx`
  - `CreateSessionDialog`, `EditSessionDialog`
- Team Venues:
  - `features/team-venues/team-venues-table.tsx`
  - `CreateTeamVenueDialog`, `EditTeamVenueDialog`

Reuse steps:
1. Build the form/content once in a shared JSX block.
2. If `useIsMobile()` is true, render Drawer wrapper.
3. Else render Dialog wrapper.
4. Keep the same action/form logic in both wrappers.

## 5. Progressive Loading Pattern (Sessions)

Goal:
- Show 10 cards initially.
- `Load more` appends 10 more each time.
- Button stays below cards.
- While loading, button is disabled and shows spinner.

Current implementation:
- `features/sessions/data.ts`
  - `TEAM_SESSIONS_PAGE_SIZE = 10`
  - `accumulatePages` support
- `app/(app)/team-sessions/page.tsx`
  - reads `loadMore=1`
  - passes `accumulatePages`
- `features/sessions/sessions-table.tsx`
  - button label: `Load more`
  - loading state: `useTransition`, spinner icon

Reuse steps:
1. Add `page` + optional `loadMore` param support.
2. Add accumulator mode in data loader (`rangeStart=0`, `visibleCount=page*pageSize`).
3. Render button below cards only when `hasNextPage`.
4. Use `useTransition` for button pending state.

## 6. Visual Pattern Notes

Sessions card highlight:
- Mobile highlighted cards use brighter green border and tinted background.
- Implemented in `features/sessions/sessions-table.tsx`.

Filter button visual:
- On mobile we now use icon-only filter buttons in team modules where applied.

## 7. Scrollbar Pattern (Mobile)

Goal:
- Hide scrollbars on mobile.

Current implementation:
- `app/globals.css`
  - mobile media query (`max-width: 767px`) hides `html` / `body` scrollbars.

## 8. Reuse Checklist (Quick)

When adding a new Team module mobile refactor:
1. Header:
   - route included in phase-1 mobile header
   - menu icon route condition added if needed
2. Toolbar:
   - `Filter` left, `New` right (`justify-between`)
   - filter uses Drawer
3. Data view:
   - mobile cards + desktop table split
4. Forms:
   - mobile Drawer, desktop Dialog
5. Async UX:
   - loading state on save/actions
   - for incremental lists: `Load more` + spinner
6. Keep desktop behavior intact.

## 9. Canonical Examples

- Header: `components/site-header.tsx`
- Sessions:
  - `features/sessions/team-sessions-toolbar.tsx`
  - `features/sessions/sessions-table.tsx`
  - `features/sessions/session-form-dialogs.tsx`
  - `features/sessions/data.ts`
  - `app/(app)/team-sessions/page.tsx`
- Team Venues:
  - `features/team-venues/team-venues-toolbar.tsx`
  - `features/team-venues/team-venues-table.tsx`
- Global mobile scrollbar:
  - `app/globals.css`
