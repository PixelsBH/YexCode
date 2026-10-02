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
bun run seed:problems
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). Start YexJudge separately before using Run Code or Submit Code. To seed only the Subsets problem, run `bun run seed:problems -- subsets` instead of seeding every fixture.

## Documentation

- [Local setup and MongoDB seeding](docs/setup.md)
- [Problem data and YexJudge integration](docs/integration.md)
- [Deployment and security notes](docs/deployment.md)
- [Product roadmap](plan.md)
