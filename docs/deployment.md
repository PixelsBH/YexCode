# Deployment and Security

YexCode can be hosted as a web application, while YexJudge should run separately on an isolated Docker-capable VM or dedicated container host. YexJudge needs persistent workers, PostgreSQL, Docker sandbox control, compiler images, and workspace storage.

Before exposing YexJudge to public traffic:

- put it behind HTTPS and an authenticated service boundary
- allow YexCode to access it server-to-server without exposing it directly to browsers
- keep PostgreSQL private
- isolate and firewall the Docker-capable host
- never expose the Docker daemon or Docker socket to clients
- configure rate limits, resource limits, monitoring, secret rotation, and backups

Before deploying YexCode, remove development-only reference solutions from production build artifacts and the production MongoDB database. The checked-in problem fixtures currently include reference implementations for development smoke tests; excluding them from public API responses is not sufficient to make deployment safe. `seed:problems` and `sync:problem-metadata` refuse to run when `NODE_ENV=production`, but treat that as a guardrail—not a replacement for removing the data or verifying deployment contents. Never run smoke scripts against production services.

See the [YexJudge deployment and security roadmap](../../YexJudge/docs/plan.md) for its outstanding production-hardening requirements.
