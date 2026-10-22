# GoEase repository guidance

## Context

Read README.md, docs/BR.md, docs/ARCHITECTURE.md, and the current task before changing code. The product owner's latest explicit instructions take precedence over repository recommendations.

The owner has confirmed a complete rewrite: React + Vite + TypeScript + Tailwind, Express + TypeScript, MongoDB + Mongoose. Develop against local MongoDB first; move to Atlas after the local implementation is complete. Do not import code from the old GoEase repository or reopen the stack choice without a concrete owner request.

## Working agreement

- Complete the authorized task in small, reviewable changes. Make routine implementation choices without repeatedly asking for permission.
- Treat BR sections marked "Đề xuất" or "Cần chốt" as proposals or open questions, not approved product policy. Advance unaffected foundation work; ask only when a missing decision materially changes behavior.
- Keep one web application and one Express API. Organize server code by features as they are implemented. Add abstractions when there is a real consumer or concrete need.
- Keep business rules, authorization, provider secrets, quotas, and payment verification on the server. Derive ownership from the authenticated identity, never from a trusted client-supplied owner ID.
- Keep API request/response contracts independent of React, the DOM, and Mongoose. Never import server models or private configuration into shared/client code.
- Use TypeScript strict mode, runtime input validation, a consistent error response, one package manager, and one lockfile. Pin compatible runtime/tool versions when scaffolding.
- Commit environment-variable examples with safe placeholders. Keep real credentials, database files, dumps, tokens, and personal data out of git and logs.
- Keep loading, empty, failure, and retry behavior usable. A failure in an external provider must not be reported as successful AI generation or confirmed payment. Label development fixtures clearly.
- Model money/order history independently from editable itineraries when commerce is implemented. Do not infer a booking or payment state model before that BR is established.

## Verification and handoff

Run the relevant checks available in the repository. The bootstrap task must establish build, typecheck, lint, and a repeatable MongoDB connectivity check before those commands can be cited as existing.

Prioritize checks for persisted data, ownership boundaries, invalid inputs, and provider failures. Add focused tests for real behavioral risks; documentation-only changes do not require application tests.

At handoff, state what changed, what was actually verified, and what remains unavailable or unverified. Update the relevant documentation when behavior or setup changes. Never claim a command, migration, deployment, or live provider test succeeded without observing it.
