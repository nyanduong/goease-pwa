# Changelog

## 26/10/2026 — C01

- Created V1-ui-customer from clean main 9ce30dc.
- Inventoried customer routes and conditional screens from source and baseline
  screenshot pack. Recorded identity, API and navigation boundaries.
- Defined the customer token/component plan and independent acceptance tasks.

## 26/10/2026 — foundations and module implementation

- Central Phosphor icons replace Lucide, including mechanical admin imports.
  Admin layouts and all backend/contracts/database files are unchanged.
- Added scoped customer tokens, 48px actions, clearer type hierarchy, focus,
  reduced motion, viewport-aware sheets, five-item navigation and focused editors.
- Home prioritizes trips and uses honest no-photo destination surfaces. Explore
  filters are compact; cards retain their full names, credits and real content.
- Replaced the fixed-city Explore iframe with a lazy Leaflet map of the already
  loaded places. Directions now use each place's name and destination.
- Unified quick setup actions, fixed collapsed suggestion columns, separated
  attribution from titles, improved activity/day controls and budget hierarchy.
- Profile security/privacy explanations are accessible disclosures; Goe composer,
  floating-panel boundaries, shared page and offline typography follow the shell.
- Preserved existing request handlers, validation, money calculations, quotas,
  ownership, dirty guards and auth behavior. No live AI/email calls during QA.
- Reviewed six phone sizes plus tablet/landscape/desktop; corrected duplicate
  tablet navigation, compacted the summary and activity references, and recorded
  actual browser/fixture evidence alongside the external acceptance gates.

## 26/10/2026 — structural mobile revision after feedback

Replaced oversized editorial task screens with compact app bars, horizontal trip cards, photo grid, day timeline, cost switch, account rows and focused Goe chat. Preserved dirty guards and existing callbacks. Corrected detail footer offset, contextual menu sizing and placement, and offline static cache invalidation. Current 7-phone matrix plus selected tablet/landscape/screens reviewed; see QA_REPORT.md. No push/merge.

## 26/10/2026 — color, field and profile correction

Current review supersedes earlier color acceptance. Source changes: customer-ui.css, customer-shell.tsx, avatar-picker.tsx and offline presentation/cache version. No backend/API/schema/env changes.

- Corrected doubled focus boxes in destination search, discovery, Explore, chat composer and password wrappers. Runtime destination input border/outline are both 0px; outer field has one 1px border plus subtle focus shadow.
- Fixed avatar frame/image size mismatch and the inherited decorative profile stripe; actions wrap separately. Open profile and security forms reviewed, including focus/eye-control layout. No profile save, upload or password change submitted.
- Replaced olive/cream controls with white/cool-neutral surfaces, consistent teal selection and white-on-orange primary actions. Default pair calculates 4.52:1; hovered create action measured white on rgb(172,69,7), 5.82:1. This is not an accessibility audit of all text/images/states.
- Navigation: sliding top marker, filled selected icon, no icon bubble/bounce, and no false home marker on Goe. Existing routes remain unchanged. The floating launcher retains its transparent mascot, without a white circle.
- Exact CSS viewport 375×667 for all current polish states; browser screenshot width can exclude 15px scrollbar. Chrome DevTools 125% scales its preview; no claim of reproducing browser chrome or physical iPhone behavior.
- Inspected home, destination focus, Explore focus, saved, profile open, security focus, trips/list menu/empty, timeline, settings/preferences, budget, expenses, summary, setup/options, standalone/floating Goe, login/register, recovery/invalid reset, welcome, place detail/add sheet, trash and offline. Local metrics and PNGs: .local/customer-ui-polish/. No document horizontal overflow in these recorded states.
- Offline CSS follows the palette. Static shell cache v5 activated; existing downloaded demo trip remains listed. Its local copy was refreshed through the existing UI. No user cache deletion or server DB write.
- Current portable samples: evidence/polish-*.png. Older evidence is preserved as historical. No browser error entries at final review-tab log check.
- Build/lint/changed-file format/diff checks passed after changes. Bundle-size warning remains. Device/real keyboard, full screen-reader audit, live SMTP/AI/sharing and persisted mutations remain outside this UI QA. No push/merge.
