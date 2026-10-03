# YexCode Plan

## Product direction

YexCode is a LeetCode-like coding practice platform. Users browse a problem, write a solution, run visible examples, submit against the complete suite, and review useful results.

YexCode owns the web app, problem content, accounts, and progress. YexJudge owns validation, queueing, compilation, sandboxing, execution, and verdict generation. Keep the repositories separate; change YexJudge only when a measured API or execution requirement cannot be handled in YexCode.

## Product rules

The problem list shows problem name and difficulty; it will also show the logged-in user's solved state after Feature 4. Do not restore category-based navigation. Topics and optional companies are problem metadata, hidden initially on problem pages; revealing them never reveals hidden tests.

A problem is solved only after Submit passes the complete test suite. Run never marks a problem solved. A profile lists each problem once: any accepted submission makes it **Solved**; otherwise, any Submit attempt makes it **Attempted**.

## Implemented foundation

Features 1–3 are complete: versioned problem content, examples-only Run, complete-suite Submit, async judge polling, request validation, and device-local editor drafts. Problem data migration and seeding commands are available. The editor currently supports C++ Function Mode.

For the implemented schema, judge flow, draft behavior, and setup, see [Problem data and YexJudge integration](integration.md) and [Local setup](setup.md). The `/benchmark` page remains a placeholder; custom test execution is Feature 5.

## Request flow

The browser calls YexCode and never knows the YexJudge host. It does not provide authoritative Submit test cases.

- **Problem page:** loads the statement, visible examples, topics, companies, hints, and C++ template from YexCode.
- **Run:** sends `{ slug, language, sourceCode }`; YexCode loads visible examples and sends only those to YexJudge.
- **Submit:** sends `{ slug, language, sourceCode }`; YexCode loads visible and hidden tests server-side and sends the complete suite to YexJudge. Authentication, ownership, and persistence are Feature 4.
- **Custom benchmark:** Feature 5 will accept caller-provided test cases only; it will not create Submit records or affect progress.

## Features

### Feature 4 — Accounts, submissions, history, and profile

YexCode will keep a MongoDB `User` collection for basic profile information. Clerk remains responsible for credentials and sessions; YexCode must never store passwords. Create or refresh the profile from trusted provider/session data when an authenticated user reaches an account-backed feature.

A `User` document should contain at least:

```text
_id
authProviderUserId       Clerk user ID, unique
name
email
avatarUrl                optional
createdAt
updatedAt
```

Store only basic information needed for the profile. Profile reads and updates must be scoped to the authenticated user; never accept an arbitrary user ID as proof of identity.

Store one `Submission` document for every Submit attempt, including compilation failures, wrong answers, and infrastructure failures. Create it before dispatching to the judge and update the same record as it moves through queued, running, and terminal states. YexJudge remains responsible for execution; YexCode stores ownership, source history, and user-facing progress.

A `Submission` document should contain at least:

```text
_id
userId                    ObjectId reference to User
problemSlug
kind                      "submit"
language
sourceCode
judgeSubmissionId
status                    queued, running, finished, or failed
verdict                   accepted, wrong_answer, compilation_error, ...
score                     optional judge score; do not infer one if absent
passedTestCases
totalTestCases
runtimeMs
memoryMb
failedTestCase            sanitized user-facing failure data
errorStage
errorMessage
createdAt
updatedAt
```

Requirements:

- Resolve the authenticated provider ID to a `User` on the server and derive `userId` from that record, never from the request body.
- Filter every submission-history/detail query by the authenticated `userId` and, where applicable, problem slug or submission ID. Return not-found/forbidden safely without leaking whether another user's submission exists.
- Protect source code, profile data, and result details with authorization checks. Never expose submissions through public problem/list responses.
- Retain the YexJudge ID for correlation without duplicating its queue or execution lifecycle.
- An accepted Submit creates solved state. A non-accepted Submit creates attempted state unless that user already has an accepted submission for the problem.
- Compute profile progress from submissions initially: one row per problem, with accepted taking precedence. Add a separate progress collection only if scale requires it.
- Add a unique index on `User.authProviderUserId`, an index on `(userId, problemSlug, createdAt)`, and indexes that support accepted/progress lookups.
- History shows problem, verdict, language, score when available, runtime, memory, pass count, and timestamp. Selecting a history row shows that submission's saved code and result.

Remaining work:

- [ ] Create and sync the database user profile from trusted authenticated-provider data.
- [ ] Persist every Submit attempt and associate it with the database user; never accept ownership IDs from the client.
- [ ] Add authenticated, paginated history queries and a switchable history panel in the problem workspace.
- [ ] Show solved state in the problem list and add a profile with deduplicated solved/attempted questions.
- [ ] Verify history/detail endpoints cannot expose another user's source or results, including by guessing IDs or changing slugs.
- [ ] Add the required indexes, rate limiting, and abuse controls; retain and test existing payload-size safeguards.

### Feature 5 — Custom benchmark tests

- [ ] Replace the current `/benchmark` placeholder with a workspace for editable JSON input/expected-output cases, plus add/remove controls.
- [ ] Add a validated endpoint that runs only caller-provided cases against the selected code.
- [ ] Display per-case pass/fail and aggregate counts, with expected and actual output when available.
- [ ] Enforce test-count, payload-size, and rate limits; keep hidden tests server-only and out of benchmark responses.
- [ ] Ensure benchmark runs do not create Submit records or affect solved/attempted progress.

### Feature 8 — Language and editor experience (deferred)

This feature is intentionally deferred until YexJudge has additional language backends. Keep the editor C++-only; do not add unsupported language choices or templates. Device-local drafts and a clear-draft control are already implemented.

## Remaining roadmap work

- [ ] **Production-safe problem fixtures:** Before deployment, move reference solutions out of production artifacts, remove stored reference solutions from the production database, and verify production imports cannot restore them. The `NODE_ENV=production` script guard is a safeguard, not a replacement for cleanup.
- [ ] **Problem quality:** Review hidden-case coverage when adding or editing problems; automated shape checks cannot judge test quality.
- [ ] **Personalized discovery:** Add solved/attempted filters after Feature 4 provides persisted user submissions.

Implementation details for Features 6, 7, and 9, including current behavior and development safeguards, are in [feature implementation notes](feature-implementation-notes.md). Discussions/editorials, analytics, and leaderboards/contests are future possibilities, not scheduled roadmap work.

## Remaining acceptance criteria

1. A logged-in user has a MongoDB profile record with basic provider-sourced information; YexCode does not store credentials.
2. Every Submit attempt saves its source and result data, including score when available, runtime, memory, verdict, and test counts.
3. A logged-in user can view their own submission history and saved code for a question; another user cannot access it, including by guessing submission IDs.
4. The problem list shows the logged-in user's solved state, and the profile lists each attempted or solved question once; any accepted submission takes precedence.
5. The benchmark workspace accepts custom JSON inputs and expected outputs, reports per-case and aggregate results, and never runs hidden tests or changes submission progress.
6. If editorial/discussion features are pursued, enforce content review, ownership, and abuse controls before publication.

## Decisions to make later

- Whether hidden failed inputs should always be shown verbatim or redacted for selected problem types.
- Whether problem content should live only in Atlas or also be versioned in Git and imported; fixtures are currently versioned in Git and seeded into MongoDB.
- Which additional languages and problem modes YexCode will promise after C++ Function Mode.
- What social, ranking, and recommendation features are wanted beyond the practice loop.
