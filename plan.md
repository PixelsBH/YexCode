# YexCode Plan

## Product direction

YexCode will become a LeetCode-like practice platform. A user should be able to browse a problem, read its statement, write a solution in the supported editor, submit it to YexJudge, and see a useful verdict and failure details. The current milestone is deliberately narrow: make that loop reliable for the existing MongoDB Atlas two-sum problem and establish a repeatable format for adding more problems.

YexCode and YexJudge remain separate repositories. YexCode owns the website, problem content, and the integration boundary. YexJudge owns validation, queueing, compilation, sandboxing, execution, and verdict generation. Changes to YexJudge should only be made when the API contract or a real execution requirement cannot be satisfied from YexCode.

## Current milestone: end-to-end judging

### Request flow

```text
Browser CodeEditor
    -> POST /api/run (YexCode server route)
    -> POST /submissions (YexJudge)
    <- 202 { submissionId, status: "queued" }
    -> GET /api/run/:id (YexCode server route)
    -> GET /submissions/:id (YexJudge)
    <- { status: "finished", result: {...} }
    -> OutputPanel
```

The browser must not need to know the YexJudge host. The Next.js route forwards requests server-side using `JUDGE_BASE_URL` (with the existing public variable retained as a local-development fallback). `JUDGE_BASE_URL` should be preferred for deployments because it is not a browser-facing setting.

### Completed in this milestone

- Pass the selected problem's C++ template, function metadata, JSON test cases, and limits into the editor.
- Send C++ Function Mode submissions with an explicit `mode: "function"`, `function`, `testCases`, and `limits` payload.
- Proxy submission creation and status polling through YexCode API routes.
- Poll both YexJudge's `queued` and `running` states until a terminal state is reached.
- Display accepted, wrong answer, compilation error, runtime error, time limit, memory limit, infrastructure, and other returned verdicts.
- Display the failed test case using YexJudge's actual response names: `args`, `expected`, and `actualOutput`.
- Save drafts in browser `localStorage`, keyed by problem slug and language, with a clear-draft control. Drafts stay on the device and are not sent until submission.
- Surface structured judge validation and connectivity errors instead of leaving the editor stuck in a running state.
- Wire both Run Code and Submit Code to the current judge flow. Until public/hidden test separation is implemented, both execute the configured problem test cases.
- Fix the Next.js 16 route-handler params type for `api/problems/[slug]` so the project can pass type checking.

### Local configuration

YexCode needs the following values in `.env.local` for local development:

