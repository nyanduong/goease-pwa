# Tailwind styling — 26/10/2026

The React application uses the installed Tailwind 4 Vite plugin for its actual
layout, spacing, sizing, typography and component states. The migration replaces
over 9,000 CSS declarations with Tailwind utilities; it does not redesign screens
or change application logic, API contracts, business rules or persistence.

## Authoring

- Put independent element styling in literal utility classes in JSX. Shared UI
  examples are `App` and `components/ui.tsx`. Goe sizes use a map of complete
  class strings so Tailwind can discover every size.
- Existing composed screens retain their semantic selectors, media queries,
  specificity and stylesheet import order. Their styles now compose utilities
  with `@apply`, for example `@apply flex items-center gap-[12px]`. This preserves
  the existing customer/admin cascade, including hover, focus, disabled, mobile
  and reduced-motion states. Do not move these rules into a different cascade
  layer without checking the affected screens and Leaflet controls.
- The `@theme inline` aliases in `client/src/styles.css` expose the existing
  runtime palette as utilities such as `text-goease-ink` and
  `border-goease-line`. The `goease` prefix avoids changing legacy fallbacks
  such as `var(--color-ink, #123e38)`. Inline aliases retain scoped palette
  overrides instead of capturing the root value.
- Separately imported component stylesheets use `@reference './styles.css'`
  to access the same Tailwind theme without emitting the framework again.
- Exact pixel/arbitrary values preserve existing geometry and typography.
  Replacing them with a nearby default Tailwind size can change the interface.
- CSS remains appropriate for font loading, runtime custom properties,
  background/border shorthands whose reset behavior matters, gradients,
  shadows, masks, keyframes and vendor integration. Live values such as chart
  percentages, avatar cropping and dragged Goe coordinates remain inline.
- `client/public/offline.css` intentionally remains plain CSS: the service
  worker caches it at a fixed URL for the independent, dependency-free offline
  reader. Leaflet's supplied stylesheet also remains vendor CSS.

New JSX utilities live in Tailwind's utilities layer; existing screen rules
remain unlayered to preserve their previous cascade. When changing a property
already owned by a semantic component selector, edit that selector's `@apply`
instead of appending a utility that would lose to it.

Tailwind supports this composition through its official
[`@apply`, `@reference` and `@theme` directives](https://tailwindcss.com/docs/functions-and-directives).

## Verification observed

- `npm run typecheck`, `npm run lint` and `npm run build` passed. The existing
  Vite warning about a JavaScript chunk larger than 500 kB remains. Emitted CSS
  increases from about 343 kB to 382 kB (gzip about 68 kB to 71 kB), chiefly due
  to Tailwind utility bookkeeping; this migration does not claim a bundle-size
  improvement.
- All 13 changed source files pass Prettier, and `git diff --check` passes.
  Repository-wide `npm run format:check` still reports existing formatting in
  seven untouched files: `package.json`, `ADMIN-EDITOR.md`,
  `DEMO-CATALOG-2026-10-26.md`, `MANUAL-CURATION-2026-10-26.md`,
  `NATIONWIDE-DATA-PREPARATION-2026-10-26.md`, `ONE-COVER-MEDIA.md` and
  `WIKIPEDIA-DESCRIPTIONS.md`.
- A temporary migration check compiled the Tailwind styles and compared 3,627
  retained selector rules in Edge. There were no computed-style differences
  for the isolated rules. Rules intentionally moved to JSX were covered by
  the page checks instead. This is not a permanent new test command.
- Before/after captures covered 34 page/viewport combinations at 390 and
  1440 pixels: welcome, login, registration, explore, trips, budget, Goe,
  account, admin overview, places, new-place editor, review queue, sources,
  settings, schedules, history and enrichment progress. GET responses were
  frozen test fixtures. All elements' computed styles matched after forcing
  layout; screenshots were inspected for layout differences. Separate browser
  contexts can still rasterize images/shadows differently, so this is not a
  claim of byte-identical screenshots.
- A focused run of 21 existing browser tests passed 13: settings, three
  login/avatar cases, two confirmation flows, five explore/private-note/trip
  retry cases, and the budget/Goe screens. It used an owned MongoDB test harness
  and fixture providers, not the application's database or live providers.
- At the migration handoff, eight existing tests failed and were also run against a separate copy of the
  original frontend with its original CSS. The original frontend also fails
  the enrichment, schedules, sources, header, three catalog-operations and
  geography tests. Most failures are stale selectors/headings or an old header
  height expectation; the schedule test also depends on mutable fixture state.
  The suite was **not fully passing at that handoff**. The owner subsequently
  requested repairs to those tests; see the follow-up below.

Temporary scripts, read fixtures and screenshots are in the ignored
`.local/tailwind-migration/` directory; browser failure evidence is under
`test-results/tailwind/` and `test-results/tailwind-baseline/`. Full application
unit/integration suites, production deployment, physical devices and live
providers were not retested for this styling-only change.

## Browser-test repair follow-up — 26/10/2026

Only six browser spec files and this verification note changed in the follow-up;
the application UI, CSS, server, contracts and business behavior were kept intact.
The eight affected scenarios now use the current headings, action labels,
72-pixel desktop header and destination-picker dialog. The enrichment filter
uses a combobox locator so it cannot accidentally match the similarly labelled
filter group.

The autosave check polls the real API for the saved name rather than racing a
previous success notice. The dry-run test waits for the independent fixture image
worker before taking its DTO snapshot, retaining the full before/after equality
assertion. The four-place bulk workflow explicitly scopes itself to Đà Nẵng so
places created by other scenarios in other provinces do not change its selection.
Publication isolation, revision conflicts, restore behavior, authorization,
provider-failure handling, persistence and responsive checks remain covered.
