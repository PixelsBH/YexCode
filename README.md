# YexCode

YexCode is a LeetCode-like coding practice website. Users can browse programming problems, read examples and constraints, edit a solution in the browser, run or submit code, and view the result returned by [YexJudge](../YexJudge).

YexCode owns the web application, problem content, user-facing progress, and submission integration. YexJudge is the separate execution service responsible for validating, compiling, sandboxing, and judging untrusted code.

## Current status

The current MVP supports:

- Next.js App Router with React and TypeScript.
- MongoDB/Mongoose problem loading.
- Clerk authentication scaffolding.
- C++ Function Mode problem templates.
- Asynchronous submission through YexJudge.
- Submission polling through `queued`, `running`, and terminal states.
- Accepted, wrong-answer, compilation, runtime, timeout, memory, output-limit, validation, and infrastructure result display.
- Failed test-case details when YexJudge returns them.
- Device-local code drafts stored in browser `localStorage`, separated by problem and language.
- A Bun seed command for starter problem data.

The current MVP is still being expanded. Run and Submit currently share the same configured test set. Separate visible examples and hidden tests, user submission history, solved-state tracking, topics, companies, and improved pass-count reporting are documented in [`plan.md`](plan.md).


The browser calls YexCode's `/api/run` routes. YexCode forwards requests to YexJudge using the server-side `JUDGE_BASE_URL` environment variable. The browser should not call YexJudge directly.

## Prerequisites

For the YexCode website:

- [Bun](https://bun.sh/)
- MongoDB Atlas or another MongoDB deployment
- Clerk application credentials

For code execution and submissions:

- The separate [`YexJudge`](https://github.com/PixelsBH/YexJudge) repository
- Go, if running YexJudge directly
- Docker Engine and permission to run Docker containers
- PostgreSQL, or the PostgreSQL service supplied by YexJudge's Docker Compose setup

YexCode can display problem pages without YexJudge, but Run Code and Submit Code will not work unless a reachable YexJudge instance is running.

## Local setup

### 1. Install YexCode dependencies

From the YexCode directory:

```bash
bun install
```

### 2. Configure environment variables

Create `.env.local` in the YexCode directory. It is ignored by Git.

```text
MONGODB_URI=<MongoDB connection string>
JUDGE_BASE_URL=http://localhost:8080
NEXT_PUBLIC_BASE_URL=http://localhost:3000

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<Clerk publishable key>
CLERK_SECRET_KEY=<Clerk secret key>
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/
```

`JUDGE_BASE_URL` is used by the server-side proxy and should be preferred over the legacy `NEXT_PUBLIC_JUDGE_BASE_URL` fallback. Never commit MongoDB, Clerk, or service credentials.

### 3. Start YexJudge

YexJudge must be set up and started separately. From the sibling repository:

```bash
cd ../YexJudge

docker build -t yexjudge-runtime:latest -f docker/runtime/Dockerfile .
docker compose up --build
```

The YexJudge Compose setup starts PostgreSQL and the judge server on port `8080`. It also mounts the Docker socket because YexJudge creates restricted compile and runtime containers. Read [`YexJudge/README.md`](../YexJudge/README.md) for database, image, capacity, and Docker requirements.

Check that the service is ready:

```bash
curl http://localhost:8080/health
curl -i http://localhost:8080/ready
```

The YexCode proxy expects the judge at:

```text
http://localhost:8080
```

### 4. Seed problem data

With MongoDB configured, run from YexCode:

```bash
bun run seed:problems
```

The seed is idempotent. It inserts the starter problems from [`data/problems.json`](data/problems.json) and skips slugs that already exist. It does not overwrite the existing two-sum record.

### 5. Start YexCode

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

To test the coding flow, open a problem such as:

```text
http://localhost:3000/problems/two-sum
```

Write a `class Solution` implementation and use Run Code or Submit Code. YexJudge must be running before submitting.

## YexJudge integration

The current submission flow is:

1. The editor builds a C++ Function Mode payload.
2. `POST /api/run` forwards it to YexJudge's `POST /submissions` endpoint.
3. YexJudge returns a submission ID.
4. YexCode polls `GET /api/run/:id`.
5. The proxy forwards the status request to YexJudge's `GET /submissions/{id}` endpoint.
6. The editor renders the final verdict and returned result details.

For the current Function Mode contract, a submission includes:

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

YexJudge currently supports metadata-driven Function/Class Mode for C++ only. Other language support in YexCode should not be advertised as LeetCode-style function support until the corresponding YexJudge backend exists.

## Problem data

Current problem records are stored in MongoDB using fields such as:

- `slug`
- `title`
- `difficulty`
- legacy `category`
- `description`
- `constraints`
- `examples`
- `testCasesJson`
- `limits`
- `templates`
- `function`

The planned content model removes the legacy category field, adds multiple `topics` and optional `companies`, and separates visible examples from server-only hidden tests. Hidden tests must not be returned to the browser. See [`plan.md`](plan.md) for the migration and validation rules.

## Local drafts

Editor drafts are stored in browser `localStorage` using a key based on the problem slug and language. For example:

```text
yexcode:draft:v1:valid-parentheses:cpp
```

Drafts are device- and browser-specific. They are not sent to YexJudge until Run Code or Submit Code is clicked, and they disappear if the browser's site data is cleared. Cloud-synced drafts are a future account feature.

## Useful commands

```bash
bun install          # install dependencies
bun run dev          # start the development server
bun run build        # create a production build
bun run start        # start the production server
bun run lint         # run ESLint
bun run seed:problems # insert starter problems into MongoDB
```

## Production direction

YexCode can be deployed to a platform such as Vercel. YexJudge should run separately on an isolated Docker-capable VM or dedicated container host because it requires persistent workers, PostgreSQL, Docker sandbox control, compiler images, and workspace storage.

Before exposing YexJudge to public traffic:

- put it behind HTTPS and an authenticated service boundary
- allow YexCode to access it without exposing it directly to browsers
- keep PostgreSQL private
- isolate and firewall the Docker-capable host
- do not expose the Docker daemon or Docker socket
- configure rate limits, resource limits, monitoring, secret rotation, and backups

Deployment security requirements are tracked in [`YexJudge/plan.md`](../YexJudge/plan.md).

## Related documentation

- [`plan.md`](plan.md) — YexCode product roadmap and implementation plan.
- [`YexJudge/README.md`](../YexJudge/README.md) — judge setup, API usage, and local requirements.
- [`YexJudge/architecture.md`](../YexJudge/architecture.md) — judge architecture, isolation model, and execution lifecycle.
