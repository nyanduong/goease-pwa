# Customer itinerary lifecycle — 2026-10-24

Scope: owner-requested direct Chrome customer UI on localhost:5180, actual local API/MongoDB and FULLDICHVU `fulldichvu/haiku-4.5`. Customer signed in themselves. Only one clearly named private test trip was created: `[TEST] Customer lifecycle 24-10`. No admin/catalog mutation or credential exposure.

## Observed flow

- Select Hội An, 2 days, 2 people; leave budget empty. Goe produced 5 catalog stops/day including lunch and dinner.
- Save with departure November 12 and test title. Reopen after reload: November 12–13 and 10 stops persisted.
- Change dates to November 11–12, review automatic replacements, save and reload. The Seeds has a Thursday closure in the current catalog; rescheduling selects another meal venue when needed.
- Ask Goe to replace day-one dinner at Cánh Buồm Trắng with JEERA while preserving the other four stops. Preview showed exactly that change; explicit confirmation saved it. Open from trip list: JEERA at 18:00 persisted, other day remained present.
- Cost UI: all 10 stops without verified prices remain unknown. It says there is insufficient data for the total, budget is optional, and absent lodging/transport are not included. No invented or zero-as-free prices.
- Additional closure case: change to November 25–26. UI reported `2026-11-26: Bảo tàng Gốm sứ Mậu dịch → Đình Hội An (đình Ông Voi)`; save succeeded. Final test-trip dates are November 25–26.

## Fixes from this run

- Native date input could display an entered value while React state still held an empty/old value in this browser automation path. Departure and date-edit fields now also synchronize on `input`; retested save and both date edits successfully. This observation alone does not establish the same failure in every manual browser input path.
- Date replacement treated all imported `restaurant` records as meals, including Coffee & Tea. It now requires the same food-serving name/description evidence used by initial scheduling, including when retaining an existing meal stop. Regression covers closed restaurant, unsuitable cafe, eligible alternative, unknown money, stable identity, and atomic failure without alternatives.
- Correct pace copy (new balanced plan: 5; selected-day adjustment accommodates existing stop count), provider-neutral Goe data disclosure, quota-specific recovery guidance, and price wording that does not require customers to fill unknown prices.
- Arrangement failures now have distinct sanitized codes for unknown selection, catalog/day coverage, and dinner availability. A prior live attempt failed with generic AI_INVALID_OUTPUT; raw output was not retained and its precise cause is not established. A subsequent create and selected-day adjustment both succeeded. This is not a reliability-rate claim.

## Verification and boundaries

- `npm test`: 39 passed.
- `npm run typecheck`, `npm run lint`, `npm run build`: passed. Build retains >500 KB main chunk warning.
- `npx tsx --test --test-concurrency=1 server/test/reschedule.integration.ts server/test/hoian.integration.ts`: 2 passed with documented MongoDB 8.2 `MONGOD_BINARY`, isolated harness on 27021. Initial invocation without that variable failed explicitly; rerun with binary passed. Existing application MongoDB was preserved.
- Local ignored server/.env user AI daily limit raised from default 5 to 10 to accommodate the authorized UI tests; global limit stays 20. No counter reset or paid subscription change. Repository default remains 5.
- Screenshot evidence is local/ignored: `.local/customer-lifecycle-cost.png` and `.local/customer-lifecycle-final.png`.
- This verifies the requested create/save/change-date/Goe-adjust path, not the entire customer MVP. Account recovery, sharing, offline, expenses, trash/restore and every device are not reverified here. Hours use existing narrow editorial parsing; unknown hours, exceptional closures, holidays and arbitrary future import formats are not verified availability. Seven-day live generation and sustained provider reliability remain unverified. No deployment performed.

24/10/2026 — Chi phí customer: đổi nhãn thành Chi phí dự kiến; ghi lại chi tiêu chỉ mở tùy chọn khi có loaded trip. TripWorkspace không còn SourceCredit. Không đổi dữ liệu/API/schema. Kiểm tra typecheck và ESLint các component; UI chuyến đã lưu xác nhận nút tùy chọn và không có mục bản quyền.

## Customer UX audit after strict catalog gate — 24/10/2026

This section supersedes the older data-availability and quota observations above. The historical two-day live run used an earlier, less restrictive catalog; it is not evidence that the current catalog supports two days. Local development limits are now user 100/global 1000 as authorized; no quota counters were reset in this audit.

Changes: consistent “Chi phí dự kiến” and optional recorded spending across sharing/offline/trash/manual planning/Goe; home emphasizes destination, duration and travelers rather than budget. Catalog failures no longer advise retrying identical inputs. Removed unconditional 1–7-day availability promise. Returning to the cost tab resets to estimates. Duplicate confirmation explicitly explains that copied stops are not revalidated for a different date.

Live Chrome findings and verification:

- Reproduced duplicate form displaying a new date but submitting the old date. Added input synchronization; retest created November 12 correctly, persisted after the dev page reloaded. This is an observed browser-input path, not a claim that all manual input methods failed.
- Created private test copies named `[TEST] Rà vòng đời customer` and its copy. Original customer trip preserved. Both test copies remain available; no permanent deletion or public sharing performed.
- On the November 12 copy, entered `[TEST] Nước uống`, 10,000 VND, November 12. Saved list showed exactly that date, total 10,000 and average 5,000/person for two travelers. Date field also synchronizes input/change.
- Returning to estimates showed 820,000/person and 1,640,000/group unchanged. Lodging, transport and personal spending remain explicitly excluded; recorded spending is not added into estimates. Screenshot: `.local/customer-audit-cost.png` (ignored).

Checks: `npm test` 42 passed. Focused integration run (account, expenses, password recovery, product, reschedule, trip management, sharing) 42 passed against isolated Mongo harness 27021 using `MONGOD_BINARY`. Typecheck, lint and production build passed; build still warns about the main bundle exceeding 500 KB.

Boundaries for the admin handoff: current eligible Hội An catalog has only two visits and two meal venues, suitable for a one-day small-group example, not all durations/group sizes/closure dates. Real shared-ticket data remains unverified; unit tests cover bundle arithmetic but do not validate a real Hội An ticket package. Live AI create/reschedule/chat results are documented in earlier runs; they were not all repeated in this audit. Sharing, recovery, ownership and trash lifecycle were checked by integration tests, not live public sharing or real password changes. Offline wording was reviewed; actual disconnected-device behavior and all-device usability remain unverified. This is a scoped audit, not an unconditional customer MVP acceptance.
