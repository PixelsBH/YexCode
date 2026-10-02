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

## Current baseline

The current YexCode baseline provides:

- MongoDB-backed problem pages and problem listing.
- C++ Function Mode templates and JSON test cases.
- A server-side proxy from YexCode to YexJudge.
- Asynchronous submission polling through `queued`, `running`, and terminal states.
- Verdict and failed-test rendering.
- Device-local editor drafts stored in `localStorage`.
- An idempotent Bun seed command for starter problems.

The current Run Code and Submit Code buttons still use the same test set. Separating them is the next execution milestone.

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

Submit Code
    -> POST /api/submissions { slug, language, sourceCode }
    -> YexCode authenticates the user and loads visible + hidden tests server-side
    -> YexCode sends the complete test suite to YexJudge
    <- final result and persisted user submission
```

The browser may identify the problem and provide source code, but it must not provide the authoritative test-case list. This prevents a client from replacing hidden tests with easier inputs and prevents hidden test data from being exposed through the problem API.

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
- Hidden test cases must never be returned by the public problem GET endpoint, embedded in browser props, or accepted from the browser as the source of truth.

### Migration from the current shape

The current implementation uses `testCasesJson` for the execution cases and still has a legacy `category` field in the model/seed data. The planned migration is:

1. Move visible executable cases into `examples` with `id`, `args`, and `expected`.
2. Move non-public cases into `hiddenTestCases`.
3. Remove the legacy `category` field from the model, fixture documents, and UI.
4. Add `topics`, `companies`, and `schemaVersion`.
5. Change the problem API to project out `hiddenTestCases`.
6. Make the server-side Run/Submit payload builder choose the appropriate set.
7. Keep compatibility handling only long enough to migrate existing two-sum and starter records.

## Run Code behavior

Run Code is a visible-example check, not a real submission and never marks a problem solved.

- The browser sends the slug, selected language, and source code to YexCode.
- YexCode loads only `examples` for the problem.
- YexCode sends those examples to YexJudge.
- The result is `Accepted` when every visible example passes.
- The UI displays visible passed count, visible total count, and runtime.
- A visible wrong answer shows one failed visible case, including input, expected output, and actual output when available.
- A compile, runtime, timeout, memory, output-limit, validation, or infrastructure error shows the stage and case where it occurred when known.
- Run Code does not create a solved record. It may be retained as a short-lived execution record later, but it must not appear as a successful submission.

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

- Operation: Run or Submit.
- Verdict: accepted, wrong answer, compilation error, runtime error, time limit exceeded, memory limit exceeded, output limit exceeded, validation error, or infrastructure error.
- Progress: passed test cases / total test cases.
- Runtime and memory when available.
- Failed test case input, expected output, and actual output when available.
- Error stage: request validation, compilation, sandbox startup, test-case execution, timeout, memory limit, output limit, result comparison, or infrastructure.
- Test case ID/index when the failure is associated with a specific case.
- A bounded, user-safe error message without exposing server secrets, container details, or unrelated users' data.

Compilation errors have zero passed cases but still report the total number of cases. Runtime and resource errors report all cases that passed before the failure and the total suite size. If the judge cannot determine an exact count, the response must say so instead of displaying a misleading number.

## User submission model and solved progress

YexCode will add a Mongoose model for authenticated user submissions. This is separate from YexJudge's execution storage: YexJudge remains the execution system of record, while YexCode stores ownership, history, and user-facing progress.

A planned `Submission` document should contain at least:

```text
_id
userId                 Clerk user ID
problemId or problemSlug
kind                   "submit" (and optionally "run" later)
language
sourceCode
judgeSubmissionId
status                 queued, running, finished, or failed
verdict                accepted, wrong_answer, compilation_error, ...
passedTestCases
totalTestCases
runtimeMs
memoryMb
failedTestCase         sanitized user-facing failure data
errorStage
errorMessage
createdAt
updatedAt
```

Design requirements:

- `userId` is always taken from the authenticated server session, never trusted from the request body.
- Users can read only their own submissions.
- Source code and result data must be protected by authorization checks.
- The YexJudge ID is retained for correlation, but YexCode should not duplicate the judge queue or execution lifecycle unnecessarily.
- A successful Submit creates the solved state for the user/problem pair.
- The list can initially compute solved state with an indexed existence query for an accepted submission. A separate progress model or materialized status can be introduced if scale requires it.
- Add indexes for `(userId, problemSlug, createdAt)` and accepted-submission lookups.
- Submission history should show problem, verdict, language, runtime, pass count, and timestamp.

## Implementation phases

### Phase 1 — Reliable baseline

- [x] Load a problem by slug from MongoDB.
- [x] Render statement, examples, constraints, limits, and language template.
- [x] Submit C++ Function Mode code through the YexCode server proxy.
- [x] Poll and render YexJudge responses.
- [x] Add device-local editor drafts with `localStorage`.
- [x] Add starter problem data and an idempotent Bun seed command.
- [ ] Test the real two-sum submission against a running YexJudge instance with Docker/Postgres.
- [ ] Confirm all existing Atlas records use the supported function metadata and JSON shapes.

### Phase 2 — Problem metadata and list UX

- [ ] Remove the legacy `category` field from the schema, seed data, API responses, and UI.
- [ ] Add `topics: string[]` and `companies: string[]`, both allowed to be empty.
- [ ] Add topic/company reveal controls on the problem page.
- [ ] Change the problem list to show only title, difficulty, and logged-in solved state.
- [ ] Add an authenticated solved-state lookup without exposing other users' submissions.
- [ ] Migrate two-sum and starter records to the versioned content shape.

### Phase 3 — Separate Run and Submit

- [ ] Split visible `examples` from server-only `hiddenTestCases`.
- [ ] Stop returning hidden cases from the public problem API.
- [ ] Add server-side payload builders that load the problem by slug and choose visible or complete tests.
- [ ] Define separate Run and Submit endpoint semantics and request validation.
- [ ] Make Run Code evaluate examples only and never mark a problem solved.
- [ ] Make Submit evaluate all cases and mark the problem solved only on a complete pass.
- [ ] Add pass-count, total-count, runtime, and failure-location rendering.
- [ ] Add cancellation and stale-request handling when a user runs/submits again or navigates away.
- [ ] Add request IDs and user-friendly retry behavior for temporary judge outages.

### Phase 4 — Submission persistence and accounts

- [ ] Create the YexCode `Submission` Mongoose model.
- [ ] Associate every Submit operation with the authenticated Clerk user.
- [ ] Persist submission status, verdict, pass counts, runtime, memory, failure details, and judge ID.
- [ ] Add authorization-protected submission history endpoints and UI.
- [ ] Add problem solved-state queries and progress tracking.
- [ ] Add rate limiting, abuse controls, and payload-size safeguards at the website boundary.

### Phase 5 — Judge contract extensions

YexJudge changes are deferred until the YexCode Run/Submit contract is implemented and the exact response gap is measured. Likely extensions include:

- [ ] Return `passedTestCases` and `totalTestCases` in `Result`.
- [ ] Return a structured failure location/stage and test-case ID/index.
- [ ] Return bounded compiler/runtime/resource error details in a stable format.
- [ ] Decide whether the judge should continue through independent test cases after a wrong answer so exact pass counts are available.
- [ ] Preserve safe behavior for compilation failures, timeouts, memory limits, and infrastructure failures where all cases cannot run.
- [ ] Add API and integration tests for visible-only and complete-suite payloads.

No YexJudge change should expose problem visibility metadata or allow a client to select hidden tests. YexCode remains responsible for selecting which tests belong to Run and Submit.

### Phase 6 — Problem authoring and quality

- [ ] Define a versioned content validation command before inserting records.
- [ ] Add an admin-only create/edit workflow or reviewed import pipeline; do not expose unrestricted problem writes publicly.
- [ ] Validate slugs, metadata arrays, function signatures, type compatibility, test-case arity, duplicate IDs, and JSON values before publishing.
- [ ] Add hidden-test coverage, edge-case review, and a known-correct reference solution for every problem.
- [ ] Add automated smoke submissions for each published problem/template.
- [ ] Retire compatibility handling for the old string-based `testCases` format after migration.

### Phase 7 — Languages and editor experience

- [ ] Keep language choices aligned with YexJudge's actually supported modes; metadata-driven Function/Class Mode is currently C++-only.
- [ ] Add language-specific templates and metadata only after the corresponding judge backend is available and tested.
- [ ] Add editor reset, keyboard shortcuts, readable loading/error states, and responsive behavior.
- [ ] Add accessible labels and keyboard navigation for controls and output.
- [ ] Keep device-local drafts separate by problem and language; add cloud-synced drafts only after account ownership rules are defined.

### Phase 8 — Discovery and platform features

- [ ] Add optional topic filtering and stable pagination without restoring category-based navigation.
- [ ] Add problem status, curated learning paths, and progress views.
- [ ] Add explanations, hints, solution discussions, and optional editorial content.
- [ ] Add benchmark/analytics features after the basic submission path has production telemetry.
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
8. A logged-in user can view their own submission history, and another user cannot access it.
9. Device-local drafts restore correctly without being sent anywhere until Run or Submit is clicked.
10. `bun run build` and the seed command complete successfully in a configured local environment.
11. YexJudge remains unchanged until a tested response-contract gap requires an extension; any such extension is covered by judge tests.

## Decisions to make later

These are intentionally deferred until the separated execution loop and submission model are verified:

- Whether Run results should be stored at all or remain ephemeral.
- Whether hidden failed inputs should always be shown verbatim or redacted for selected problem types.
- Whether solved state should be derived from accepted submissions or maintained in a separate progress collection.
- Whether problem content should live only in Atlas or also be versioned in Git and imported.
- Which languages and problem modes YexCode will promise to users.
- Whether YexCode should proxy all submission status requests or receive push/webhook events later.
- What social, ranking, benchmark, and recommendation features are wanted beyond the practice loop.
