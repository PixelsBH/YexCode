# YexCode Plan

## Product direction

YexCode will become a LeetCode-like practice platform. A user should be able to browse a problem, read its statement, write a solution in the supported editor, run it against visible examples, submit it against the complete test suite, and see a useful verdict and failure details.

YexCode and YexJudge remain separate repositories. YexCode owns the website, problem content, accounts, progress, and integration boundary. YexJudge owns validation, queueing, compilation, sandboxing, execution, and verdict generation. Changes to YexJudge should only be made when the API contract or a real execution requirement cannot be satisfied from YexCode.

## Product rules

### Problem list

The problem list will show only:

- Problem name
- Difficulty
- Whether the logged-in user has solved it before

The list will not show a category column or use categories as a primary discovery concept. Difficulty and solved state should remain easy to scan, including on mobile. Topic filtering can be added later as an optional discovery feature, but topics will not be displayed as a required list column.

### Topics and companies

Each problem can have multiple topics and zero or more companies that have reportedly asked the problem previously:

```json
{
  "topics": ["Array", "Hash Table"],
  "companies": ["Google", "Amazon"]
}
```

Both fields may be empty. They are problem metadata, not execution inputs. The problem page will hide them initially and reveal them through user controls, similar to LeetCode's topic/company sections. Revealing metadata must never reveal hidden test cases.

### Solved state

A problem becomes solved only after a Submit operation passes every test case in the complete test suite. Passing visible examples with Run Code does not mark a problem as solved. For a logged-in user, the list and problem page will query the user's successful submissions to determine solved state.

The profile will show each problem at most once. A problem is **Solved** if the user has any accepted submission for it; otherwise, it is **Attempted** if the user has submitted at least once. Repeated submissions must not create duplicate problem entries, and an accepted submission takes precedence over later failed attempts.

## Current baseline

The current YexCode baseline provides:

- MongoDB-backed problem pages and problem listing.
- Versioned problem content with `topics`, `companies`, visible `examples`, and server-only `hiddenTestCases`.
- C++ Function Mode templates and JSON test cases.
- Separate server-side Run and Submit endpoints; Run uses examples only and Submit loads the complete suite from MongoDB.
- Asynchronous submission polling through `queued`, `running`, and terminal states.
- Verdict, pass-count, runtime, memory, and failed-test rendering.
- Request IDs, bounded execution payloads, stale-request handling, and polling retries.
- Device-local editor drafts stored in `localStorage`.
- Idempotent seed and versioned-content migration commands.

Authenticated solved-state display and persisted submission ownership/history remain in Phase 4.

## Request and data flow

The browser must not know the YexJudge host and must never receive hidden tests.

```text
Problem page
    -> GET /api/problems/:slug
    <- statement, examples, topics, companies, template, public metadata

Run Code
    -> POST /api/run { slug, language, sourceCode }
    -> YexCode loads examples from MongoDB
    -> YexCode sends only examples to YexJudge
    <- visible-test result

Benchmark
    -> POST /api/benchmark { slug, language, sourceCode, testCases }
    -> YexCode validates and sends only the caller-provided cases to YexJudge
    <- per-case custom-test result (not a saved submission)

Submit Code
    -> POST /api/submissions { slug, language, sourceCode }
    -> YexCode authenticates/upserts the user and loads visible + hidden tests server-side
    -> YexCode persists the user's submission and sends the complete suite to YexJudge
    <- final result and updated user submission

Submission history / profile
    -> YexCode authenticates the request and scopes every database query to that user
    <- own submissions, profile details, and deduplicated problem progress
```

The browser may identify the problem and provide source code; the benchmark endpoint may also accept caller-authored cases. The browser must never provide the authoritative Submit test-case list: YexCode loads that complete suite server-side. This prevents a client from replacing hidden tests with easier inputs and prevents hidden test data from being exposed through the problem API.

## Problem content contract

