# Admin UI V1 — structured working interface

Branch: `V1-ui-admin`. Updated 25/10/2026 after review of the first UI trial.

## Scope

Frontend admin only. Sidebar destinations and order, API, contracts, permissions,
database configuration and publication rules remain unchanged. No new dependencies.
The original Expo project is untouched.

## Current design

- Light neutral page canvas, white work surfaces and sidebar. Teal from the
  GoEase logo identifies the active section and primary actions. Amber is
  reserved for attention states; supporting actions are neutral outlines.
- Segoe UI / system typography, moderate weights, 8px controls and 12px panels,
  minimal shadows. The sidebar's destinations and order are preserved.
- A 32px page title and quiet count replace repeated descriptive headings in Places.
- Places has compact photos, simple status labels, text row actions and no repeated
  decorative icons in table cells. Search/filter/map/batch actions remain available.
- Overview has four quiet metric cards, a dominant task panel and separate quick
  links. The map is expandable; its existing ResizeObserver handles opening it.
- Editor uses separate form and checklist surfaces and a persistent save bar. Images,
  price/hours and source history remain in their existing tabs.
- Campaign summaries use plain numbers. Quality completeness uses a horizontal
  progress indicator instead of a decorative ring; its explanation is expandable.
- Hover, press, 180ms content entrance and 220ms drawer entrance feedback share
  one motion scale. Reduced-motion preferences disable these transitions.

## References

- [Carbon data table guidance](https://carbondesignsystem.com/components/data-table/usage/):
  hierarchy of title, toolbar, table and pagination.
- [Atlassian icon usage](https://atlassian.design/components/icon/usage):
  use recognizable icons sparingly to avoid visual noise.
- [React Bits](https://reactbits.dev/) was reviewed for interaction references.
  No animation library or decorative effect was added to this working interface.

## Composition and colour revision — 26/10/2026

Supersedes the earlier orange primary buttons and flat white canvas. The same
data and actions now share a neutral canvas / white panel / teal action hierarchy.
Places combines tabs, toolbar and table into one surface. The editor separates
the form from the publication checklist. Empty schedules use a short three-step
guide, one creation action and a subordinate collection-history link.

Small missing-photo tiles use a neutral placeholder instead of unreadable text;
the original status stays available through its accessible name and tooltip.
Large placeholders retain the visible explanation. No photo is fabricated.

Only frontend presentation and the QA note changed. Removed stray parentheses
that had been rendered around the overview content. No handlers, API requests,
publication checks, quotas or database configuration were changed.

Current revision checks: client ESLint, TypeScript/production build and diff
whitespace validation passed. Visited all nine routes at 1440px and 390px with
no page-level horizontal overflow. Visually inspected overview, Places, review,
sources, settings, editor and schedules. The schedule drawer fits 390px; Tab
moves from Close to the area selector with a visible 2px focus outline. Opened
and closed it without saving. Mobile Places filters fit paired columns.
Screenshots and measurements: `.local/ui-admin-v1/studio/` (ignored by Git).
Backend/provider suites were not repeated for this presentation-only revision.

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

## Readability revision — 26/10/2026

- Increased body copy to 16px, table copy to 15px and place names to 16px.
  Reduced supporting text weights and increased row spacing. Page titles are
  32px on desktop and 28px on narrow screens; section titles have a lower level.
- Empty schedules have one create action. Search/filter controls and repeated
  creation actions appear only when there are schedules to manage.
- Schedule editor uses a 26px title, 16px supporting copy and larger controls.
  Its header and footer remain visible while the form scrolls independently.
- Integrated main through `1019a2e`. Adapted the new enrichment panel to the same
  typography and action hierarchy, with responsive counts and unbroken action
  labels. API handlers and data rules are unchanged by this UI revision.
- Read-only layout checks covered all nine routes at 1366px and 390px, plus the
  schedule creation drawer without saving. No page-level horizontal overflow
  observed. No collection or enrichment job was started during visual review.
- Screenshots and measurements: `.local/ui-admin-v1/readability/` (ignored).
- After the main merge, root build and lint passed; all 109 unit tests passed.
  The final CSS adjustment also passed the client TypeScript/production build
  and `git diff --check`. Vite's existing large-chunk advisory remains.
- Verified the campaign header actions at 390px after a fresh page load: labels
  stay on one line and controls are 44–45px tall. Restarted the local web/API
  preview after shared-package builds; database health reports connected.
