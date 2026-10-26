# Customer navigation

Keep existing history API router and all URLs/deep links; no router migration.

- Main mobile destinations: Trang chủ `/`, Khám phá `/explore`, Chuyến đi `/trips`,
  Đã lưu `/saved`, Tài khoản `/account`. Home-first reading order, same 5 features.
- Goe remains accessible through the existing floating mascot and `/goe`; its
  trip/day context and proposal guards are unchanged. Avoid a second nav bar.
- A focused trip/editor/detail uses its back button and context actions; bottom
  save actions own that bottom space. Main destination nav stays on list/account/
  explore pages. Selected nav has filled icon, label emphasis and a background.
- Guest route restrictions, admin redirect, after-login continuation and browser
  back/popstate remain owned by App.tsx. No auth bypass or changed destination.
- Account exposes logout using the existing cleanup/session handler. Desktop
  header can retain it; mobile header is brand + account access.
- Sheets retain native modal semantics and keyboard escape/focus return. Dirty
  drafts and destructive confirmations continue through confirmAction.
- Tabs retain state while their owning screen stays mounted. Do not introduce
  hidden data caching or alter revision checks to preserve a UI selection.
- The composer and navigation respect keyboard/safe-area. Narrow chip groups may
  scroll internally; document-level horizontal scroll is a defect.

Map of the planning flow: Home/Explore → existing destination selection → Quick
setup (destination/duration/people; optional preferences/budget) → AI/manual preview
→ keep trip (departure date + optional name/notes) → saved detail/day timeline.
All current required fields and allowed values remain unchanged.

## 26/10/2026 — structural mobile revision after feedback

Current trip-list overflow contains management actions. A trip keeps Lịch trình / Bản đồ / Chi phí / Tổng kết navigation, including the cost view. Cost switches Dự kiến / Đã chi without adding a route. Per-point overflow preserves original callbacks; row click still edits. Account forms and optional descriptions use disclosures. No backend route or business action was added.
