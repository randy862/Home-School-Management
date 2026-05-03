# Codex Context

## Product
Navigrader — homeschool records and learning management platform.

## Architecture

Current:

- web/ = customer SPA
- server/ = Node backend
- PostgreSQL runtime
- Apache reverse proxy
- Debian hosting

Target:

1. Production single-tenant
2. Backend-owned auth
3. Domain APIs
4. Multi-tenant SaaS
5. Commercial subscription layer

## Active Priorities

1. Production readiness
2. Backend/platform hardening
3. Commercial Stripe integration
4. Runtime/domain correctness
5. UI polish and workflow refinement

## Environments

### APP001
Backend/API host

### WEB001
Frontend/Apache host

### SQL001
PostgreSQL host

## Critical Rules

- Backend owns auth.
- Browser never owns credentials.
- Tenant isolation is required.
- All major changes require smoke validation.
- Do not read archive or journal files unless needed.

## Read Next

Open HANDOFF.md, then STATUS.md.
