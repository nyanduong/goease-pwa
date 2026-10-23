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

Same-key lookup now distinguishes AI_RUN_PENDING from AI_RUN_FAILED. The client retains API error codes and offers result retrieval only for pending/uncertain/network outcomes. Terminal failures preserve the user's input and offer concrete wording guidance plus a route back to edit the day. UI labels use Goe while the Google/Gemini data disclosure remains visible. Unknown prices are never presented as savings.