Every function-style problem should use a versioned MongoDB document shape. The `function`, `examples`, and `hiddenTestCases` fields form the execution contract. `examples` are both presentation examples and the visible cases used by Run Code. `hiddenTestCases` are server-only and are used only by Submit Code.

```json
{
  "schemaVersion": 1,
  "slug": "binary-search",
  "title": "Binary Search",
  "difficulty": "Easy",
  "description": "...",
  "constraints": ["..."],
  "topics": ["Array", "Binary Search"],
  "companies": [],
  "examples": [
    {
      "id": 1,
      "args": [[-1, 0, 3, 5, 9, 12], 9],
      "expected": 4,
      "explanation": "The target is at index 4."
    }
  ],
  "hiddenTestCases": [
    {
      "id": 101,
      "args": [[5], 5],
      "expected": 0
    }
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
  }
}
```

### Content rules

- `schemaVersion` makes future content migrations explicit.
- `slug` is lowercase, unique, stable, and used in URLs.
- `difficulty` is exactly `Easy`, `Medium`, or `Hard`.
- `topics` is an array of normalized strings and may contain multiple values.
- `companies` is an array of normalized strings and may be empty.
- `function.params` order, names, and types must match the C++ method signature.
- Every `args` array must contain exactly one JSON value per function parameter.
- Every `expected` value must be valid JSON and match the declared return type.
- IDs must be unique across visible and hidden tests within a problem.
- Visible example IDs should be easy to distinguish from hidden IDs, but IDs remain implementation details rather than user-facing security controls.
- Templates must be `class Solution` implementations without a `main` function; YexJudge generates the driver.
- Only use C++ metadata types currently supported by YexJudge. Add a judge runtime adapter before publishing a problem that needs a new type.
- Keep limits within YexJudge's accepted range and use explicit values rather than relying on defaults.
- Hidden test cases must never be returned by the public problem GET endpoint, embedded in browser props, or accepted from the browser as the source of truth for Submit.

### Migration from the current shape

The current Atlas records and starter fixtures have been migrated to schema version 1. Run `bun run migrate:problems -- --dry-run` to validate existing records without writing, then `bun run migrate:problems` to apply the migration. The command validates every record before changing any, maps legacy `category` values to `topics`, derives structured visible examples from legacy display examples when possible, separates the remaining structured cases into `hiddenTestCases`, and removes the old fields. It refuses unsupported legacy cases rather than silently dropping them.

## Run Code behavior

Run Code is a visible-example check, not a real submission and never marks a problem solved.

- The browser sends the slug, selected language, and source code to YexCode.
- YexCode loads only `examples` for the problem.
- YexCode sends those examples to YexJudge.
- The result is `Accepted` when every visible example passes.
- The UI displays visible passed count, visible total count, and runtime.
- A visible wrong answer shows one failed visible case, including input, expected output, and actual output when available.
- A compile, runtime, timeout, memory, output-limit, validation, or infrastructure error shows the stage and case where it occurred when known.
- Run Code does not create a solved record or a persisted Submit history entry.

The benchmark page also lets a user run their code against their own test cases:

- Each case has JSON input matching the problem function parameters and a JSON expected output matching the return type.
- Users can add, edit, and remove cases, then run the selected code against all cases in the benchmark.
- YexCode validates payload shape and applies case-count, input-size, and request rate limits before calling YexJudge.
- Only caller-provided cases are sent; benchmark requests never load or reveal hidden tests.
- Results show per-case pass/fail, input, expected output, actual output when available, and aggregate passed / total counts.
- Benchmark runs are not authoritative submissions: they do not affect solved/attempted state and are not saved in submission history.

## Submit behavior

Submit Code is the authoritative evaluation and is the only operation that can mark a problem solved.

