# Admin UI V1 — restrained working interface

Branch: `V1-ui-admin`. Updated 25/10/2026 after review of the first UI trial.

## Scope

Frontend admin only. Sidebar destinations and order, API, contracts, permissions,
database configuration and publication rules remain unchanged. No new dependencies.
The original Expo project is untouched.

## Current design

- White working area, neutral sidebar, restrained teal from the GoEase logo.
  Orange is reserved for items requiring attention. No coloured KPI tiles.
- Segoe UI / system typography, moderate weights, 4px corners, minimal shadows.
- A compact page title and count replace repeated descriptive headings in Places.
- Places has compact photos, simple status labels, text row actions and no repeated
  decorative icons in table cells. Search/filter/map/batch actions remain available.
- Overview has an unboxed numerical strip, a prioritised task list and plain quick
  links. The map is expandable; its existing ResizeObserver handles opening it.
- Editor uses a flat form, separate checklist and persistent save bar. Images,
  price/hours and source history remain in their existing tabs.
- Campaign summaries use plain numbers. Quality completeness uses a horizontal
  progress indicator instead of a decorative ring; its explanation is expandable.
- Hover and focus feedback is restrained; reduced-motion preferences are respected.

## References

- [Carbon data table guidance](https://carbondesignsystem.com/components/data-table/usage/):
  hierarchy of title, toolbar, table and pagination.
- [Atlassian icon usage](https://atlassian.design/components/icon/usage):
  use recognizable icons sparingly to avoid visual noise.
- [React Bits](https://reactbits.dev/) was reviewed for interaction references.
  No animation library or decorative effect was added to this working interface.

## Verification

- Client ESLint, TypeScript, production build and changed-file formatting checked.
  Vite still reports the existing large-bundle advisory.
- Nine admin destinations opened at 1366px and 390px. No page-level horizontal
  overflow observed. Mobile category and sort controls retain readable widths.
- Opened all editor tabs without saving. Opened/collapsed the overview map and
  checked its rendered dimensions.
- Filtered Places to Văn hóa, searched Điện Quang Minh and observed one matching
  row. Selected/unselected the row and checked the batch preview action appears;
  filters and search were then reset.
- No publishing, settings saves, province toggles, batch execution or new collection
  campaigns were performed as part of UI verification.
- These are frontend/build/layout checks, not renewed backend/provider acceptance.
  External map tiles and source lookups can still fail independently of the UI.

Local screenshots and layout measurements:
`.local/ui-admin-v1/professional/` (ignored by Git).
