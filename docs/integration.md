# Problem Data and YexJudge Integration

## Submission flow

1. The editor builds a C++ Function Mode payload from the problem's function metadata and selected test cases.
2. `POST /api/run` forwards the request to YexJudge's `POST /submissions` endpoint.
3. YexCode polls `GET /api/run/:id`; its server-side route forwards the poll to YexJudge's `GET /submissions/{id}` endpoint.
4. The editor displays the verdict and returned result details.

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

Problem records are stored in MongoDB and seeded from [`../data/problems.json`](../data/problems.json). Current fields include:

- `slug`, `title`, `difficulty`, and legacy `category`
- `description`, `constraints`, and visible `examples`
- `testCasesJson`, `limits`, and `templates`
- `function` metadata, including the function signature and optional comparison policy

The planned content model removes the legacy category field, adds topics and optional companies, and separates visible examples from server-only hidden tests. Hidden tests must not be returned to the browser; see the [product roadmap](../plan.md).

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
