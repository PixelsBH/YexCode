# Problem Data and YexJudge Integration

## Submission flow

Run Code and Submit Code are separate server-side operations:

1. The editor sends a problem slug, C++ source, and operation to YexCode; it does not send test cases.
2. `POST /api/run` loads visible examples from MongoDB and forwards only those cases to YexJudge.
3. `POST /api/submissions` loads visible and hidden cases from MongoDB and forwards the complete suite to YexJudge.
4. YexCode polls the matching `/api/run/:id` or `/api/submissions/:id` route, which proxies status from YexJudge's `GET /submissions/{id}` endpoint.
5. The editor displays the verdict, test counts, runtime, memory, and available failure details.

Run is an examples check, not a saved submission. Submit currently evaluates the complete suite but does not yet persist user submissions or authenticate ownership; that is Feature 4 work. Custom benchmark tests are not implemented yet; the `/benchmark` page is currently a placeholder tracked in Feature 5.

YexJudge currently supports metadata-driven Function and Class Mode in C++ only. Do not advertise other languages as LeetCode-style function submissions until their YexJudge backends exist.

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

## Problem data

Problem records are stored in MongoDB and seeded from [`../data/problems.json`](../data/problems.json). The current versioned shape includes:

- `schemaVersion`, `slug`, `title`, `difficulty`, `description`, and `constraints`
- `topics`, `companies`, and user-visible `hints` arrays
- visible `examples` and server-only `hiddenTestCases`, each using JSON `args` and `expected` values
- explicit `limits`, C++ `templates`, `function` metadata (signature and optional comparison policy), and server-only reference solutions

Public problem endpoints return visible examples and public metadata only; hidden tests and reference solutions are loaded/stored server-side and never sent to the browser. Reference solutions currently exist in the checked-in development fixtures solely for smoke tests; they must not be included in production artifacts or the production database. The legacy `category`, `testCasesJson`, and `testCases` fields have been removed from the current content shape. `bun run validate:problems` checks fixtures, and `bun run seed:problems` runs the same validation before writing to MongoDB. For an existing local development database with curated suites, `bun run sync:problem-metadata` updates topics, companies, hints, and private references without replacing tests. Both write scripts refuse when `NODE_ENV=production`; this guard does not replace removing development reference data from production deployments.

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
