# YexCode

YexCode is a LeetCode-like coding practice website for browsing problems, writing solutions, and viewing judge results. It owns the web app and reads problem records from MongoDB; problem authoring fixtures and seeding tools live in the sibling [YCProblems](../YCProblems) repository. Code is sent server-to-server to [YexJudge](../YexJudge), which executes submissions in isolated container sandboxes. YexJudge supports C, C++, and Python stdin/stdout execution plus C++ and Python Function/Class Mode. YexCode problem Run/Submit supports C++ and Python Function/Class Mode; its standalone stdin/stdout workspace supports C, C++, and Python.

## Requirements

- Bun
- MongoDB (Atlas or another deployment)
- Clerk credentials for authentication
- An Upstash Redis database for production rate limiting
- A running YexJudge instance for Run Code and Submit Code

For local execution, Docker Compose starts YexJudge and its PostgreSQL dependency; PostgreSQL does not need to be installed separately on the host. See [YexJudge setup](../YexJudge/README.md).

## Quickstart

From the YexCode directory, copy the environment template and fill in your MongoDB and Clerk credentials as described in [Local setup](docs/setup.md). Upstash credentials are optional for local development (rate limiting is bypassed without them) but required in production. Then install dependencies and start the app:

```bash
cp .env.local.example .env.local
bun install
bun run migrate:problems -- --dry-run
bun run migrate:problems
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). Start YexJudge separately before using Run Code or Submit Code. Run remains available to unsigned users; Submit requires signing in. To author or seed problems, use [YCProblems](../YCProblems/README.md); its targeted seed command writes only the requested slug.

For an existing local development database where hidden suites must be preserved, use YCProblems' `bun run sync:metadata -- --dry-run --slug <slug>` and then `bun run sync:metadata -- --slug <slug>`. This updates topics, companies, hints, and private reference solutions without replacing test cases. Do not use either YCProblems write command with production data; reference solutions are development-only, and the scripts refuse to run when `NODE_ENV=production`.

For a local end-to-end Run/Submit check, start YexJudge with Docker Compose, then run `bun run build` followed by `bun run smoke:two-sum`. Use `bun run smoke:problems` to compile-check every template, run every YCProblems reference solution, and exercise stable pagination and public-field privacy. These scripts start a temporary production web server and create real judge submissions, so use local development services only—not staging or production.

## Documentation

- [Local setup and MongoDB seeding](docs/setup.md)
- [Problem data and YexJudge integration](docs/integration.md)
- [Deployment and security notes](docs/deployment.md)
- [Product roadmap](plan.md)
