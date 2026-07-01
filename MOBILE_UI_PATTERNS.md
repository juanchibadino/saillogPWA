# Sailog Mobile UI Standards

This document is the mobile UI standard for operational screens, list pages, and edit surfaces in Sailog.

Scope:
- Keep desktop behavior unchanged unless the task explicitly includes desktop.
- Apply mobile-only behavior behind responsive classes (`md:hidden`, `hidden md:block`) or `useIsMobile()`.
- Reuse shadcn/ui wrappers and existing Sailog primitives before adding new abstractions.
- Use the Team Session `Setup` and `Edit info` surfaces as the current reference for mobile Drawer form behavior.

## 1. Mobile Sizing Baseline

Goal:
- Controls feel tappable and consistent across mobile pages.

Rules:
- Minimum mobile tap target: `44px`.
- Mobile form buttons, inputs, select triggers, and search fields: use `h-11`.
- Mobile icon buttons inside forms, cards, rows, and edit actions: use `h-11 w-11`.
- Mobile FAB: use `size-14`.
- Keep `rounded-lg` for normal controls and `rounded-full` only for FABs or clearly circular icon controls.
- Keep text at `text-base` for inputs and textareas so iOS does not zoom the page on focus. The shared `Input` and `Textarea` wrappers already do this.
- Desktop can keep the existing compact shadcn sizes (`h-8`, `h-9`, `size-8`, `size-9`) unless a task says otherwise.

Canonical mobile classes:

```tsx
<Input className={isMobile ? "h-11 px-3" : undefined} />
<SelectTrigger className={isMobile ? "h-11 w-full px-3" : "w-full"} />
<Button className={isMobile ? "h-11 w-full" : undefined}>Save</Button>
<Button size="icon" className={isMobile ? "h-11 w-11" : undefined} />
```

## 2. Main Screen FAB

Goal:
- The main action on a mobile screen is always easy to reach and does not fight with filters, search, or list content.

Rule:
- Use one mobile FAB for the main screen action.

Applies to:
- `New Venue`
- `New Camp`
- `New Session`
- `New Gear`
- `New Standard Move`
- `New Wind Pattern`
- `Reports`

Mobile FAB standard:

```tsx
<Button
  type="button"
  variant="default"
  size="icon"
  className="mobile-floating-action size-14 rounded-full shadow-lg shadow-black/20 md:hidden"
  aria-label="Create new session"
>
  <PlusIcon className="size-6" />
</Button>
```

Rules:
- Use `mobile-floating-action`; do not hand-code `bottom-*` offsets. The shared class already clears the bottom nav and safe area.
- Keep the FAB `z-50`; mobile bottom nav is `z-40`.
- Use a lucide icon:
  - `PlusIcon` for create actions.
  - `Settings2Icon` only for Setup.
  - A report/chart icon for Reports when the action opens reporting.
- Always include `aria-label`.
- The mobile FAB opens a Drawer for create/edit/reporting flows.
- Desktop keeps the normal toolbar button or Sheet trigger.
- Use only one FAB per screen. If a screen has multiple creation paths, the FAB should open a menu or Drawer that lets the user choose.

Current implementation references:
- `features/sessions/detail/setup-dialog.tsx`
- `features/sessions/session-detail-tabs-client.tsx`
- `app/globals.css` (`.mobile-floating-action`)

## 3. Save CTA Standard

Goal:
- Save actions match the Team Session Setup edit behavior.

Rules:
- Mobile Drawer Save button: `h-11 w-full`.
- Save lives in a fixed footer area, not inside the scrolling form body.
- Footer uses `DrawerFooter` with `shrink-0 border-t`.
- The form body uses `min-h-0 flex-1 overflow-y-auto`.
- Disable the form while saving through a `fieldset`.
- Disable the Save button while pending.
- Show a spinner and pending text while saving.
- Use `Save` and `Saving...` for edit flows.
- Do not dim the entire form surface during save.

Canonical Save button:

```tsx
<Button type="submit" disabled={isPending} className="h-11 w-full">
  {isPending ? (
    <>
      <Loader2Icon className="size-4 animate-spin" />
      Saving...
    </>
  ) : (
    "Save"
  )}
</Button>
```

Current implementation references:
- `features/sessions/detail/setup-dialog.tsx`
- `features/sessions/detail/info-panel.tsx`
- `features/sessions/detail/gear-panel.tsx`

## 4. Inputs, Selects, And Textareas

