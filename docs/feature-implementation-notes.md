# Feature implementation notes

Reference notes for completed and partially completed roadmap work. Keep actionable unfinished work in [`plan.md`](plan.md); this document records current behavior and implementation details.

## Stable judge result contract (Feature 6 — implemented)

YexJudge's existing response includes a verdict, passed/total test counts, runtime and memory when available, and failed-case data with an ID. YexCode validates and normalizes the submission response, rejects inconsistent counts/statuses/failure locations, bounds error payloads, derives a stable `errorStage` from the verdict, and renders available stage and score details. The same result contract supports both C++ and Python Function Mode.

The judge stops after the first failing case. `passedTestCases` counts the leading cases that passed; `totalTestCases` remains the full suite size. Execution does not continue after a failure.

## Problem authoring and quality (Feature 7 — partially implemented)

Versioned per-problem JSON fixtures in the sibling YCProblems repository are the reviewed import source. YCProblems' `validate` command checks fixture shape and its seeder runs the same validation before writing. The YexCode one-time migration utility remains available for supported legacy database records; legacy content shapes are not accepted in runtime APIs.

YexCode's `smoke:two-sum` reads its fixture from the sibling YCProblems repository. `smoke:problems` compile-checks every template, runs the checked-in C++ reference solutions through Run and Submit, and checks pagination and public-field privacy. Run smoke tests only when both repositories and local development services are available; they create real judge submissions.

For local development databases with curated hidden suites, YCProblems' `sync:metadata` command updates topics, companies, hints, and private reference solutions without replacing test suites. YCProblems' `seed` and `sync:metadata` commands refuse to run when `NODE_ENV=production`. These safeguards do not make the checked-in reference solutions safe to include in a production artifact.

Open work remains in the plan: before production deployment, keep YCProblems reference solutions out of production artifacts and the production database, and review existing problems' hidden-case coverage for gaps. The YCProblems `/add-problem` skill now requires a coverage audit when future problems are authored. See [deployment notes](deployment.md) and [problem data integration](integration.md) for related operational details.

## Discovery and platform features (Feature 9 — implemented)

Problem discovery includes title search, deterministic pagination sorted by title and slug, and authenticated Solved, Attempted (not solved), and Unattempted filters based on persisted submissions. The problem list intentionally does not filter or reveal topics; topics remain a collapsed, user-revealed hint on the problem page, where multiple topics may be shown together. The `/foryou` page contains three curated learning paths. Example explanations were supported already.

### Further ideas (not committed roadmap work)

Moderated solution discussions/editorials, analytics, and leaderboards or contests were previously considered as possible platform additions. They are not active implementation tasks and require product, identity, telemetry, or abuse-policy decisions before being scheduled.