- The browser sends the slug, selected language, and source code; it does not send authoritative tests.
- YexCode authenticates the logged-in user before creating the submission.
- YexCode loads both `examples` and `hiddenTestCases` server-side.
- YexCode sends the complete test suite to YexJudge.
- The UI displays `passed / total` for the complete suite and runtime when available.
- The problem is marked solved only when all test cases pass.
- If any case fails, the UI shows one failed case, which may be hidden, with its input, expected output, actual output when available, and the case identifier if safe to expose.
- A failed Submit operation does not mark the problem solved.
- Repeated submissions are retained as separate user submissions so the user can review their history.

## Result and error display contract

The output panel should consistently display:

- Operation: Run, Benchmark, or Submit.
- Verdict: accepted, wrong answer, compilation error, runtime error, time limit exceeded, memory limit exceeded, output limit exceeded, validation error, or infrastructure error.
- Progress: passed test cases / total test cases.
- Runtime and memory when available; score when provided by the judge.
- Failed test case input, expected output, and actual output when available.
- Error stage: request validation, compilation, sandbox startup, test-case execution, timeout, memory limit, output limit, result comparison, or infrastructure.
- Test case ID/index when the failure is associated with a specific case.
- A bounded, user-safe error message without exposing server secrets, container details, or unrelated users' data.

Compilation errors have zero passed cases but still report the total number of cases. Runtime and resource errors report all cases that passed before the failure and the total suite size. If the judge cannot determine an exact count, the response must say so instead of displaying a misleading number.

## Accounts, submissions, and solved progress

YexCode will keep an application `User` collection in MongoDB for authenticated users' basic profile information and associate submissions with those records. The authentication provider (currently Clerk) remains responsible for credentials and sessions; YexCode must never store passwords. Create or refresh the database profile from trusted provider/session data when an authenticated user reaches an account-backed feature.

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

Only basic information needed for the profile is stored. Profile reads and updates must be scoped to the authenticated user; never accept an arbitrary user ID as proof of identity.

YexCode stores one `Submission` document for every Submit attempt, including compilation failures, wrong answers, and infrastructure failures. Create the record before dispatching the judge request, then update that same record as it moves through queued/running/terminal states. This is separate from YexJudge's execution storage: YexJudge remains responsible for execution, while YexCode stores ownership, source history, and user-facing progress.

A planned `Submission` document should contain at least:

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
score                     optional judge score; do not infer a judge score if none exists
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

Design requirements:

- Resolve the authenticated provider ID to a `User` record on the server; derive `userId` from that record, never from the request body.
- Every submission-history/detail query must filter by both the authenticated `userId` and, where applicable, `problemSlug` or submission ID. Return not-found/forbidden safely without leaking whether another user's submission exists.
- Protect source code, profile data, and result details with authorization checks. Do not expose submissions through public problem/list responses.
- Retain the YexJudge ID for correlation, but do not duplicate the judge queue or execution lifecycle unnecessarily.
- A successful Submit creates solved state for the user/problem pair. A non-accepted Submit creates attempted state unless that user has any accepted submission for the problem.
- Compute profile progress from submissions initially: one row per problem, with accepted taking precedence over any number of failed submissions. Add a separate progress collection only if scale requires it.
- Add a unique index on `User.authProviderUserId`, an index on `(userId, problemSlug, createdAt)`, and indexes that support accepted-submission/progress lookups.
- Submission history should show problem, verdict, language, score when available, runtime, memory, pass count, and timestamp. Selecting a history row shows that submission's saved source code and result.

## Implementation phases

### Phase 1 — Baseline verification

- [x] Test the real two-sum submission against a running YexJudge instance with Docker/Postgres.
- [x] Confirm all existing Atlas records use the supported function metadata and JSON shapes.

### Phase 2 — Problem metadata and list UX

- [x] Remove the legacy `category` field from the schema, seed data, API responses, and UI.
- [x] Add `topics: string[]` and `companies: string[]`, both allowed to be empty.
- [x] Add topic/company reveal controls on the problem page.
- [x] Change the problem list to show only title and difficulty without a category column.
- [x] Migrate two-sum and starter records to the versioned content shape.