Goal:
- Inputs and selects feel as tall and stable as buttons on mobile.

Rules:
- Mobile `Input`: `h-11 px-3`.
- Mobile `SelectTrigger`: `h-11 w-full px-3`.
- Mobile native select controls: `h-11 w-full px-3`.
- Mobile date/time inputs: `h-11`.
- Mobile textareas keep at least `min-h-24` for notes or long text unless the field is intentionally compact.
- Use one-column form layouts on mobile.
- Put labels above fields. Do not rely on placeholder-only labels.
- Keep helper text short and below the control.
- Keep error text below the field and avoid pushing the active control out of view when possible.

Preferred form spacing:
- Field group: `space-y-2`.
- Form body: `space-y-4`.
- Drawer body: `min-h-0 flex-1 overflow-y-auto px-4 pb-4`.

## 5. Search Field Standard

Goal:
- Search is consistent across Gear, Standard Moves, Wind Patterns, Notes, and future catalogs.

Rules:
- Search field height on mobile: `h-11`.
- Use `SearchIcon` at `left-3`.
- Input padding: `pl-9`.
- Use an explicit `aria-label`.
- Debounce live search for remote data.
- Keep search mounted while results load; show loading in the results area, not by replacing the whole toolbar.
- Preserve active filters and scope when search changes.

Canonical search field:

```tsx
<div className="relative">
  <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
  <Input
    value={searchText}
    onChange={(event) => setSearchText(event.target.value)}
    placeholder="Search gear"
    className="h-11 pl-9"
    aria-label="Search gear"
  />
</div>
```

## 6. Icon Button Standard

Goal:
- Icon-only actions are not smaller or harder to tap than text buttons.

Rules:
- Mobile edit pencil, overflow, scan, filter, and close buttons: `h-11 w-11` when they live next to normal buttons or inputs.
- Desktop icon buttons may keep `size="icon"` or `size="icon-lg"` depending on the local toolbar.
- Use lucide icons, not custom SVGs, when lucide has the icon.
- Always include `aria-label` for icon-only buttons.
- Add a tooltip when the icon action is not obvious.
- Use overflow menus for destructive or secondary row actions when space is tight.

Canonical mobile edit button:

```tsx
<Button
  type="button"
  variant="outline"
  size="icon"
  className="h-11 w-11"
  aria-label="Edit item"
>
  <PencilIcon className="size-4" />
</Button>
```

## 7. Keyboard And Focus Visibility

Goal:
- When the keyboard opens, the focused input must remain visible inside the active scroll area.

Rules:
- Drawer and Sheet forms must have fixed header/footer and a single scrolling content region.
- The focused field must be inside that scrolling region.
- Use `100dvh` or the existing drawer CSS variables for mobile surface height. Avoid `100vh` for mobile form surfaces.
- Add enough bottom padding to the scroll region for the Save footer and keyboard-safe scrolling.
- For long mobile forms, scroll the focused control into view after focus.
- Apply the focus visibility behavior to `Input`, `Textarea`, search inputs, select triggers that open searchable controls, and validation error focus targets.

Canonical focus helper for long mobile forms:

```tsx
function keepMobileFieldVisible(event: React.FocusEvent<HTMLElement>) {
  window.setTimeout(() => {
    event.currentTarget.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: "smooth",
    })
  }, 120)
}
```

Use it only on mobile surfaces where lower fields can be hidden by the keyboard. Do not apply it globally to every desktop form.

Drawer structure standard:

```tsx
<DrawerContent className="h-[85dvh] overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
  <DrawerHeader className="shrink-0 border-b px-4 py-3" />
  <fieldset className="min-h-0 flex-1 overflow-y-auto px-4 pb-28">
    {/* fields */}
  </fieldset>
  <DrawerFooter className="shrink-0 border-t">
    {/* Save */}
  </DrawerFooter>
</DrawerContent>
```

Drawer handle and optional title rules:
- Bottom Drawers use the shared top handle from `components/ui/drawer.tsx`.
- The handle must have vertical breathing room so it does not touch the rounded border or the first control. Current shared standard: `my-5`.
- Selection/catalog Drawers may omit the visible title when the first control already explains the surface, such as a search input labeled `Search Standard Moves`.
- If the visible title is omitted, keep an accessible title with `sr-only` using `DrawerTitle`.
- Do not remove the title from subviews that need navigation context, such as setup-style back-arrow screens.

## 8. Header Pattern

