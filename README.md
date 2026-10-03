# YexCode

YexCode is a LeetCode-like coding practice website for browsing problems, writing solutions, and viewing judge results. It owns the web app and problem content; code is sent server-to-server to [YexJudge](../YexJudge), which executes submissions in isolated Docker sandboxes.

## Requirements

- Bun
- MongoDB (Atlas or another deployment)
- Clerk credentials for authentication
- A running YexJudge instance for Run Code and Submit Code

For local execution, YexJudge can run with Docker Compose; Go and PostgreSQL do not need to be installed on the host. See [YexJudge setup](../YexJudge/README.md).

## Quickstart

From the YexCode directory, copy the environment template and fill in your MongoDB and Clerk credentials as described in [Local setup](docs/setup.md). Then install dependencies and start the app:

```bash
cp .env.local.example .env.local
bun install
bun run validate:problems
bun run migrate:problems -- --dry-run
bun run migrate:problems
bun run seed:problems
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). Start YexJudge separately before using Run Code or Submit Code. To seed only the Subsets problem, run `bun run seed:problems -- subsets` instead of seeding every fixture.

For an existing local development database where hidden suites must be preserved, use `bun run sync:problem-metadata -- --dry-run` and then `bun run sync:problem-metadata`. This updates topics, companies, hints, and private reference solutions without replacing test cases. Do not use this command or the fixture seeder with production data; reference solutions are development-only, and both write scripts refuse to run when `NODE_ENV=production`.

For a local end-to-end Run/Submit check, start YexJudge with Docker Compose, then run `bun run build` followed by `bun run smoke:two-sum`. Use `bun run smoke:problems` to compile-check every template, run every checked-in reference solution, and exercise topic filtering/pagination. These scripts start a temporary production web server and create real judge submissions, so use local development services only—not staging or production.

## Documentation

- [Local setup and MongoDB seeding](docs/setup.md)
- [Problem data and YexJudge integration](docs/integration.md)
- [Deployment and security notes](docs/deployment.md)
- [Product roadmap](plan.md)