The solved-state column and authenticated lookup depend on the Phase 4 user/submission model and are tracked there.

### Phase 3 — Separate Run and Submit

- [x] Split visible `examples` from server-only `hiddenTestCases`.
- [x] Stop returning hidden cases from the public problem API.
- [x] Add server-side payload builders that load the problem by slug and choose visible or complete tests.
- [x] Define separate Run and Submit endpoint semantics and request validation.
- [x] Make Run Code evaluate examples only and never mark a problem solved.
- [x] Make Submit evaluate all cases and return Accepted only on a complete pass.
- [x] Add pass-count, total-count, runtime, and failure-location rendering.
- [x] Add cancellation and stale-request handling when a user runs/submits again or navigates away.
- [x] Add request IDs and user-friendly retry behavior for temporary judge outages.

### Phase 4 — Accounts, submissions, history, and profile

- [ ] Create the YexCode `User` model with a unique authentication-provider ID and basic profile fields; do not store credentials.
- [ ] Upsert/sync the user's basic profile from trusted authenticated provider data.
- [ ] Create the `Submission` model and persist every Submit attempt, source code, status, verdict, score when available, pass counts, runtime, memory, failure details, and judge ID.
- [ ] Associate submissions with the database user record; never accept ownership IDs from the client.
- [ ] Add authenticated, paginated swubmission-history queries scoped to the current user and problem.
- [ ] Add authenticated solved-state queries for the problem list and show each logged-in user's solved state there.
- [ ] Add a switchable submission-history table/panel in the question workspace; selecting a row shows that user's saved code and result for that question.
- [ ] Verify that history/detail endpoints cannot read another user's source or results, including by guessing IDs or changing slugs.
- [ ] Add a profile page with the user's basic information and separate solved/attempted question lists.
- [ ] Deduplicate profile questions by problem; solved takes precedence if any submission passed all test cases, otherwise any Submit attempt counts as attempted.
- [ ] Add user/problem submission and accepted-progress indexes.
- [ ] Add rate limiting, abuse controls, and payload-size safeguards at the website boundary.

### Phase 5 — Custom benchmark tests

- [ ] Add a benchmark page/workspace with editable test cases containing JSON input and expected output, plus add/remove controls.
- [ ] Add a validated benchmark endpoint that runs only caller-provided cases against the selected code.
- [ ] Display per-case pass/fail and aggregate counts, with expected and actual output when available.
- [ ] Enforce test-count, payload-size, and rate limits; keep hidden problem tests server-only and out of benchmark responses.
- [ ] Ensure benchmark runs do not create Submit records or affect solved/attempted progress.

### Phase 6 — Judge contract extensions

YexJudge changes are deferred until the YexCode Run/Submit contract is implemented and the exact response gap is measured. Likely extensions include:

- [ ] Return `passedTestCases` and `totalTestCases` in `Result`.
- [ ] Return a structured failure location/stage and test-case ID/index.
- [ ] Return bounded compiler/runtime/resource error details in a stable format.
- [ ] Decide whether the judge should continue through independent test cases after a wrong answer so exact pass counts are available.
- [ ] Preserve safe behavior for compilation failures, timeouts, memory limits, and infrastructure failures where all cases cannot run.
- [ ] Add API and integration tests for visible-only and complete-suite payloads.

No YexJudge change should expose problem visibility metadata or allow a client to select hidden tests. YexCode remains responsible for selecting which tests belong to Run and Submit.

### Phase 7 — Problem authoring and quality

- [ ] Define a versioned content validation command before inserting records.
- [ ] Add an admin-only create/edit workflow or reviewed import pipeline; do not expose unrestricted problem writes publicly.
- [ ] Validate slugs, metadata arrays, function signatures, type compatibility, test-case arity, duplicate IDs, and JSON values before publishing.
- [ ] Add hidden-test coverage, edge-case review, and a known-correct reference solution for every problem.
- [ ] Add automated smoke submissions for each published problem/template.
- [ ] Retire compatibility handling for the old string-based `testCases` format after migration.

