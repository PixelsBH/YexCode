# Local Setup

## Requirements

- Bun for dependencies and project scripts
- MongoDB Atlas or another reachable MongoDB deployment
- Clerk application credentials for authentication
- YexJudge running separately for code execution

YexCode can display problems without YexJudge, but Run Code and Submit Code require a reachable judge. For local runs, YexJudge's Docker Compose setup provides the server and PostgreSQL; PostgreSQL does not need to be installed separately on the host. See the [YexJudge README](../../YexJudge/README.md).

## Configure environment

Copy the example into `.env.local` in the YexCode project root, then replace its MongoDB and Clerk placeholders with your credentials. Add the Upstash Redis REST URL and token from your Upstash database settings. Keep `.env.local` out of version control and do not commit credentials.

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
UPSTASH_REDIS_REST_URL=<Upstash Redis REST URL>
UPSTASH_REDIS_REST_TOKEN=<Upstash Redis REST token>
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/
```

`JUDGE_BASE_URL` is required by the server-side proxy; add it to `.env.local` and restart the YexCode server after changing it. For a host-run Next.js app with the local Docker Compose judge, use `http://localhost:8080`. The browser should call YexCode's `/api/run` routes, not YexJudge directly.

Upstash credentials are required in production. If they are missing or Upstash is unavailable, new Run, Submit, and custom benchmark requests return `503` rather than dispatching unprotected work. Polling fails open during a Redis outage so existing results can still be retrieved; Submit polling still requires authentication and ownership. Local development bypasses rate limiting when credentials are absent. The current sliding-window limits are: Run creation, 15 requests per IP per minute (Run remains public); custom benchmark creation, 8 per IP per minute; Submit creation, 30 per IP and 5 per signed-in account per minute; judge polling, 600 per IP and 300 per signed-in account per minute when Redis is available. Tune these values against actual usage and judge capacity.

IP limits use `CF-Connecting-IP`, `X-Real-IP`, or the last address in `X-Forwarded-For` (the address added by the trusted immediate proxy). In deployment, bind YexCode behind a trusted reverse proxy that sets or overwrites these headers; do not expose the app directly to clients that could spoof them.

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
bun run migrate:problems -- --dry-run
bun run migrate:problems
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). Problem fixture authoring and MongoDB seeding live in the sibling [YCProblems repository](../../YCProblems/README.md), separate from the web app. From the `Yex` directory, configure its own development MongoDB URI and seed a single problem like this:

```bash
cd YCProblems
cp .env.example .env.local
bun install
bun run validate
bun run seed -- subsets
```

Replace `subsets` with the fixture slug. Targeted seeding upserts only that slug and replaces its fixture-owned fields, including the test suite; it does not delete or modify other MongoDB problem records. Running `bun run seed` without a slug validates and upserts every fixture. The fixtures contain development-only reference solutions, and write scripts refuse to run when `NODE_ENV=production`; always use a development-only MongoDB URI. For an existing local database with curated hidden suites, YCProblems also supports `bun run sync:metadata -- --dry-run --slug subsets` followed by `bun run sync:metadata -- --slug subsets`, which updates metadata/reference solutions without replacing tests.

## Useful commands

```bash
bun run build  # create a production build
bun run start  # start the production server
bun run lint   # run ESLint
```
