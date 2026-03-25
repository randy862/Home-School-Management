# Target Architecture

## Objective
Evolve Home School Management from a locally operated SPA with a bridge API into a hosted SaaS platform that can run securely in a data center and later support multiple paying tenants.

## Architecture Principles
- Keep the current product behavior recognizable while moving security and persistence responsibilities to the backend.
- Treat the backend, not the browser, as the enforcement point for authentication, authorization, and tenant isolation.
- Reach a production-ready single-tenant deployment first, then add multi-tenancy on top of a stable foundation.
- Prefer simple, inspectable infrastructure over premature complexity.

## Target End State

### Public Web Tier
- Apache on Debian Linux
- Responsibilities:
  - TLS termination
  - reverse proxy
  - host and route tenant-facing and operator-facing traffic
  - security headers and request size limits

### Tenant App Tier
- Node.js application service
- Responsibilities:
  - session/auth endpoints
  - domain APIs for students, courses, attendance, grades, users, reports
  - tenant resolution and request scoping
  - server-side authorization enforcement

### Control Plane
- Separate operator-facing interface and API
- Responsibilities:
  - tenant provisioning
  - subscription state
  - domain/subdomain mapping
  - migration orchestration
  - tenant support and audit operations

### Data Tier
- PostgreSQL on a separate Debian Linux server
- Responsibilities:
  - system of record for application data
  - control-plane metadata
  - tenant databases

## Deployment Topology

### Phase 1: Production Single-Tenant
- `apache-01`
  - public ingress
  - reverse proxy to app service
- `app-01`
  - customer-facing API
  - serves or supports SPA assets
- `db-01`
  - PostgreSQL
  - single application database

### Phase 2+: SaaS Multi-Tenant
- `apache-01`
  - routes `tenant.example.com` traffic to tenant app tier
  - routes `admin.example.com` traffic to control plane
- `app-01`
  - tenant app/API
- `control-01`
  - operator console and provisioning API
- `db-01`
  - one control-plane database
  - one tenant database per tenant

## Tenancy Strategy
- Recommended model: database per tenant
- Rationale:
  - strongest isolation fit for subscription SaaS
  - easier operational reasoning for backups, restores, and customer separation
  - lower blast radius than shared-table tenancy
- Deferred alternatives:
  - shared database with `tenant_id`
  - schema per tenant
- Those may reduce cost, but they increase correctness and security risk for this product stage.

## Application Boundary Changes Required
- Remove client-only security assumptions.
- Replace full-state read/write endpoints with domain-specific APIs.
- Introduce backend-owned password hashing, login, logout, and session validation.
- Move report calculations and sensitive authorization checks behind the API as needed.
- Reduce frontend coupling by splitting `web/app.js` into modules over time.

## Repo Direction
- Keep `web/` for the customer-facing application.
- Evolve `server/` into the tenant app/API service.
- Add a future `admin/` application for the operator console.
- Add shared infrastructure assets under a future `infra/` directory.

## Risks to Address Before SaaS Launch
- Current frontend still contains security-sensitive logic and bootstrap credentials.
- Current API exposes broad state sync behavior better suited to migration than production SaaS.
- Current backend is optimized for local trust boundaries, not public internet exposure.
- Current code organization will slow delivery if domain boundaries are not introduced.

## Milestone Order
1. Production-ready single-tenant Debian/PostgreSQL deployment
2. Backend auth and domain API refactor
3. Tenant-aware backend foundation
4. Control-plane admin console
5. Subscription and operational hardening
