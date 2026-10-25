# Compact destination selection — 26/10/2026

Branch: `V1-ui-admin`. Frontend presentation only; no backend, database or
destination publication changes.

- Home renders at most four matching destination cards. Its existing search and
  region/category filters still operate over the entire available catalog before
  slicing. “Xem tất cả tỉnh/thành” opens a bounded searchable list.
- Quick trip setup shows one destination field instead of the full card grid.
  Its shared picker supports accent-insensitive search and existing region
  filters. Selection uses the previous `withDays` update and keeps the other
  draft fields; closing the picker preserves the selection.
- The shared native dialog keeps header/search/filters above a separately
  scrollable results area, locks background scrolling, handles Escape and
  restores focus through the existing Sheet lifecycle. No extra dependencies.

## Observed checks

- Client ESLint, TypeScript/production build and `git diff --check` passed.
  Existing Vite large-chunk advisory remains.
- Live app checked at 375 × 667 CSS pixels, matching the supplied iPhone SE
  viewport. Selected Cần Thơ through the new field; no horizontal overflow.
- The local app had three enabled destinations. A separate ignored UI fixture
  rendered the actual components with all 34 names from the existing province
  catalog; it did not change enabled provinces, write to the database or call AI.
- With 34 fixtures: Home has four cards; searching `ca mau` still finds Cà Mau
  outside those four. No page-level horizontal overflow.
- At 375 × 667: dialog height 640px, top 13.5px, bottom 653.5px. All 34 rows are
  available inside a 378px results viewport with 1869px scrollable content.
- `da nang` finds Đà Nẵng; empty search results show a reset action. Miền Nam →
  Miền Tây returns five catalog provinces. Escape keeps Đà Nẵng selected and
  returns focus to its field. No itinerary was generated or saved.
- Existing foundation browser selectors were updated for the picker interaction;
  the full backend-dependent foundation suite was not rerun for this UI change.

Local fixture and screenshots: `.local/destination-ui-qa/` (ignored by Git).
