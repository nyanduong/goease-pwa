# Admin UI V2 — mustard reference

Date: 27/10/2026. Branch: V2-ui-admin, based on main 6a55bb1.

## Implementation

Existing frontend: React 19 + TypeScript/TSX + Vite + Tailwind CSS 4. The supplied mustard-admin-preview.html / mustard-admin-react.zip and screenshot are visual references. Their JSX demo, shopping data, package scripts and dependencies were not installed or substituted for GoEase.

- Sidebar #e5be55, selected row #243149 with white label/yellow icon; same nine destinations and existing grouping/order. Desktop sidebar stays at the left, including the editor.
- Neutral canvas #f4f6fa, white panels, slate headings, consistent borders, compact tables, controls and status treatments. Scope is .admin-desktop-shell; customer styles are unchanged.
- Overview uses the existing API counts, tasks and run summaries. KPI icons and a status donut present draft/published/archived counts. No invented revenue, time-series, trends or sales data.
- Topbar adds local navigation search from shared admin section metadata: accent-insensitive matching, Enter navigation, ArrowDown to result, Escape to close and Ctrl/Cmd+K to focus. It searches pages/functions, not remote records.
- At narrow widths the existing sidebar becomes a drawer. Toggle, backdrop, navigation and Escape close it; Escape from a sidebar link restores toggle focus. Closed sidebar is hidden from keyboard navigation. Reduced-motion is respected. This is not a complete screen-reader audit.
- Existing catalog filters, mutation callbacks, approval/publishing guards, map/editor layout, settings preservation and API contracts remain. No backend, schema, dependency, environment or password changes.

## Verification

- Existing admin demo found through read-only MongoDB lookup. Known demo credential verified against its existing hash; signed in through the normal login UI. No account creation/reset/privilege changes. Login naturally creates a session/audit; no catalog/settings writes were submitted during review.
- Browser: overview, review queue, places, editor/create, history, sources, settings, progress, automatic collection and schedules inspected at desktop. Source/API data used; no publish, import, collection-start, scheduling-save or settings-save action submitted. A disposable empty local editor was discarded through its existing confirmation.
- Viewports: 1536×1024 primary reference; selected 1280×800 laptop and 375×667 phone states. No document horizontal overflow in recorded metrics. Tables/tabs may intentionally scroll within their containers. CSS viewport/browser screenshots do not certify physical devices or OS keyboard behavior.
- Local screenshots/metrics: .local/admin-v2-mustard/. Selected portable screenshots: ui-admin-v2/evidence/.
- Client TypeScript/Vite build, ESLint, changed-file Prettier and git diff --check: PASS. Existing Vite main-chunk warning remains; no performance-budget claim. Backend unit tests were not repeated for this frontend-only task.

## Runtime limit

GET /api/v1/admin/catalog/history returns HTTP 500 on this local dataset. The error presentation was checked and its generic English copy localized with retry retained. Successful history retrieval is not accepted; backend investigation remains separate. The other reviewed pages could load their normal data after local services were restarted.

Existing MongoDB 27022 was restarted on its original data path and replica set; the shared 27017 service was preserved. Vite 5180/API 3000 were restored as hidden background processes after their prior terminal process stopped. Existing background work can resume normally; no new collection job was started by the UI review.

Delivery target: V2-ui-admin only, as requested by the owner; main is unchanged.

## Header guidance refinement

- Removed repeated area captions and explanatory subtitles from all nine admin page headers and the place editor; the functional area selector remains in the top bar.
- Added a circular question button with page-specific purpose and steps in a native modal dialog, including Escape, close controls, focus return, and a constrained scrollable mobile layout.
- Aligned the sidebar logo beside GoEase, with Quản trị directly below the name.
- Browser checks: nine visible page headers, editor guidance, open/close/Escape and focus return; popup at 375×667 had no horizontal overflow. No save, publish, schedule or collection operation was triggered.
- Existing history API HTTP 500 remains outside this frontend change.

## Table, navigation and guidance follow-up

- Standardized admin table typography, column headings, cell padding, vertical alignment, action placement and secondary metadata across catalog, collection, history, progress and supporting tables.
- Province rows now use four balanced columns (province, travel region, visibility switch, actions). Removed redundant switch-state text and moved visibility explanations into the help dialog. Existing confirmation, API and busy/error behavior remain unchanged.
- Removed the demo account name from the sidebar and top bar. Added a working desktop sidebar toggle alongside the existing mobile drawer. Brand lockup uses the supplied full-width dark blue header.
- Overview map uses a 4:3 canvas. The question trigger is 20px with a larger hit area; all nine page guides and the place editor have concrete beginner steps. Longer guides scroll within the dialog.
- Frontend-only changes; no backend, environment, database schema or API changes.

- Brand reference update: replaced the light inset brand card with a full-width dark blue header, subtle geometric background, white GoEase title and pale subtitle. Verified 255px edge-to-edge brand width on the mobile drawer and desktop rendering.

- Removed duplicate page-title counts and the province header count already represented by list filters; removed the Ctrl K search badge. Search and its keyboard shortcut remain available.