```text
MONGODB_URI=<MongoDB Atlas connection string>
JUDGE_BASE_URL=http://localhost:8080
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

Start YexJudge with its own Postgres and Docker prerequisites, then start YexCode. Do not commit `.env.local` or any database credentials.

## Problem content contract

Every new function-style problem should use the following MongoDB document shape. The `function` and `testCasesJson` fields are the execution contract; `examples` is presentation content and should use the same argument/expected value shapes.

```json
{
  "slug": "binary-search",
  "title": "Binary Search",
  "difficulty": "Easy",
  "category": "Binary Search",
  "description": "...",
  "constraints": ["..."],
  "examples": [
    { "args": [[-1, 0, 3, 5, 9, 12], 9], "expected": 4 }
  ],
  "limits": { "timeLimitMs": 1000, "memoryLimitMb": 128 },
  "templates": {
    "cpp": "class Solution { ... };"
  },
  "function": {
    "name": "search",
    "returnType": "int",
    "params": [
      { "name": "nums", "type": "vector<int>&" },
      { "name": "target", "type": "int" }
    ]
  },
  "testCasesJson": [
    { "id": 1, "args": [[-1, 0, 3, 5, 9, 12], 9], "expected": 4 }
  ]
}
```

Content rules:

- `slug` is lowercase, unique, and stable because it is used in URLs.
- `difficulty` is exactly `Easy`, `Medium`, or `Hard`.
- `function.params` order, names, and types must match the C++ method signature.
- `testCasesJson[*].args` must contain exactly one JSON value per function parameter.
- `testCasesJson[*].expected` must be valid JSON and match the declared return type.
- Test case IDs must be unique integers within a problem.
- Keep examples and test cases semantically consistent; examples may be shown publicly while test cases are the current judge input.
- Keep templates as `class Solution` implementations without a `main` function; YexJudge generates the driver.
- Only use C++ metadata types currently supported by YexJudge. Add a judge runtime adapter before publishing a problem that needs a new type.
- Keep limits within YexJudge's accepted range and use explicit values rather than relying on defaults.

### Seeded starter problems

`data/problems.json` contains four additional C++ Function Mode problems:

- Valid Parentheses
- Binary Search
- Valid Anagram
- Maximum Subarray

Run this from `YexCode` after configuring `.env.local`:

```bash
bun run seed:problems
```

The seed is idempotent and uses `$setOnInsert`: existing Atlas documents, including the existing two-sum record, are skipped rather than overwritten. If an existing problem needs correction, update that document deliberately after reviewing the schema and running the problem through YexJudge.

## Draft storage design

The editor stores source text in `localStorage`, not cookies. Each draft key contains the version, problem slug, and language, for example `yexcode:draft:v1:valid-parentheses:cpp`. Writes are debounced to avoid a storage operation on every keystroke. Drafts are browser-specific, can disappear when site data is cleared, and are not a substitute for authenticated cloud saves; cloud synchronization belongs in the accounts/submission-history phases.

## Implementation phases

### Phase 1 — Reliable practice loop (current)

- [x] Load a problem by slug from MongoDB.
- [x] Render statement, examples, constraints, limits, and language template.
- [x] Submit function-style C++ code through the YexCode server proxy.
- [x] Poll and render the YexJudge response.
- [x] Add seed data and a documented problem contract.
- [ ] Test the real two-sum submission against a running YexJudge instance with Docker/Postgres.
- [ ] Confirm the Atlas two-sum document has the exact function metadata and JSON test-case shape.

### Phase 2 — Separate Run and Submit behavior

- [ ] Add a distinction between public examples for Run Code and hidden evaluation cases for Submit Code.
- [ ] Add a server-side submission payload builder so the browser cannot choose or alter hidden cases.
- [ ] Make Run Code show per-case output while Submit Code shows the official verdict.
- [ ] Add cancellation and stale-request handling when a user submits again or navigates away.
- [ ] Add request IDs and user-friendly retry behavior for temporary judge outages.

### Phase 3 — Problem authoring and quality

- [ ] Define a versioned problem-content format and validation command before inserting records.
- [ ] Add an admin-only create/edit workflow or a reviewed import pipeline; do not expose unrestricted problem writes publicly.
- [ ] Validate slugs, function signatures, type compatibility, test-case arity, duplicate IDs, and JSON values before publishing.
- [ ] Add hidden-test coverage, edge-case review, and a known-correct reference solution for every problem.
- [ ] Add automated smoke submissions for each published problem/template.
- [ ] Decide whether old string-based `testCases` records will be migrated or retained only for stdin/stdout problems.

### Phase 4 — Accounts and submission history

- [ ] Associate submissions with the authenticated Clerk user.
- [ ] Persist a YexCode-facing submission record without duplicating YexJudge's execution database.
- [ ] Add a submission history page with verdict, language, runtime, and timestamp.
- [ ] Add problem completion/progress tracking.
- [ ] Add rate limiting, abuse controls, and payload-size safeguards at the website boundary.

### Phase 5 — Languages and editor experience

- [ ] Keep language choices aligned with YexJudge's actually supported modes; currently metadata-driven Function/Class Mode is C++-only.
- [ ] Add language-specific templates and metadata only after the corresponding judge backend is available and tested.
- [ ] Add editor reset, keyboard shortcuts, readable loading/error states, and mobile/responsive behavior.
- [ ] Add accessible labels and keyboard navigation for controls and output.

### Phase 6 — Discovery and platform features

- [ ] Add filtering by difficulty/category and stable pagination.
- [ ] Add tags, problem status, and curated learning paths.
- [ ] Add explanations, hints, solution discussions, and optional editorial content.
- [ ] Add benchmark/analytics features after the basic submission path has production telemetry.
- [ ] Add leaderboards or contests only after identity, rate limits, and plagiarism/abuse policies are defined.

## Testing and acceptance criteria

The current milestone is complete when all of the following are true:

1. Opening `/problems/two-sum` loads the problem and a valid C++ template from Atlas.
2. Submitting a correct `class Solution` creates a YexJudge submission and eventually shows `Accepted`.
3. A wrong solution eventually shows `Wrong Answer` with the failed input, expected output, and actual output when provided.
4. Invalid code shows a compilation or runtime error rather than an indefinitely spinning UI.
5. A temporarily unavailable judge produces an actionable error from the YexCode proxy.
6. A queued submission continues polling through the `running` state until YexJudge returns a terminal response.
7. `npm run build` and the seed script complete successfully in a configured local environment.
8. No YexJudge source changes are needed for this integration; if a future change is required, it must be justified by a documented API or execution contract.

## Decisions to make later

These are intentionally deferred until the basic loop is verified:

- Whether Run Code and Submit Code should use different endpoints or only different test-case sets.
- Whether problem content should live only in Atlas or also be versioned in Git and imported.
- Which languages and problem modes YexCode will promise to users.
- Whether YexCode should proxy all submission status requests or receive push/webhook events later.
- What social, ranking, benchmark, and recommendation features are wanted beyond the practice loop.
