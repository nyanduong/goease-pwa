# Gemini planner — local customer MVP (2026-10-23)

## Implemented scope

- Customer setup and saved-trip settings include **Tạo đề xuất bằng Gemini**. The existing catalog/manual path remains available. Goe chat (`/goe`) now supports selected-day adjustment; see the Goe section below.
- `POST /api/v1/trips/ai-proposal` requires an authenticated session, matching Origin, `X-GoEase-Client: web`, UUID `Idempotency-Key`, and `{trip, tripId?, expectedRevision?, consent:true}`. Trip ID and revision must be supplied together. Owner comes from the session. Only Hội An (`000000000000000000000004`), 1–7 days is enabled for this planner iteration; manual trips retain 31-day support.
- Gemini receives dates, group count, budget/preferences and at most 30 published catalog places (ID, name, category, duration, location query). No account identity, title, private notes, session, or existing free-text activities are sent. Free-tier provider data use is governed by Google's terms; this is not a promise of zero provider retention or training. Customer UI discloses Google transmission before its explicit generate button.
- The server accepts only structured dates/place IDs/times, validates exact dates, catalog membership, duration, increasing non-overlapping times, 30-minute buffers, 07:00–22:00, and daily pace caps (2/3/6). These are planner heuristics, not verified routes/opening hours. Titles/kinds come from catalog, UUIDs from the server. Costs remain null until the customer selects a catalog price or enters one; Gemini cannot provide prices or totals.
- A validated proposal returns `{runId, trip, budget, warnings}`. No trip is changed by generation. Client rejects applying a proposal after its input changes. The explicit apply button replaces the local draft; normal Save commits through the existing transaction/revision/idempotency/audit path. Applying a new proposal to a saved trip checks the generation's base revision again at save. Archived/new-place checks still apply.
- `generationMode` and activity `source` support manual/ai. `aiRunId` is optional for old/manual records and mandatory in server validation for AI provenance. Save resolves the successful run under the authenticated owner; AI activity ID/place pairs must be from that proposal. Existing AI trips can be manually edited and retain their origin. No migration of old trips required.

## Configuration and failure behavior

`server/.env`: `GEMINI_API_KEY`, `GEMINI_MODEL` (default `gemini-3.5-flash-lite`), `AI_DAILY_USER_LIMIT` (5), `AI_DAILY_GLOBAL_LIMIT` (20). These are configurable local development guardrails, not approved paid-plan entitlements or Google billing caps. Keys never enter client bundles, logs, URLs, or Git. Leave key blank to return a truthful 503 and keep manual planning.

REST adapter uses fixed Google HTTPS origin and key header, 45-second timeout, bounded 256KB response, JSON schema and server validation. No automatic retries or silent manual fallback. Client waits up to 60 seconds and can retrieve the same run using the same key. A new generation uses a new key and potentially another quota unit.

Quota reservation and run insertion are one MongoDB transaction. Daily UTC global/user counters are incremented conditionally below limits. Success and invalid generated output consume a unit; explicit provider 4xx rejection releases it; transport/5xx ambiguity remains counted. Pending runs older than 90 seconds become `unknown/uncertain` at startup or the next proposal request, without calling the provider again. Daily windows permit future usage; exact provider billing reconciliation and a background cleanup job remain planned. Run metadata is retained locally with no TTL until a retention policy is approved.

## Runtime storage (authoritative implemented subset)

`ai_runs`: `_id`, schemaVersion=1, timestamps, provider=gemini, runId UUID, userId ObjectId, key UUID, requestHash, requestId, optional tripId string and expectedRevision, model, promptVersion=hoian-v1, plannerVersion=1, inputSummary {destinationId,days,travelers,pace}, sources (<=30 IDs), status pending/succeeded/failed/unknown, quotaState reserved/consumed/released/uncertain, sanitized errorCode, finishedAt, bounded validated proposal. Proposal uses a validated Mixed field for the shared DTO (max200KB, <=7 generated days, <=6 generated stops/day, <=5 warnings); no raw provider response or reasoning stored. Indexes: unique runId; unique userId/key; status/createdAt. No public run-list endpoint.

`usage_buckets`: `_id`, schemaVersion=1, timestamps, scope (`global` or authenticated user hex ID), date (`YYYY-MM-DD` UTC), count (reserved + consumed + uncertain). Unique scope/date. Per-run quotaState explains the counted units. Token usage, provider cost, paid entitlements, baseline generic feature buckets and analytics are not implemented.

