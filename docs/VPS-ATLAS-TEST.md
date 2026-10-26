# GoEase test deployment — VPS + Atlas

Verified on **26/10/2026**. Hosted application: [app.goease.com.vn](https://app.goease.com.vn/).
The landing page at `goease.com.vn` retains its GitHub Pages DNS records. A future
landing-page install button can link to the application; it cannot trigger another
origin's browser installation prompt directly. No landing-page source was changed.

## Deployed topology

Browser → HTTPS Nginx → static `client/dist` or `/api/*` → one Express/Node process
on `127.0.0.1:3000` → Atlas project **GoEase Test**, Free cluster **goease-test**,
database **goease_test**. Public images remain on the existing Cloudinary CDN.

The VPS has one vCPU and approximately 961 MiB usable RAM. It already runs
**Nyan Movie**, Redis and Nginx; those services were retained and verified active.
The machine reports a 14-GB root filesystem with about 9.3 GB available at initial
inspection, despite the hosting package advertising 20 GB. Swap was already 4 GB;
this task did not change it.

An isolated, SHA-256-checked **Node 24.15.0** runtime is under
`/opt/goease/runtime/node`; npm **11.12.1** is under `/opt/goease/tools`.
The existing system Node/npm were preserved. The active release symlink is
`/opt/goease/current` → `/opt/goease/releases/20261026-pwa`.
The prior `/opt/goease/releases/20261026-test` remains available for rollback.

- API service: `/etc/systemd/system/goease-api.service`, unprivileged `goease` user.
- Private environment: `/etc/goease/server.env`, root-owned, mode `0600`.
- Vhost: `/etc/nginx/sites-available/goease-app`, enabled through `sites-enabled`.
- Certificate: `/etc/letsencrypt/live/goease-app/`; observed expiry **24/01/2027**.
- Certbot timer is enabled. A scoped deploy hook validates/reloads Nginx when this
  certificate renews. Actual future renewal has not been observed.
- Tenten DNS: only added `app A 180.93.61.244`; original apex/www records retained.
- Atlas user: `goease_app`, SCRAM, `readWrite @ goease_test`, restricted to this
  cluster. Its access list contains only VPS IP `180.93.61.244/32`.

## Runtime and PWA changes

API config accepts both standard and SRV MongoDB URIs. `db:check`, seed and
integration scripts retain their local-only guards; do not point them at Atlas.
`TRUST_PROXY_LOOPBACK` defaults false; the hosted environment enables it while
binding the API to loopback. The Nginx vhost overwrites forwarded IP/host/protocol
headers. Authentication uses Express's resolved client IP rather than combining
all reverse-proxy traffic into one network rate-limit bucket.

`BACKGROUND_WORKERS_ENABLED` defaults true for existing installations. The host
sets it false: schedule, source-image, description, visit-info and enrichment
workers do not start. Product initialization/indexes/province synchronization
still run. This is the explicit request-load baseline. Worker-enabled workloads
have not been measured. Worker concurrency examples remain one per source when
explicitly enabled. Node's 256-MiB heap budget does not cap total native/process RAM.

The client now has a manifest with stable `/` identity, standalone display, root
scope and 192/512 PNG icons derived from existing Cloudinary brand artwork; an
Apple touch icon is also linked. Production automatically registers the existing
service worker. It caches the public offline reader, not API responses, private
HTML, photos or maps. Offline trips still require an explicit download; the full
editor/planner does not become an offline application.

A regular persistent Edge session reported **zero manifest and installability
errors**, a secure context, active service-worker control, and both PNG icons HTTP
200 with their declared dimensions. An incognito test initially returned only
`in-incognito`; the regular-session check resolved that test-environment issue.
No OS-level installation or physical-phone test was performed.

## Approved data import

The owner narrowed the import to **13 published destinations + 43 published
places**. Exported and imported with stable IDs and original metadata:

| Collection       | Documents | Verification before API initialization             |
| ---------------- | --------: | -------------------------------------------------- |
| destinations     |        13 | canonical full-document hash matched               |
| places           |        43 | canonical full-document hash matched               |
| catalog_versions |       176 | canonical full-document hash matched               |
| audit_logs       |       168 | catalog actions for those entity IDs; hash matched |

Only these collections/selectors were exported. Users, identities, sessions,
private trips, expenses, favorites, AI runs, quotas and unrelated operational jobs
were not copied. Source MongoDB `localhost:27017/goease` was read only; its service
and other databases were preserved. The test import refused unrelated target
collections or differing existing documents, inserted only missing IDs, then
verified every copied document's canonical content. No overwrite/drop operation
was used. This is an initial test copy, not continuous synchronization or a
point-in-time cutover of the live local database.

API startup subsequently synchronized all **34** province foundations; the
additional provinces remain draft. Hosted public APIs still expose exactly **13**
destinations and **43** places, including **11** places in Da Nang. Original local
DB totals were about 379.27 MiB documents + 42.26 MiB indexes with 26,567 place
rows; that full dataset was not imported. Hosted `dbStats` with MiB scaling returned
rounded values of 1 MiB documents + 1 MiB indexes after smoke checks.

## Observed validation

- `npm test`: **123/123 pass** after server/proxy/worker config changes.
- `npm run lint`, `npm run typecheck`, full build passed; subsequent client build
  including PWA changes also passed. Existing >500-KB bundle warning remains.
- Linux `npm ci --omit=dev` passed; real Sharp WebP conversion and Argon2 hashing
  loaded native Linux dependencies successfully.
- Systemd unit verification, Nginx config test, valid hosted TLS, database health
  and published catalog endpoints passed. A first immediate check raced the Nginx
  reload and saw the previous certificate; the subsequent hostname/SAN/HTTPS checks
  passed without disabling certificate verification.
- Hosted synthetic-account registration, Secure-cookie session, login/logout,
  trip save/read, same-key idempotency, another account's 404 and invalid-input 400
  passed against real Atlas. A later API restart retained the trip and allowed
  re-login/read. This observes committed transactions, not injected rollback,
  Atlas outage or failover behavior.
- Test-harness fixes left **6 clearly named synthetic accounts and 3 private test
  trips** in the test database. They use `example.invalid` addresses; sessions
  were logged out. No personal user data was used or copied.
- Edge mobile viewport **375×812**: no page errors, scroll width 375; cold welcome
  FCP was about **1.55 s** in the recorded regular session. This is an unthrottled
  desktop-browser observation, not a Lighthouse score or phone performance claim.

## Read-only load observation

Load was generated from the owner's Windows machine over public HTTPS. Each
virtual user alternated the published destination list and Da Nang place list,
waited 500 ms between requests, and ran for about 12 seconds per stage. No provider
calls, authentication writes or AI requests were part of this load run.

| Virtual users | Requests | Errors | Requests/s |    p50 |    p95 |
| ------------: | -------: | -----: | ---------: | -----: | -----: |
|             1 |       18 |      0 |       1.44 | 193 ms | 343 ms |
|             5 |       95 |      0 |       7.63 | 130 ms | 283 ms |
|            10 |      195 |      0 |      15.55 | 127 ms | 267 ms |
|            20 |      380 |      0 |      30.11 | 134 ms | 300 ms |

There were **688 requests, all HTTP 200**. Sampled API RSS peaked at about
**170.1 MiB**, cgroup memory at **118.7 MiB**, CPU at about **47.4%** of one core in
a five-second sample, average **19.2%** over monitoring. Minimum reported system
available memory was about **337.9 MiB**. Other apps remained running. These are
short observations on a small published catalog, not a maximum-user capacity or
sustained/worker/AI/upload/authentication-load result. Atlas Free also has its own
throughput limits; upgrading only the VPS does not remove those limits.

Ignored evidence: `.local/goease-deploy/evidence/` contains API/browser/restart
JSON, readonly load results, resource samples and a mobile screenshot. Release
archives and private connection inputs are also ignored. Real passwords are not
in source, committed examples or command output. No git commit/push was performed.

## Operation and next deployment

Use the manifests/one lockfile and build on the development machine. Set
`VITE_API_BASE_URL` empty for same-origin builds. Stop local Windows dev before
`npm ci` to avoid locked native files. Transfer build output and manifests, then
install Linux runtime dependencies; do not copy Windows `node_modules` or local
`.env` files. Keep environment secrets outside the release and reuse the pinned
runtime. Validate `deploy/goease.nginx.conf` with the actual certificate path
before enabling a new vhost. `deploy/.env.example` has safe placeholders.

Useful host checks:

```sh
systemctl status goease-api nginx
journalctl -u goease-api --since '10 minutes ago'
nginx -t
curl --fail https://app.goease.com.vn/api/v1/health/db
```

Rollback switches `current` to a previous compatible release and restarts the API;
it does not undo database changes. Preserve artifacts and check schema compatibility.
No automatic cleanup, purge, database drop or paid infrastructure upgrade is configured.

After the read-only baseline, the owner explicitly authorized reusing local
AI/SMTP/Cloudinary configuration on this VPS. Only those allowlisted fields were
transferred through the encrypted SSH connection into the root-only environment;
the Atlas URI, production origin and disabled-worker setting were retained. Config
validation confirmed **Fulldichvu configured, SMTP configured, registration OTP
required, Cloudinary upload configured, workers disabled**. No AI request, email or
upload was sent to test these credentials; provider/network success remains
unverified on the VPS. Google OAuth and Geoapify credentials were not transferred.
The initial deployment used separate accounts. In a later explicit owner request,
two selected local password accounts were copied to the hosted database, with
their original IDs, profiles, verification state, active status and existing
roles (one traveler, one traveler/admin). After the supplied password was found
not to match either source hash, the owner chose to preserve the actual local
passwords. No password reset was performed.

That scoped account copy committed two users, two active password identities and
four related historical auth/admin audit records in one Atlas transaction. Email,
identity-ID and content collision checks ran before insertion. Full canonical
content comparison passed after commit; zero source sessions were exported and
zero hosted sessions existed for those accounts immediately after import. Local
data was read only. Trips, expenses, favorites and other identities were not
copied. Application/database health remained HTTP 200. Password login was not
tested because the actual source passwords were not provided. The temporary
credential-hash export was removed after verification; the private operator
receipt remains under `/opt/goease/private/account-import-receipt.json`. Emails,
passwords and hashes are intentionally omitted from this repository document.

References: [Express proxy trust](https://expressjs.com/en/guide/behind-proxies/),
[Atlas Free limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/),
[installable PWAs](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).
