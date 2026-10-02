# Local Setup

## Requirements

- Bun for dependencies and project scripts
- MongoDB Atlas or another reachable MongoDB deployment
- Clerk application credentials for authentication
- YexJudge running separately for code execution

YexCode can display problems without YexJudge, but Run Code and Submit Code require a reachable judge. For local runs, YexJudge's Docker Compose setup provides the server and PostgreSQL; host Go and PostgreSQL are not required. See the [YexJudge README](../../YexJudge/README.md).

## Configure environment

Copy the example into `.env.local` in the YexCode project root, then replace its MongoDB and Clerk placeholders with your credentials. Keep `.env.local` out of version control and do not commit credentials.

```bash
cp .env.local.example .env.local
```

The template contains these settings:

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

`JUDGE_BASE_URL` is used by the server-side proxy and is preferred to the legacy `NEXT_PUBLIC_JUDGE_BASE_URL` fallback. The browser should call YexCode's `/api/run` routes, not YexJudge directly.

## Start YexJudge

From the sibling YexJudge repository, build the runtime image and start the Docker Compose stack:

```bash
cd ../YexJudge
docker build -t yexjudge-runtime:latest -f docker/runtime/Dockerfile .
docker compose up --build
```

The judge is available at `http://localhost:8080`. Check it before using the editor:

```bash
curl http://localhost:8080/health
curl -i http://localhost:8080/ready
```

For shutdown, configuration, or troubleshooting details, see [YexJudge Operations](../../YexJudge/docs/operations.md).

## Install, seed, and run YexCode

From the YexCode project root:

```bash
bun install
bun run seed:problems
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). The seeder reads `data/problems.json` and upserts its records into MongoDB. To add or refresh only one fixture without touching the others, pass its slug:

```bash
bun run seed:problems -- subsets
```

The `Subsets` problem uses this targeted command. To seed another fixture, replace `subsets` with its slug. The script reports whether the record was inserted or updated.

## Useful commands

```bash
bun run build  # create a production build
bun run start  # start the production server
bun run lint   # run ESLint
```