Trip/revision snapshots add optional aiRunId and ai/manual enums. Contract: `packages/contracts/src/planner.ts`; runtime: `server/src/features/ai/`; UI: `client/src/components/ai-planner.tsx`.

## Evidence and remaining verification

AI Studio account `nhandt.ce190741@gmail.com` showed a default project/key on the free tier. Key stored in ignored server environment; authenticated Google model-list request returned HTTP200 and included the configured model. No billing activation performed. This does **not** establish successful generateContent or itinerary persistence. Automated planner tests and live generation/save checks have not been run in this task.

Manual acceptance: sign in → create Hội An trip → choose dates/people/preferences → Tạo đề xuất bằng Gemini → inspect proposal → apply → edit/choose costs → save → reload. Also check provider quota failure preserves input, same-key result recovery, another-account provenance rejection, invalid place/time rejection, and stale saved-trip revision.

References: [Google structured output](https://ai.google.dev/gemini-api/docs/generate-content/structured-output), [models](https://ai.google.dev/gemini-api/docs/models), [API pricing/data-use tiers](https://ai.google.dev/gemini-api/docs/pricing). Model availability also observed through this key's models endpoint; docs alone do not establish account quota.

## Live acceptance — 2026-10-23

Owner explicitly requested live Gemini generation and save verification. `LIVE_GEMINI=1` enabled the opt-in browser test in `tests/foundation.spec.mts`; the server loaded its ignored Gemini key. The browser/API/MongoDB harness used ports5191/3011/27020 and a dedicated test account/database, preserving the application's27019 data.

Observed success: real Gemini generated Hội An3days; preview did not create a trip; explicit apply populated the draft; Save returned201; browser reload and API read retained exact days/activity IDs, aiRunId and generationMode=ai. Missing prices remained unknown. Same-key recovery returned the same run. Subsequent manual title edit succeeded; stale revision returned409; fabricated AI activity UUID returned400; another account received404 reading the trip and409 attempting to use its proposal. A browser-injected429 displayed the quota error without replacing the saved schedule (this failure case was simulated, not a real Google quota exhaustion).

Verification:14 unit/HTTP tests passed (including malformed/blocked provider output,429/503 sanitization and catalog/date/time validation),20 integration checks passed,13 default browser tests passed (live test skipped by default), and the explicit live browser test passed. Build/typecheck/lint passed. An intermediate live run timed out waiting for the browser response while a concurrent typecheck rebuilt watched contracts; its DB run had succeeded. Rerunning with no concurrent build passed. Run build/typecheck before browser acceptance to avoid Vite reload interference. Live checks consumed a few real provider calls; routine CI must not enable LIVE_GEMINI.

Screenshots: `.local/ai-preview/live-proposal.png` and `live-saved-reloaded.png`. No application defect reproduced in the completed acceptance cases; test payload helper was updated to preserve aiRunId for AI-trip edits. Goe chat, long itineraries beyond this scope and mobile hardware remain outside this test.

PowerShell reproduction (after npm run build, with server/.env configured):

```powershell
$env:MONGOD_BINARY='C:/Program Files/MongoDB/Server/8.2/bin/mongod.exe'
$env:E2E_API_PORT='3011'
$env:E2E_WEB_PORT='5191'
$env:LIVE_GEMINI='1'
npx playwright test tests/foundation.spec.mts -g 'live Gemini proposal'
```

## Goe adjustment customer flow — 2026-10-23

Goe chat now reads a saved owned trip and selected day. With no trip, the customer chooses a saved trip; guests sign in. Each bounded message (1–500 characters) is a fresh adjustment request, with no hidden cross-message model memory. Visible conversation is session/component memory only, max20 lines, not persisted. The server sends the message, allowed catalog, numeric preferences/budget and selected-day place IDs/times; no private notes, customer identity or custom activity titles. UI explains Google transmission before Send.

- `POST /trips/:id/goe-proposal`: `{dayId,message,expectedRevision,consent:true}`, session/Origin/client header and UUID idempotency key required. Server reads owned persisted trip; rejects a stale base revision. Reuses Gemini, catalog validation, bounded output, daily quota reservation and safe failures. Only selected day is generated. Other days are copied exactly. Retained matching place IDs keep activity UUID/title/price/notes; new places get unknown price. Non-catalog/custom activities are locked and retained; overlap with them rejects the proposal. No weather/price API or guaranteed savings.
- Returns a `GoeProposal`: normal validated trip/budget/warnings plus `before`, `dayId`, `baseRevision`. No trip mutation occurs here. Preview shows before/after and known cost/unknown count; Keep old schedule writes nothing.
- `POST /trips/:id/goe-apply`: `{runId,expectedRevision}` plus independent UUID idempotency key. Requires owned successful run with `promptVersion=goe-v1`, same target trip and base revision; calls existing transactional save with expectedRevision. Browser cannot send a replacement schedule to this endpoint. Lost-response retry uses the same key and does not create another revision. Conflict/error retains proposal and offers reload; successful apply refreshes trip context and budget.

Storage: same ai_runs/usage_buckets/trips/trip_revisions, no new collection. Goe runs use promptVersion goe-v1; proposal carries before/dayId/baseRevision inside the existing bounded, validated field. Raw message is not stored, only payload hash. Collection retention remains as previously documented. Shared contract schemas are in planner.ts; route names added to log allowlist.

Live acceptance passed using real Gemini: generate/save3day trip → Goe on day1 → slower-day proposal (3→2stops in observed result) → preview with other days unchanged → simulate dropped response after commit → retry → exactly one saved revision → reload retained proposal contents and new aiRunId. Stale reapply returned409. Screenshots: `.local/ai-preview/goe-real-proposal.png`, `goe-saved-reloaded.png`. The default preview-only chat test was replaced with no-trip gating/responsiveness; generic manual journey no longer applies fake chat changes.

## Mobile correction — 2026-10-23

Current requests use hoian-v2/goe-v2 promptVersion; existing successful goe-v1 applies remain accepted with the same owner/trip/revision checks. Prompt supplies numeric maxStopsPerDay and instructs substitution rather than exceeding the existing cap when adding a stop; expressly retained stops are prioritized. No additional model call or quota change. Validation emits AI_PACE_LIMIT or AI_SCHEDULE_CONFLICT for actionable failures, keeps IDs/date/duration checks, and never silently applies a fallback.

Same-key lookup now distinguishes AI_RUN_PENDING from AI_RUN_FAILED. The client retains API error codes and offers result retrieval only for pending/uncertain/network outcomes. Terminal failures preserve the user's input and offer concrete wording guidance plus a route back to edit the day. UI labels use Goe. Per owner direction on 2026-10-23, quick setup no longer shows the provider/data disclosure block or the redundant empty-destination hint; manual selection appears after choosing a destination. The existing detailed planner disclosure remains. Generation still requires an explicit button click; no automatic provider call is added. Unknown prices are never presented as savings.

## Plan-first mobile creation — 2026-10-23

New setup calls the same proposal API once from “Lên lịch giúp mình” and immediately displays the returned trip as an unsaved preview. No separate apply screen for a new empty draft; existing saved-trip regeneration still previews and confirms replacement. Inputs/back/manual action are disabled while generation is pending, avoiding accidental input changes and duplicate clicks. Network recovery keeps the original key; terminal failures offer new request/manual path. Temporary date anchors satisfy the unchanged PlannerRequest until the user explicitly selects departure at Save. Departure selection now runs the catalog date recheck described below. Saving uses the existing stable-ID shift and server provenance/revision transaction. Quick swap/removal are local manual edits with undo, not extra Gemini calls. Only duration-compatible catalog alternatives not already in the trip fit a timed swap; other days and prices of retained stops remain unchanged. No provider prompt/quota/API/storage changes in this iteration.

## Catalog reference pricing — 2026-10-23

Supersedes the original statement that every generated cost remains null. After validating place IDs/times, `validatePlan` calls shared snapshot selection on the published catalog records already loaded by the server. An admin-approved fresh `referencePrice` becomes catalog_reference with amount/basis and full provenance; otherwise cost stays unknown. Gemini still supplies no prices. `calculateBudget` handles per-person multiplication and maximum applicable group size. Catalog costs are validated again when saved, accepting the same activity/place snapshot from the successful owner proposal; new archived place links remain rejected. [Admin workflow and limitations](ADMIN-CATALOG.md).

## Hội An complete-day planning — 2026-10-23

Current new runs use hoian-v3, plannerVersion=2; selected-day edits keep goe-v2 and existing 2/3/6 caps. New-trip caps are 4/5/6; null budget remains accepted and is never replaced with an invented amount. The prompt receives descriptions, venue types, opening-hours notes, existing coordinates and server-derived reference costs in addition to IDs/durations/addresses. No account identity or private notes are added. `itinerary-policy.ts` owns eligibility, caps, bounded hours checks and the provider catalog projection.

With at least four visits and two concrete restaurants in the available catalog, validation rejects incomplete days lacking two visits and lunch/dinner windows, as well as repeated visits across days. Food ideas, explicit test labels and temporarily closed notes are excluded. Sparse catalogs retain the prior basic validation, without manufacturing missing venues. Geographic clustering, meal-versus-coffee selection and longer transfer buffers are prompt guidance, not verified route or restaurant suitability guarantees. All stops retain exact catalog titles and address/hours notes. Monetary calculation still uses catalogCost/calculateBudget; unknown stays null.

Executable hours are limited to the existing editorial HH:mm–HH:mm range (unless marked unverified/inconsistent) and the exact monthly two-day closure format. The date-change update below adds explicit weekly closure phrases and split/overnight ranges. Arbitrary prose, date-specific public holidays, live availability and future imports still need structured normalization. Provider failures do not become a fallback success; no automatic additional provider calls. Existing saved trips are unchanged.

The final pipeline is AI candidate ranking → deterministic server day arrangement → strict validation. For sufficient catalog, arrangement fills lunch/dinner and visits from eligible catalog if the proposed times/coverage are unusable, shifts times in 15-minute steps, respects stored durations/recognized hours and reserves visits for remaining days. Unknown IDs/dates or provider failures still fail; this does not label a provider failure as AI success. Restaurant eligibility for automatic meal filling currently uses the public restaurant venue type plus explicit restaurant/nhà hàng/món chay/foods wording; a dedicated structured meal-suitability field remains planned. Extra visits must be in the AI's ranked selection. Trip-wide unique visits and time checks still run after arrangement. Selected-day edits allow at least the existing selected day's stop count (capped at 6), avoiding forced deletion merely because the new itinerary has more stops than the old 2/3/6 defaults.

Verification observed in this task: 6 planner tests, 10 catalog/Hội An integration checks on isolated MongoDB, typecheck and lint. The full unit suite passed 29 checks before the added arrangement test. Live catalog simulation for 1/2/3/7 days passed with null budget and unknown costs (simulation of the AI ranking, no provider call). First two live model trials were correctly rejected for incomplete/scheduling output; after server arrangement, a real Gemini request produced a 2-day/2-person preview with 5 and 4 stops, specific meals and distinct visits. No user trip was saved by this verification. Dates are provisional until the customer chooses them; changing dates now reruns the catalog check described below. Route optimization, live opening updates and weather remain unverified.

## Automatic date rescheduling — 2026-10-23

`POST /trips/reschedule-dates` accepts strict RescheduleRequest (original TripInput, target startDate/endDate; tripId and expectedRevision paired for saved trips). Authenticated owner/revision and AI run provenance are checked on the server. Client uses it both for date editing and departure selection before first save. Busy fields are disabled; errors and stale responses keep the old draft. A successful response updates the draft; normal Save persists it with the existing revision check.

The deterministic scheduler keeps current places when possible, shifts within known hours, or substitutes eligible published visits/restaurants without duplicating visits already in the trip. It respects catalog durations, lunch/dinner windows, 30-minute gaps and fixed timed personal appointments. Activity/day IDs remain stable (including expense links); expenses themselves do not move dates. Private notes and costs of retained places are preserved. Replacements use catalogCost, never invented prices. Default address/hours notes update on replacement; private notes remain verbatim. If a complete repair is unavailable, no partial trip is returned. Existing shortening protection remains; added blank days are not automatically populated by this endpoint.

Hours parser recognizes HH:mm–HH:mm ranges, split shifts, overnight ranges, the existing two-day monthly closure format, and explicit Vietnamese weekly closure phrases (nghỉ/đóng cửa thứ ...). Unverified/inconsistent time ranges are not treated as confirmed; explicit closure days still exclude a venue. Unknown hours do not establish that a place is open. This is not a general natural-language hours interpreter or live availability check; structured date/holiday exceptions and optimized routing remain unimplemented. Candidate pool currently uses up to 30 published places.

Successful AI-trip rescheduling writes a new owned ai_runs proposal with provider=catalog, promptVersion=date-reschedule-v1, plannerVersion=3, status=succeeded, quotaState=released; no Gemini call or usage bucket is made. This preserves server-verifiable provenance when saving substituted activity/place links. Manual trips do not create an AI run. Existing proposals are not overwritten. The endpoint does not itself save or publish a trip.

Verification: 33 unit tests passed, including replacement on monthly closure, moving later within hours, fixed appointment conflicts, unchanged input on failure, weekly/split/overnight hours and null price preservation. Isolated MongoDB API integration passed owner denial, stale revision denial, AI proposal save and subsequent rescheduled PATCH, no usage bucket and no saved-trip mutation on failure. Browser customer flow not exercised in this turn because the shared browser session currently redirects to the admin screen.
