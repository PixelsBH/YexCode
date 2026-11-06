# YexCode Plan

## Product direction

YexCode is a LeetCode-like coding practice platform. Users browse a problem, write a solution, run visible examples, submit against the complete suite, and review useful results.

YexCode owns the web app, problem content, accounts, and progress. YexJudge owns validation, queueing, compilation, sandboxing, execution, and verdict generation. Keep the repositories separate; change YexJudge only when a measured API or execution requirement cannot be handled in YexCode.

## Product rules

The problem list shows problem name, difficulty, and the logged-in user's solved state. Do not restore category-based navigation. Topics and optional companies are problem metadata, hidden initially on problem pages; revealing them never reveals hidden tests.

A problem is solved only after Submit passes the complete test suite. Run never marks a problem solved. A profile lists each problem once: any accepted submission makes it **Solved**; otherwise, any Submit attempt makes it **Attempted**.

## Implemented foundation

Features 1–4 are complete: versioned problem content, examples-only Run, complete-suite Submit, async judge polling, request validation, device-local editor drafts, accounts, submissions, history, and profile progress. Problem data migration and seeding commands are available. YexJudge supports C, C++, and Python execution, with C++ and Python Function/Class Mode; YexCode supports C++ and Python Function Mode.

For the implemented schema, judge flow, draft behavior, and setup, see [Problem data and YexJudge integration](integration.md) and [Local setup](setup.md). The `/benchmark` page remains a placeholder; custom test execution is Feature 5.

## Request flow

The browser calls YexCode and never knows the YexJudge host. It does not provide authoritative Submit test cases.

- **Problem page:** loads the statement, visible examples, topics, companies, hints, and C++ template from YexCode; Python starter code is generated from function metadata when a Python template is absent.
- **Run:** sends `{ slug, language, sourceCode }`; YexCode loads visible examples and sends only those to YexJudge.
- **Submit:** sends `{ slug, language, sourceCode }`; YexCode loads visible and hidden tests server-side, resolves the authenticated user, persists the attempt, and sends the complete suite to YexJudge.
- **Custom benchmark:** Feature 5 will accept caller-provided test cases only; it will not create Submit records or affect progress.

## Features

### Feature 5 — Custom benchmark tests

- [ ] Replace the current `/benchmark` placeholder with a workspace for editable JSON input/expected-output cases, plus add/remove controls.
- [ ] Add a validated endpoint that runs only caller-provided cases against the selected code.
- [ ] Display per-case pass/fail and aggregate counts, with expected and actual output when available.
- [ ] Enforce test-count, payload-size, and rate limits; keep hidden tests server-only and out of benchmark responses.
- [ ] Ensure benchmark runs do not create Submit records or affect solved/attempted progress.

### Feature 8 — Language and editor experience (partially implemented)

The editor and server request flow support C++ and Python Function Mode, with separate device-local drafts and language-specific editor highlighting. Remaining work is to wire stdin/stdout and Class Mode into the web workspace and expose only combinations supported by YexJudge. Device-local drafts and a clear-draft control are already implemented.

## Remaining roadmap work

- [ ] **Production-safe problem fixtures:** Before deployment, move reference solutions out of production artifacts, remove stored reference solutions from the production database, and verify production imports cannot restore them. The `NODE_ENV=production` script guard is a safeguard, not a replacement for cleanup.
- [ ] **Problem quality:** Review hidden-case coverage when adding or editing problems; automated shape checks cannot judge test quality.
- [ ] **Personalized discovery:** Add solved/attempted filters using persisted user submissions.

Implementation details for Features 6, 7, and 9, including current behavior and development safeguards, are in [feature implementation notes](feature-implementation-notes.md). Discussions/editorials, analytics, and leaderboards/contests are future possibilities, not scheduled roadmap work.

## Remaining acceptance criteria

1. The benchmark workspace accepts custom JSON inputs and expected outputs, reports per-case and aggregate results, and never runs hidden tests or changes submission progress.
2. If editorial/discussion features are pursued, enforce content review, ownership, and abuse controls before publication.

## Decisions to make later

- Whether hidden failed inputs should always be shown verbatim or redacted for selected problem types.
- Whether problem content should live only in Atlas or also be versioned in Git and imported; fixtures are currently versioned in Git and seeded into MongoDB.
- What social, ranking, and recommendation features are wanted beyond the practice loop.
