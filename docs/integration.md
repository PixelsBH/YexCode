# Problem Data and YexJudge Integration

## Submission flow

Run Code and Submit Code are separate server-side operations:

1. The editor sends a problem slug, selected-language source, and operation to YexCode; it does not send test cases.
2. `POST /api/run` loads visible examples from MongoDB and forwards only those cases to YexJudge.
3. `POST /api/submissions` loads visible and hidden cases from MongoDB and forwards the complete suite to YexJudge.
4. YexCode polls the matching `/api/run/:id` or `/api/submissions/:id` route, which proxies status from YexJudge's `GET /submissions/{id}` endpoint.
5. The editor displays the verdict, test counts, runtime, memory, and available failure details.

Run is an examples check, not a saved submission. Submit evaluates the complete suite and persists an authenticated user's source and result history. Custom benchmarks are separate from both: they send only the caller's JSON cases to YexJudge and never create a `Submission` record or affect progress.

YexJudge supports C, C++, and Python for stdin/stdout execution, plus C++ and Python for metadata-driven Function and Class Mode. YexCode problem Run/Submit supports Function and Class Mode for C++ and Python. Its standalone custom stdin/stdout workspace supports C, C++, and Python.

A Function Mode payload has this shape:

```json
{
  "language": "cpp",
  "mode": "function",
  "sourceCode": "class Solution { ... };",
  "function": {
    "name": "twoSum",
    "returnType": "vector<int>",
    "params": [
      { "name": "nums", "type": "vector<int>&" },
      { "name": "target", "type": "int" }
    ]
  },
  "testCases": [
    { "id": 1, "args": [[2, 7, 11, 15], 9], "expected": [0, 1] }
  ],
  "limits": {
    "timeLimitMs": 1000,
    "memoryLimitMb": 128
  }
}
```

Class Mode uses problem-owned class metadata and operation-sequence cases. For example, an LRU Cache case sends constructor arguments, calls in order, and one expected result per call (`null` for `void` operations):

```json
{
  "language": "cpp",
  "mode": "class",
  "sourceCode": "class LRUCache { ... };",
  "class": {
    "name": "LRUCache",
    "constructor": { "params": [{ "name": "capacity", "type": "int" }] },
    "operations": [
      { "name": "get", "returnType": "int", "params": [{ "name": "key", "type": "int" }] },
      { "name": "put", "returnType": "void", "params": [{ "name": "key", "type": "int" }, { "name": "value", "type": "int" }] }
    ]
  },
  "testCases": [{
    "id": 1,
    "constructorArgs": [2],
    "operations": [{ "name": "put", "args": [1, 10] }, { "name": "get", "args": [1] }],
    "expected": [null, 10]
  }]
}
```

The browser still sends only `{ slug, language, sourceCode }`; YexCode chooses Function or Class Mode from the stored problem contract and loads tests server-side.

## Custom benchmark flow

The `/workspace` page (benchmark API) is a standalone stdin/stdout runner for C, C++, and Python; it does not select or load a problem. Users provide source code and one or more editable cases containing raw stdin text and expected stdout. It sends `{ language, sourceCode, testCases: [{ id, input, expectedOutput }] }` to `POST /api/benchmark`. The endpoint validates and rate-limits the request, then forwards only those cases to YexJudge in `stdin` mode with the default execution limits. It does not query problem data, load or send visible or hidden problem tests, or write submission records. The endpoint accepts at most 50 cases and enforces the 1 MB request and 128 KB source limits. Results are polled through `GET /api/benchmark/:id`; per-case display is based on the caller's cases and the judge's aggregate result/failure details.

## Problem data

Problem records are stored in MongoDB and seeded from one versioned JSON fixture per problem in the sibling [YCProblems repository](../../YCProblems/README.md) under `data/problems/`. The current versioned shape includes:

- `schemaVersion`, `slug`, `title`, `difficulty`, `description`, and `constraints`
- `topics`, `companies`, and user-visible `hints` arrays
- visible `examples` and server-only `hiddenTestCases`, each using JSON `args` and `expected` values
- explicit `limits`, language `templates` (with an optional Python Function Mode starter), `function` metadata (signature and optional comparison policy), and server-only reference solutions

Public problem endpoints return visible examples and public metadata only; hidden tests and reference solutions are loaded/stored server-side and never sent to the browser. Reference solutions live in the separate checked-in YCProblems development fixtures solely for smoke tests; they must not be included in production artifacts or the production database. The legacy `category`, `testCasesJson`, and `testCases` fields have been removed from the current content shape. YCProblems' `bun run validate` checks every fixture. From that repository, `bun run seed -- <slug>` validates and upserts only that problem; `bun run seed` validates and upserts all fixtures. Targeted seeding does not delete or modify other MongoDB problem records. For an existing local development database with curated suites, `bun run sync:metadata -- --slug <slug>` updates topics, companies, hints, and private references without replacing tests. Both write scripts refuse when `NODE_ENV=production`; this guard does not replace using a development-only database URI.

Run `bun run migrate:problems -- --dry-run` to validate existing database records without writing, then `bun run migrate:problems` to migrate supported legacy records. See [`setup.md`](setup.md) for setup and seeding instructions.

## Per-problem output comparison

Function outputs are order-sensitive by default. A problem can opt in to ignoring the order of elements in the top-level returned vector by setting this in its `function` metadata:

```json
"comparison": { "returnArrayOrder": "unordered" }
```

For example, the `subsets` problem accepts a different ordering of the returned subsets. Entries are compared as a multiset, so duplicate counts are preserved. Nested arrays (the elements inside each subset) remain order-sensitive. Omit the field for problems where order matters. `"unordered"` is currently the only supported value.

## Editor drafts

Editor drafts are stored in browser `localStorage` using a key based on problem slug and language, for example:

```text
yexcode:draft:v1:valid-parentheses:cpp
```

Drafts are browser- and device-specific, are sent to YexJudge only when Run Code or Submit Code is clicked, and are cleared if site data is removed. Cloud-synced drafts are future work.
