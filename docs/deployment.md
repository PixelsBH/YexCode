# Deployment and Security

For a personal/demo deployment, YexCode and YexJudge can run on the same VPS. Put the public reverse proxy (for example, Caddy or Traefik) in front of YexCode only, and bind YexCode itself to host loopback (for example, `127.0.0.1:3000`) so users cannot bypass the proxy. YexCode calls YexJudge server-to-server at `http://127.0.0.1:8080` using `JUDGE_BASE_URL`; the YexJudge API and PostgreSQL should not have public proxy routes or public host ports. YexJudge's submission, polling, health, and diagnostics endpoints do not authenticate callers; submission IDs are not access tokens. Network isolation is mandatory, not optional. If either app runs in a container, use a private container-network address instead of assuming its `127.0.0.1` is the VPS host.

YexJudge needs persistent workers, PostgreSQL, Docker sandbox control, compiler images, and workspace storage. Its Compose setup mounts the Docker socket, which gives YexJudge powerful control over the host Docker daemon. Keep that socket available only to YexJudge, keep the service private, and do not expose the socket to clients. This is a single-host personal/demo deployment, not a multi-tenant isolation boundary.

Before deploying:

- expose only the reverse proxy publicly and terminate TLS there
- keep YexJudge, its health/diagnostics endpoints, and PostgreSQL private; configure strong, non-committed secrets
- preserve YexJudge's compile/runtime isolation and resource limits
- configure service restarts, health/readiness checks, monitoring, and backups
- configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` as server-only secrets; new Run/Submit requests fail closed with `503` if rate limiting is unavailable, while existing-result polling fails open (Submit polling still checks ownership)
- keep YexCode behind a trusted proxy that overwrites client IP headers used for per-IP rate limits
- never expose the Docker daemon or Docker socket to clients

Before deploying YexCode, remove development-only reference solutions from the production MongoDB database and verify the build output. The sibling YCProblems repository contains reference implementations for development smoke tests; excluding them from public API responses is not sufficient. After `npm run build`, run `npm run check:production-artifacts` from YexCode. From YCProblems, provide the production `MONGODB_URI` through your secret manager and run `NODE_ENV=production bun run check:production-data`; it exits nonzero if any problem record still has `referenceSolution`. Back up the production database first, then remove the field with `NODE_ENV=production bun run remove:production-solutions -- --confirm-production` and run the check again. Both YCProblems commands require production mode and do not load `.env.local`; the removal command also requires the explicit `--confirm-production` flag. Use only after verifying the injected URI points at the intended production database. The fixture `seed` and `sync:metadata` commands remain blocked in production. Never run smoke scripts against production services.

See the [YexJudge deployment and security roadmap](../../YexJudge/docs/plan.md) for its outstanding production-hardening requirements.
