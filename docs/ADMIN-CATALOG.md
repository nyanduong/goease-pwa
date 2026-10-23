# Admin catalog and automatic estimates — 2026-10-23

Owner requested milestone 1: manage places, restaurants and reference prices, connect them to customer estimates and test both roles. This is local implementation, not production acceptance or verification of real venue prices.

## Admin journey

Sign in with a provisioned admin account → automatically open **Quản trị** (`/admin`) → search/filter the paginated catalog → add or edit a place → save draft → preview → publish. Published entries can be archived (Ngừng hiển thị) and republished. The editor shows recent save/publication audit events. Admin uses a desktop workspace with a dedicated sidebar and logout. The brand returns to administration. Existing admin sessions, direct customer URLs and browser history navigation redirect to `/admin`; admin login overrides customer return intents. Admin has no travel UI. This is UI routing separation; server catalog permissions remain authoritative and this change does not introduce a new role or rewrite existing ownership policies.

The form manages the destination, name, category, place/restaurant/food-idea type, description, map search address, recommended duration, optional opening-hours note, source and one automatic reference price. Food ideas cannot have an automatic price until assigned a concrete restaurant. Destination is fixed after creation; create a separate entry for another destination. Changing the search address clears stale map coordinates. Map coordinate editing, uploads, structured hours, verified routing and a separate approval role are not implemented. Geoapify draft import is implemented as documented below. Existing artwork is retained; new entries use clearly labeled illustrative AI artwork.

Published edits affect new catalog reads/planning. Draft/archived entries are not publicly readable or available to the planner. Saving a published entry as draft removes it from public discovery. This UI explains the publication effect before the explicit publish action.

## Provision an administrator locally

Register a dedicated account through the ordinary UI, then from the repository root:

```powershell
npm run admin:access --workspace @goease/server -- grant admin@example.test
# To remove that role:
npm run admin:access --workspace @goease/server -- revoke admin@example.test
```

Replace the placeholder with an existing active account. This operator-only command refuses production, non-loopback targets, other ports/databases and anything except the existing `goease` database on localhost:27017/rs0. It changes only the selected account's roles/securityVersion and appends an audit event in one transaction; no shared Mongo service configuration changes. A privilege change requires signing in again. There is no default admin password, signup role parameter, public promotion endpoint or automatic role granted at startup. Deployment provisioning is still to be designed.

## Customer pricing

Admin explicitly chooses one reference amount (integer VND), label, per-person or whole-group basis, maximum applicable group size, conditions, HTTPS source URL, date checked and next review date. Zero means explicitly free; absent means unknown. Future checked dates and publication with an overdue reference price are rejected. The next review date is an editorial freshness cutoff, **not** a guarantee that a price will be available on a future travel date. The application does not fetch/verify the source URL on the admin's behalf.

AI output continues to contain only allowed places/times. The server attaches catalog price snapshots after validating AI output; Gemini does not invent prices or totals. Manually adding/swapping a published place also selects its active reference price. Server budget arithmetic multiplies per-person amounts once, leaves whole-group amounts unchanged and treats groups exceeding the price's maximum as missing cost. Missing accommodation/transport and activities with no price are explained in the budget UI. There is no automatic hotel, transport, child-price or promotion calculation, range estimate or booking quote in this milestone.

Each catalog estimate stores its source, conditions, checked/review dates, maximum group size and catalog revision. Existing saved trips retain these snapshots when catalog prices change or entries are archived. Changing traveler count recalculates totals using the saved basis and applicability. A customer can explicitly **Cập nhật giá tham khảo** from the stop editor or enter a personal estimate; manual input removes the catalog-provenance label. Refresh with no currently usable reference clears that estimate to unknown. No background rewrite of trips occurs.

The save API accepts a reference snapshot only if it matches the current published/fresh catalog price, the same activity/place in the owner's saved trip, or the same activity/place in their validated successful AI proposal. A fabricated or stale new reference is rejected with actionable 409; draft inputs remain. Idempotent trip replay, ownership, revisions and AI provenance remain enforced. Reference snapshots are included in read-only offline downloads; public shared trips continue to omit all costs.

## API, persistence and security

- `GET /api/v1/admin/places?q=&status=all|draft|published|archived&offset=0`: 20 items plus `hasMore`.
- `GET /api/v1/admin/places/:id`: editable DTO plus latest 20 audit event action/revision/time entries.
- `POST /api/v1/admin/places`: `{place}` and UUID `Idempotency-Key`.
- `PATCH /api/v1/admin/places/:id`: `{place,expectedRevision}` and UUID `Idempotency-Key`.

All admin APIs authenticate from the session, check an active server-side admin role and use no-store responses. Writes enforce the existing Origin/client-header guard. The service rechecks role inside its transaction. Ordinary accounts cannot access private catalog or promote themselves; admin catalog access grants no access to others' private trips.

`places`, `users`, `audit_logs`, `idempotency_keys`, `trips`, `trip_revisions` and `ai_runs` reuse existing collections. Additive optional fields preserve old records; no migration is required. Admin writes atomically commit catalog changes, audit and a 24-hour idempotency receipt. Only receipt-key races retry; unrelated DB failures propagate and roll back. `revision` is the concurrency version; Mongoose internal version keys are disabled for this catalog and its strict nested schemas so transaction rollback works. Old unused `__v` fields need no destructive cleanup. Historical catalog revision bodies/restore are not implemented; audit shows actor internally, action, target, revision and time, with no full form payload or private trip data.

Technical implementation: shared contracts in `packages/contracts/src/catalog.ts`; administration service in `server/src/features/explore/admin-catalog.ts`; snapshot validation in `server/src/features/trips/catalog-costs.ts`; admin UI in `client/src/components/admin-catalog.tsx`. See PRODUCT-VERIFICATION.md for observed checks and limits.

Geoapify import is now implemented for fixed Hội An searches and draft-only batch creation; see [GEOAPIFY-IMPORT.md](GEOAPIFY-IMPORT.md). Source metadata is preserved on ordinary admin edits and omitted from writable form input; only the server sets it. A separate approval role, scheduled refresh, uploads, structured hours and coordinate editing remain unimplemented.
