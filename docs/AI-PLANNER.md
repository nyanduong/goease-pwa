# Gemini planner — local customer MVP (2026-10-23)

## Implemented scope

- Customer setup and saved-trip settings include **Tạo đề xuất bằng Gemini**. The existing catalog/manual path remains available. Goe chat (`/goe`) remains a labeled demonstration; this task implements itinerary generation, not chat.
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