Goal:
- Mobile header shows:
  - back arrow on the left
  - current page title centered and truncated
  - menu icon on the right for selected routes

Current implementation:
- `components/site-header.tsx`
  - phase-1 mobile header branch
  - `showMobileSidebarTrigger` enables menu icon on selected team routes

Reuse steps:
1. Ensure the route is included in `shouldUsePhaseOneMobileHeader`.
2. Add the route condition to `showMobileSidebarTrigger` when a menu icon is required.
3. Keep `router.back()` and fallback logic unchanged.
4. Detail mobile headers should use the object name when available. Team Camp
   detail resolves the camp name in the shared header.
5. Avoid repeating the mobile header title in the page body. Team Camp detail
   hides the desktop H1 on mobile and shows only the `[Location]` badge in the
   content header.

## 8.1 Mobile Loading Pattern

Goal:
- Loading states should feel like the final mobile screen, not like a separate
  blank page.

Rules:
- Keep fixed labels visible and skeletonize values. Team Session ID keeps
  `Type`, `Date`, `Dock Out`, and `Duration` visible while values load.
- Keep mobile tabs in their final `h-11` segmented row during loading.
- If the final tab row uses `More`, the skeleton should keep the same overflow
  affordance.
- Use mobile card/list skeletons for deferred lists, media, analytics, and gear
  panels instead of a generic centered spinner.
- Keep primary mobile actions in their final locations during loading. For Team
  Session ID, Setup remains a mobile FAB-shaped disabled control while the
  session metadata loads.
- For route-level loading, use `loading.tsx` and the shared skeleton from
  `components/shared/page-skeletons.tsx`.
- For in-route deferred loading, keep the already rendered chrome mounted and
  put skeletons inside the deferred section.

Reference:
- `LOADING_PATTERNS.md`
- `app/(app)/team-sessions/[id]/page.tsx`
- `components/shared/page-skeletons.tsx`

## 9. Mobile Toolbar Pattern

Goal:
- Toolbar content handles filters and search. Main create actions live in the FAB.

Rules:
- Mobile toolbar can include search, filter, tabs, and lightweight scope controls.
- Filter opens a Drawer.
- Use `DrawerTrigger asChild` with a real `Button`.
- Keep desktop dropdown filters unchanged.
- New/create actions should move to the mobile FAB when a screen is touched for mobile refinement.

Current implementation references:
- Sessions: `features/sessions/team-sessions-toolbar.tsx`
- Team Venues: `features/team-venues/team-venues-toolbar.tsx`

Legacy note:
- Some current mobile list toolbars still render `New` on the right. Treat that as legacy until the next mobile pass for that screen.

## 10. Mobile Tabs Pattern

Goal:
- Mobile tabs use the full available width and keep the active view easy to tap.

Rules:
- Mobile tab rows should use the Team Session ID height pattern: an outer
  `h-11 w-full max-w-full` wrapper with an inner `TabsList` forced to
  `h-full`.
- The inner mobile `TabsList` should override the shared primitive default:
  `h-full min-w-0 flex-1 rounded-md bg-transparent p-0 group-data-horizontal/tabs:h-full`.
- Mobile `TabsTrigger` items should share the row width: `min-w-0 basis-0`.
- Desktop tabs can stay compact: `hidden h-10 md:inline-flex`.
- Split mobile and desktop tab lists with `md:hidden` and `hidden md:inline-flex` when the sizing differs.
- Keep tab labels short enough to avoid wrapping.
- Use a `More` overflow control when all mobile tabs do not fit cleanly in one row.
- The active tab must stay visible. If a tab is selected from `More`, move it into the visible tab row.
- `More` should be a touch-sized control with visible text plus `ChevronDownIcon`, and its menu should show the overflow tabs.

Current implementation references:
- Team Session ID overflow tabs with `More`:
  `features/sessions/detail/mobile-tabs.tsx`
- Camp detail full-width mobile tabs:
  `features/camps/camp-detail-tabs-client.tsx`

Canonical simple mobile tabs:

```tsx
<div className="flex h-11 w-full max-w-full items-center rounded-lg bg-muted p-[3px] text-muted-foreground md:hidden">
  <TabsList className="h-full min-w-0 flex-1 rounded-md bg-transparent p-0 group-data-horizontal/tabs:h-full">
    {tabs.map((tab) => (
      <TabsTrigger key={tab} value={tab} className="min-w-0 basis-0 px-2">
        {label}
      </TabsTrigger>
    ))}
  </TabsList>
</div>

<TabsList className="hidden h-10 md:inline-flex">
  {/* compact desktop triggers */}
</TabsList>
```