### Phase 8 — Languages and editor experience

- [ ] Keep language choices aligned with YexJudge's actually supported modes; metadata-driven Function/Class Mode is currently C++-only.
- [ ] Add language-specific templates and metadata only after the corresponding judge backend is available and tested.
- [ ] Add editor reset, keyboard shortcuts, readable loading/error states, and responsive behavior.
- [ ] Add accessible labels and keyboard navigation for controls and output.
- [ ] Keep device-local drafts separate by problem and language; add cloud-synced drafts only after account ownership rules are defined.

### Phase 9 — Discovery and platform features

- [ ] Add optional topic filtering and stable pagination without restoring category-based navigation.
- [ ] Add problem status, curated learning paths, and progress views.
- [ ] Add explanations, hints, solution discussions, and optional editorial content.
- [ ] Add analytics features after the basic submission path has production telemetry.
- [ ] Add leaderboards or contests only after identity, rate limits, and plagiarism/abuse policies are defined.

## Draft storage design

The editor stores source text in browser `localStorage`, not cookies. Each draft key contains the version, problem slug, and language, for example `yexcode:draft:v1:valid-parentheses:cpp`. Writes are debounced to avoid a storage operation per keystroke. Drafts are browser-specific, can disappear when site data is cleared, and are not a substitute for authenticated cloud saves.

## Local configuration

YexCode needs the following values in `.env.local` for local development:

```text
MONGODB_URI=<MongoDB Atlas connection string>
JUDGE_BASE_URL=http://localhost:8080
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

Start YexJudge with its own Postgres and Docker prerequisites, then start YexCode. With Bun:

```bash
bun run dev
bun run build
bun run seed:problems
```

Do not commit `.env.local` or any database credentials.

## Testing and acceptance criteria

The current and future milestones should satisfy the following:

1. Opening `/problems/two-sum` loads the problem, examples, topics, optional companies, and a valid C++ template from Atlas.
2. The problem list contains only title, difficulty, and the logged-in user's solved state.
3. Topics and companies are hidden until the user reveals them; hidden test cases are never included in the public problem response.
4. Run Code checks visible examples only, reports visible `passed / total`, and never marks the problem solved.
5. Submit Code checks visible and hidden cases, reports complete-suite `passed / total`, and marks the problem solved only when every case passes.
6. A wrong answer shows one failed case, which may be hidden, with expected and actual output when available.
7. Compilation, runtime, timeout, memory, output-limit, validation, and infrastructure errors show the relevant stage and test case when known.
8. An authenticated user has a MongoDB profile record with basic provider-sourced information; YexCode does not store credentials.
9. Every Submit attempt saves its source and result data, including score when available, runtime, memory, verdict, and test counts.
10. A logged-in user can view their own submission history and saved code for a question; another user cannot access it, including by guessing submission IDs.
11. The profile lists each attempted or solved question once; any accepted submission makes that question solved, otherwise a Submit attempt makes it attempted.
12. The benchmark workspace accepts custom JSON inputs and expected outputs, reports per-case and aggregate results, and never runs hidden tests or changes submission progress.
13. Device-local drafts restore correctly without being sent anywhere until Run, Benchmark, or Submit is clicked.
14. `bun run build` and the seed command complete successfully in a configured local environment.
15. YexJudge remains unchanged until a tested response-contract gap requires an extension; any such extension is covered by judge tests.

## Decisions to make later

These are intentionally deferred until the separated execution loop and submission model are verified:

- Whether Run results should be stored at all or remain ephemeral.
- Whether hidden failed inputs should always be shown verbatim or redacted for selected problem types.
- Whether problem content should live only in Atlas or also be versioned in Git and imported.
- Which languages and problem modes YexCode will promise to users.
- Whether YexCode should proxy all submission status requests or receive push/webhook events later.
- What social, ranking, and recommendation features are wanted beyond the practice loop.
