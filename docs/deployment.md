# Deployment and Security

For a personal/demo deployment, YexCode and YexJudge can run on the same VPS. Put the public reverse proxy (for example, Caddy or Traefik) in front of YexCode only, and bind YexCode itself to host loopback (for example, `127.0.0.1:3000`) so users cannot bypass the proxy. YexCode calls YexJudge server-to-server at `http://127.0.0.1:8080` using `JUDGE_BASE_URL`; the YexJudge API and PostgreSQL should not have public proxy routes or public host ports. If either app runs in a container, use a private container-network address instead of assuming its `127.0.0.1` is the VPS host.

YexJudge needs persistent workers, PostgreSQL, Docker sandbox control, compiler images, and workspace storage. Its Compose setup mounts the Docker socket, which gives YexJudge powerful control over the host Docker daemon. Keep that socket available only to YexJudge, keep the service private, and do not expose the socket to clients. This is a single-host personal/demo deployment, not a multi-tenant isolation boundary.

Before deploying:

- expose only the reverse proxy publicly and terminate TLS there
- keep PostgreSQL private and configure strong, non-committed secrets
- preserve YexJudge's compile/runtime isolation and resource limits
- configure service restarts, health/readiness checks, monitoring, and backups
- never expose the Docker daemon or Docker socket to clients

Before deploying YexCode, remove development-only reference solutions from production build artifacts and the production MongoDB database. The checked-in problem fixtures currently include reference implementations for development smoke tests; excluding them from public API responses is not sufficient to make deployment safe. `seed:problems` and `sync:problem-metadata` refuse to run when `NODE_ENV=production`, but treat that as a guardrail—not a replacement for removing the data or verifying deployment contents. Never run smoke scripts against production services.

See the [YexJudge deployment and security roadmap](../../YexJudge/docs/plan.md) for its outstanding production-hardening requirements.
