# Admin UI V1

Branch: `V1-ui-admin` · 25/10/2026.

## Scope

Frontend admin presentation only. Sidebar entries and their order remain intact.
The original Expo repository, API, contracts, database configuration and business
rules are unchanged. No new dependencies.

## Design

- Logo palette: teal `#007e89`, deeper teal `#00636e`, orange `#f69b24`.
- White working surfaces on a quiet light background. Smaller headings and muted
  supporting copy keep primary actions and issues easy to find.
- Solid teal primary actions, outlined secondary actions, orange attention states.
- Less-used geographical filters live in an expandable control with an active
  filter indicator. Filtering and search still use the existing handlers.
- Overview highlights work requiring attention. Photo-processing details no
  longer crowd the task previews.
- Editor starts with core information; image suggestions remain in the Images
  tab. The save bar distinguishes saved edits from public content.
- Review filters have their own toolbar. A compact photo leaves the checklist
  visible sooner; full-image viewing is still available.
- Source limits and licensing details remain available in an expandable section.
- User-facing copy replaces terms such as raw payload, revision and exceptions
  where they appeared in the edited components. Implementation identifiers stay
  unchanged.

## Verification

- Client TypeScript, client ESLint, client production build and changed-file
  formatting checked. Vite still reports its large-bundle advisory.
- Local app inspected through the browser with the existing admin test account.
- All nine admin destinations opened at desktop width 1366. Narrow layouts
  inspected at width 390. No document-level horizontal overflow observed.
- Manually checked overview, place table/editor, review checklist, campaign list
  and setup form, province settings and history table. Checked all editor tabs.
- Region filter tested with Miền Nam, then reset. Place search tested and cleared.
- No publishing, province toggles, configuration saves, campaign execution or
  bulk changes were performed for UI verification.
- This is UI verification, not renewed acceptance of backend/provider flows.
  External map tiles and source lookups can still fail independently of layout.

Screenshots are kept locally under `.local/ui-admin-v1/`, outside Git.