Canonical overflow behavior:
- Start from the Team Session ID pattern when a route has more tabs than fit on
  common mobile widths.
- Keep visible tabs inside the full-width segmented row.
- Put hidden tabs behind `More`.
- Use `ResizeObserver` or an equivalent width check so the visible set adapts
  to the viewport.

## 11. Mobile List/Card Vs Desktop Table

Goal:
- Mobile: cards.
- Desktop: table.

Current implementation:
- Sessions: `features/sessions/sessions-table.tsx`
- Team Venues: `features/team-venues/team-venues-table.tsx`

Key rules:
- Mobile cards container: `md:hidden`.
- Desktop table container: `hidden md:block`.
- Card click navigates to detail page.
- Action controls inside a card stop propagation (`onClick` and `onKeyDown`).
- Row/card icon actions follow the `h-11 w-11` mobile icon button standard.

## 12. Modal Container Pattern

Goal:
- Mobile forms use Drawer.
- Desktop edit surfaces use Sheet or Dialog according to the established local pattern.

Current implementation:
- Sessions:
  - `features/sessions/session-form-dialogs.tsx`
  - `features/sessions/detail/info-panel.tsx`
  - `features/sessions/detail/setup-dialog.tsx`
- Team Venues:
  - `features/team-venues/team-venues-table.tsx`

Reuse steps:
1. Build the form/content once in a shared JSX block.
2. If `useIsMobile()` is true, render Drawer wrapper.
3. Else render Sheet for right-side edit surfaces or Dialog where the existing screen already uses Dialog.
4. Keep the same action/form logic in both wrappers.
5. Keep header/footer fixed and content scrollable on mobile.

## 13. Progressive Loading Pattern

Goal:
- Lists stay usable while more data loads.

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
1. Add `page` and optional `loadMore` param support.
2. Add accumulator mode in data loader (`rangeStart=0`, `visibleCount=page * pageSize`).
3. Render button below cards only when `hasNextPage`.
4. Use `useTransition` for button pending state.

## 14. Visual Pattern Notes

Sessions card highlight:
- Mobile highlighted cards use brighter green border and tinted background.
- Implemented in `features/sessions/sessions-table.tsx`.

Filter button visual:
- On mobile, use icon-only filter buttons when the page also has search or tabs.
- Filter icon buttons follow the mobile icon button standard.

## 15. Scrollbar Pattern

Goal:
- Hide page scrollbars on mobile while keeping content scrollable.

Current implementation:
- `app/globals.css`
  - mobile media query (`max-width: 767px`) hides `html` and `body` scrollbars.

## 16. Reuse Checklist

When adding or refactoring a mobile team module:
1. Main action:
   - mobile FAB with `mobile-floating-action size-14`
   - desktop toolbar button unchanged
2. Header:
   - route included in phase-1 mobile header
   - menu icon route condition added if needed
3. Toolbar:
   - search/filter/scope only on mobile
   - filter uses Drawer
   - tabs use full-width mobile sizing and `More` for overflow
4. Data view:
   - mobile cards and desktop table split
5. Forms:
   - mobile Drawer
   - desktop Sheet/Dialog according to local pattern
   - fixed header/footer and scrollable content
6. Controls:
   - mobile inputs/selects/search/buttons use `h-11`
   - mobile icon buttons use `h-11 w-11`
7. Async UX:
   - Save button disabled with spinner
   - results loading stays inside the result area
8. Keyboard:
   - focused input stays visible after keyboard opens
   - scroll region has enough bottom padding
9. Keep desktop behavior intact.

## 17. Canonical Examples

- Mobile FAB and safe area:
  - `app/globals.css`
  - `features/sessions/detail/setup-dialog.tsx`
  - `features/sessions/session-detail-tabs-client.tsx`
- Save CTA and fixed footer:
  - `features/sessions/detail/setup-dialog.tsx`
  - `features/sessions/detail/info-panel.tsx`
  - `features/sessions/detail/gear-panel.tsx`
- Search:
  - `features/sessions/detail/gear-panel.tsx`
  - `features/sessions/detail/info-panel.tsx`
  - `features/notes/team-notes-toolbar.tsx`
- Header:
  - `components/site-header.tsx`
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
