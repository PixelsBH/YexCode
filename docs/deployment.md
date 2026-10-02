# Deployment and Security

YexCode can be hosted as a web application, while YexJudge should run separately on an isolated Docker-capable VM or dedicated container host. YexJudge needs persistent workers, PostgreSQL, Docker sandbox control, compiler images, and workspace storage.

Before exposing YexJudge to public traffic:

- put it behind HTTPS and an authenticated service boundary
- allow YexCode to access it server-to-server without exposing it directly to browsers
- keep PostgreSQL private
- isolate and firewall the Docker-capable host
- never expose the Docker daemon or Docker socket to clients
- configure rate limits, resource limits, monitoring, secret rotation, and backups

See the [YexJudge deployment and security roadmap](../../YexJudge/docs/plan.md) for its outstanding production-hardening requirements.
