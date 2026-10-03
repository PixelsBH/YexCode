# Feature implementation notes

Reference notes for completed and partially completed roadmap work. Keep actionable unfinished work in [`plan.md`](plan.md); this document records current behavior and implementation details.

## Stable judge result contract (Feature 6 — implemented)

YexJudge's existing response includes a verdict, passed/total test counts, runtime and memory when available, and failed-case data with an ID. YexCode validates and normalizes the submission response, rejects inconsistent counts/statuses/failure locations, bounds error payloads, derives a stable `errorStage` from the verdict, and renders available stage and score details. No YexJudge change was needed for the current C++ Function Mode contract.

The judge stops after the first failing case. `passedTestCases` counts the leading cases that passed; `totalTestCases` remains the full suite size. Execution does not continue after a failure.

## Problem authoring and quality (Feature 7 — partially implemented)

Versioned JSON fixtures in Git are the reviewed import source. `validate:problems` checks fixture shape and the seeder runs the same validation before writing. The one-time migration utility remains available for supported legacy database records; legacy content shapes are not accepted in fixtures or runtime APIs.

`smoke:two-sum` checks one fixture. `smoke:problems` compile-checks every template, runs the checked-in C++ reference solutions through Run and Submit, and checks pagination, topic filtering, and public-field privacy. Run smoke tests only against local development services; they create real judge submissions.

For local development databases with curated hidden suites, `sync:problem-metadata` updates topics, companies, hints, and private reference solutions without replacing test suites. `seed:problems` and `sync:problem-metadata` refuse to run when `NODE_ENV=production`. These safeguards do not make the checked-in reference solutions safe to include in a production artifact.

Open work remains in the plan: before production deployment, move reference solutions out of production artifacts and the production database, and review hidden-case coverage when problems are added or edited. See [deployment notes](deployment.md) and [problem data integration](integration.md) for related operational details.

## Discovery and platform features (Feature 9 — partially implemented)

Implemented discovery behavior includes server-side topic filtering and title search, deterministic pagination sorted by title and slug, and collapsed topic/hint sections on problem pages. The current `/foryou` page also contains three curated learning paths. Example explanations were supported already.

Solved/attempted filtering and personalized progress are not implemented; they depend on persisted user submissions from Feature 4 and remain in [`plan.md`](plan.md).

### Further ideas (not committed roadmap work)

Moderated solution discussions/editorials, analytics, and leaderboards or contests were previously considered as possible platform additions. They are not active implementation tasks and require product, identity, telemetry, or abuse-policy decisions before being scheduled.
