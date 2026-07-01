# Mobile Card List UI Patterns

Source of truth for Sailog mobile list screens. Current reference:
`/team-sessions`, implemented by:

- `features/sessions/sessions-table.tsx`
- `features/sessions/team-sessions-toolbar.tsx`
- `features/sessions/session-form-dialogs.tsx`
- `MOBILE_UI_PATTERNS.md`

Use this with `DESKTOP_UI_PATTERNS.md`: desktop uses tables, mobile uses
cards.

## Structure

- Mobile list screens should render cards, not horizontally scrollable tables.
- Keep desktop and mobile surfaces split with responsive classes:
  `md:hidden` for cards and `hidden md:block` for tables.
- Cards should be compact, tappable, and built for scanning.
- Use `GradientCard` or the local repeated-item surface. Do not put cards inside
  cards.
- Keep the mobile toolbar focused on filters/search. The primary create action
  belongs in the mobile FAB.

## Data And Performance

- Mobile lists should avoid loading the full dataset upfront.
- Prefer incremental loading with a visible `Load more` control when the
  operator benefits from accumulated context.
- `/team-sessions` uses `loadMore=1` so page 2 shows pages 1 and 2 together on
  mobile.
- Keep page size explicit and shared with the desktop data layer unless mobile
  has a documented reason to differ.
- Preserve filters and scope in the URL.
- Keep the existing cards visible while more data loads.
- Show loading in the `Load more` button, not by replacing the whole list.
- Avoid client-side caches for primary list data unless the route has a real
  stale-data requirement. Use server data and URL state first.

## Filters

- Mobile filters open in a Drawer or Sheet.
- Filter triggers should be touch sized (`h-11`) and easy to reach.
- Keep filters grouped rather than scattering multiple controls around the
  screen.
- Disable unavailable filter controls.
- Preserve selected filters when loading more rows or navigating to details.
- Applying or clearing filters should reuse the list loading pattern for the
  current surface. Do not add multiple spinners to individual filter controls.
- Mobile filter transitions should keep the current cards visible, dim and
  disable the card list, disable the filter trigger/actions, and show one
  centered spinner over the cards.
- On accumulated or long card lists, center the filter spinner in the visible
  mobile viewport between the fixed header and bottom navigation. Do not center
  it against the full rendered list height, because the spinner will drift down
  as more cards are loaded.
- The filter Drawer/Sheet may close immediately after Apply/Clear; the visible
  pending state then belongs to the card list surface, not the closed Drawer.

## Title

- Mobile title should be short and route-specific.
- Put the mobile title in the screen/header/toolbar area, not inside every card.
- Do not add instructional text above the list unless it changes an operator
  decision.

## Cards

- A card should show the minimum fields needed to decide whether to open it.
- Primary text goes first; secondary context goes below in muted text.
- Use truncation for long names and locations.
- Keep numeric/time values tabular when they must be compared.
- Highlighted state may change border/background, but text should still state
  the value when relevant.
- Card tap target should cover the full card.
- Secondary row/card action uses an `h-11 w-11` icon button.

## Pagination And Loading

- Mobile should not use dense page-number pagination for operational lists.
- Use a full-width `h-11` `Load more` button below the cards when more results
  exist.
- Button copy should change while pending, for example `Loading more...`.
- Include a spinner while loading more.
- Disable the button while pending.
- Keep already loaded cards in place during the transition.
- Filter pending is separate from incremental loading: applying or clearing
  filters uses the card-list overlay spinner, while `Load more` keeps its
  spinner in the button.
- Desktop page-to-page pending state belongs in desktop pagination, not mobile
  card lists.

## Actions

- Primary create action uses `mobile-floating-action size-14`.
- Create/edit flows open Drawers on mobile.
- Row/card edit actions use `h-11 w-11` icon buttons.
- Read-only users should see a disabled unavailable action when the missing
  action would otherwise leave a confusing blank area.
- Save buttons inside mobile Drawers follow `MOBILE_UI_PATTERNS.md`: fixed
  footer, `h-11 w-full`, disabled while pending, spinner plus pending copy.

## States

- Empty state uses the same card surface as list items, with concise copy.
- Missing team/scope and read-only warnings stay above the list.
- Card navigation shows a local spinner in the action area and can reduce card
  opacity.
- Filter navigation disables and dims the current card list while one centered
  spinner overlays the list. Do not replace cards, blank the screen, or show
  additional spinners inside filter controls.
- Long-list filter overlays should use the mobile shell safe-area/header/bottom
  nav offsets when centering the spinner.
- `Load more` pending state stays in the button.
- Form save/create pending state stays in the submitted Drawer action.
- Do not blank the whole screen for secondary loading.

## Accessibility

- Tappable cards must also support keyboard Enter/Space.
- Icon-only actions need `aria-label`.
- Loading controls should expose changed labels such as `Loading more...`.
- Keep focus and tap targets at least 44px high.
- Do not depend on hover-only affordances on mobile.

## Current `/team-sessions` Notes

- Mobile cards show Date, Camp, Venue, Type, Net time, and Highlight context.
- Mobile uses accumulated loading through `loadMore=1`.
- The list keeps previously loaded cards visible while loading more.
- The create action is a mobile FAB.
- Edit opens a mobile Drawer.
- Filters are grouped in the mobile toolbar/Drawer path and show one centered
  card-list spinner while Apply/Clear navigation is pending.
