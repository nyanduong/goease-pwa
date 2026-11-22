# GoEase repository guidance

## Context

Read the current task, [README.md](README.md), [the source index](docs/README.md), and [the decision log](docs/DECISIONS.md) before changing behavior or design.

- The approved [Commercial V1 PRD v0.4.1](docs/GoEase-Commercial-V1-PRD-v0.4.1-approved.md) governs business requirements, scope, and acceptance criteria.
- The approved [UX Information Architecture v0.5](docs/GoEase-UX-Information-Architecture-v0.5-approved.md) governs navigation and user flows. Follow the approved entries and review the [decision log](docs/DECISIONS.md) for conflicting statuses and open questions. Obtain an explicit owner decision before work that depends on those items.
- The approved [Brand & Design Foundation](Figma/brand/DESIGN.md) governs visual design. Keep the approved palette, typography and G logo unless the owner approves a change.
- Verify current technical behavior against code, contracts, tests and configuration. Derive desired business behavior from the approved product sources and recorded owner decisions.
- Work within the approved scope. Do not add features, roles or modules based on legacy documents, historical Git material, prototypes, or existing code. Historical retrieval is for explicit maintenance or recovery requests.
- Record each approved business-rule change and its approval source in [docs/DECISIONS.md](docs/DECISIONS.md). Mark proposals as pending until the owner approves them.

The owner confirmed React + Vite + TypeScript + Tailwind, Express + TypeScript, and MongoDB + Mongoose. Keep this stack and the current repository unless the owner explicitly requests a change. Do not import code from the old GoEase repository. Keep npm workspaces, one `package-lock.json`, and local web/API through `npm run dev`.

Develop against the existing MongoDB service at `localhost:27017`, replica set `rs0`, and the separate `goease` database. Preserve that service and other databases. Atlas is a separate deployment environment. Follow the current task for Git scope.

## Working agreement

- For approved business-rule changes, update the related requirement identifiers, schemas, data dictionaries, contracts and tests as applicable. Distinguish planned checks and schemas from implemented behavior.
- Complete the authorized task in small, reviewable changes. Make routine implementation choices without repeatedly asking for permission.
- Keep one web application and one Express API. Organize server code by features as they are implemented. Add abstractions when there is a real consumer or concrete need.
- Keep business rules, authorization, provider secrets, quotas, and payment verification on the server. Derive ownership from the authenticated identity, never from a trusted client-supplied owner ID.
- Keep API request/response contracts independent of React, the DOM, and Mongoose. Never import server models or private configuration into shared/client code.
- Use TypeScript strict mode, runtime input validation, a consistent error response, one package manager, and one lockfile. Pin compatible runtime/tool versions when scaffolding.
- Commit environment-variable examples with safe placeholders. Keep real credentials, database files, dumps, tokens, and personal data out of git and logs.
- Keep loading, empty, failure, and retry behavior usable. A failure in an external provider must not be reported as successful AI generation or confirmed payment. Label development fixtures clearly.
- Model money/order history independently from editable itineraries when commerce is implemented. Do not infer a booking or payment state model before that BR is established.

## Verification and handoff

Run the relevant checks available in the repository. Check package scripts and their targets before running commands that write to a database, call an external provider, or change deployment state.

Prioritize checks for persisted data, ownership boundaries, invalid inputs, and provider failures. Add focused tests for real behavioral risks; documentation-only changes do not require application tests.

At handoff, state what changed, what was actually verified, and what remains unavailable or unverified. Update the relevant documentation when behavior or setup changes. Never claim a command, migration, deployment, or live provider test succeeded without observing it.
