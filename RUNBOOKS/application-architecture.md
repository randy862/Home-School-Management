# Navigrader Application Architecture

## Purpose

This document explains the current Navigrader hosted architecture in practical terms:

- what runs on `WEB001`, `APP001`, and `SQL001`
- what the browser does
- how requests move through the system
- where application data, billing data, and operational functions live

It is written for product, operations, and release planning. It avoids code-level detail except where a path, service, or port matters for deployment and support.

## At-A-Glance Topology

```text
Parent / Student / Operator Browser
        |
        | HTTPS
        v
WEB001 - Apache, TLS, static web assets, reverse proxy
        |
        | /api and /health proxy to APP001:3000
        | /control-api proxy to APP001:3100
        v
APP001 - tenant app API and control API
        |
        | PostgreSQL connections
        v
SQL001 - PostgreSQL app database, tenant schemas, control schema
```

Current lab host identities:

| Server | Current Role | Current Lab Address |
| --- | --- | --- |
| `WEB001` | Public web entrypoint and Apache reverse proxy | `192.168.1.210` |
| `APP001` | Node.js backend services | `192.168.1.200` |
| `SQL001` | PostgreSQL database server | `192.168.1.202` |

Public tenant hostnames such as `mitchell.navigrader.com` and `smoketest.navigrader.com` enter through `WEB001`.

## Browser Side

The browser runs the user experience. It downloads static HTML, CSS, JavaScript, images, help content, and legal pages from `WEB001`.

The browser is responsible for:

- displaying the public SaaS pages, pricing/signup entry points, Terms of Service, and Privacy Policy
- displaying the tenant app after login
- displaying the Control Center operator UI when an operator opens `/control/`
- managing page navigation inside the single-page tenant app
- rendering forms, tables, dashboards, modals, help content, and account screens
- doing parent-friendly client-side validation before sending requests
- making authenticated API calls back to the server
- doing some read-only calculations for dashboards and reports once data has been loaded
- keeping short-lived UI state such as selected tabs, filters, expanded rows, and optional performance diagnostics

The browser does not own security or persistence. In particular:

- it does not store database credentials
- it does not store Stripe secrets, Postmark secrets, or server-side keys
- it does not decide tenant isolation
- it does not directly connect to PostgreSQL
- it does not permanently own homeschool records

Login credentials are submitted to the backend over HTTPS. After login, the backend issues a secure session cookie. The browser then sends that cookie with later API requests.

## WEB001

`WEB001` is the public web server. It is the first server reached by browsers.

Primary responsibilities:

- terminate HTTPS/TLS for public traffic
- serve static web assets from Apache
- serve the public marketing/pricing/signup experience
- serve the tenant app static files
- serve the Control Center static files
- serve public legal pages
- reverse proxy API requests to `APP001`
- apply web security headers, request-size limits, and dotfile protections

Important paths:

| Path | Purpose |
| --- | --- |
| `/var/www/home-school-management/web` | Tenant app and public SaaS web assets |
| `/var/www/home-school-management/control` | Control Center static UI |
| `/var/www/home-school-management/rollback` | Rollback bundles for deployed web assets |

Important public/static web assets include:

- `index.html`, `app.js`, `styles.css` for the tenant app
- `saas.html`, `saas.js`, `saas.css`, and `saas-polish.css` for the public SaaS pages
- `signup-status.html` for post-checkout/provisioning status
- `data-export-status.html` for post-checkout data export instructions
- `/terms` and `/privacy` legal pages
- `/help` content used by the in-app Help Center

Apache routing responsibilities:

| Public Path | Handled By | Destination |
| --- | --- | --- |
| `/` on tenant hostnames | Apache static files | Tenant app from `/web/index.html` |
| `/` on main Navigrader hostname | Apache rewrite/static files | Public SaaS page such as `/saas.html` |
| `/terms`, `/privacy` | Apache static files | Public legal pages |
| `/control/` | Apache static files | Control Center UI from `/control` |
| `/api/...` | Apache reverse proxy | `APP001:3000/api/...` |
| `/health` | Apache reverse proxy | `APP001:3000/health` |
| `/control-api/...` | Apache reverse proxy | `APP001:3100/...` |

`WEB001` should not contain tenant records, billing records, or application secrets beyond what Apache needs for TLS and web serving. Its main job is to present the app and forward API traffic to the correct backend service.

## APP001

`APP001` runs the backend Node.js services. It owns server-side application behavior, authentication, commercial workflows, and control-plane automation.

There are two primary services on `APP001`.

### Tenant App API

Service:

- `hsm-api.service`

Runtime:

- Node.js
- port `3000`
- deployed path: `/home/debian/apps/home-school-management/server`

Primary responsibilities:

- authenticate tenant users
- issue and validate tenant app sessions
- resolve the tenant/runtime context from the request host
- enforce tenant isolation before reading or writing data
- expose APIs used by the tenant app
- own durable homeschool record changes
- coordinate account profile actions from inside the tenant app
- expose health checks used by Apache and release gates

Major functional areas:

| Area | Examples |
| --- | --- |
| Authentication | login, session lookup, logout |
| Account | profile, subscription/account status, account options |
| Administration | workspace settings, users, instructors |
| Students | student profiles, linked student users, enrollment details |
| Curriculum | subjects, courses, classes, enrollments, class rosters |
| Calendar/Schedule | school years, quarters, holidays, daily breaks, schedule blocks |
| Records | attendance, grades/tests, instruction actuals, flex blocks |
| Grading | grade types, grading criteria, averages, performance calculations |
| Setup/State | setup status, runtime state, hosted readiness checks |

The tenant app API reads and writes PostgreSQL data on `SQL001`. The active tenant schema is selected through runtime configuration, including `.env.runtime` and PostgreSQL `search_path` settings.

### Control API

Service:

- `hsm-control-api.service`

Runtime:

- Node.js
- port `3100`
- deployed path: `/home/debian/apps/home-school-management/control-api`

Primary responsibilities:

- authenticate operator users for the Control Center
- manage tenant/customer records in the control plane
- manage commercial signup and subscription state
- create and process Stripe Checkout sessions
- receive Stripe webhook events
- create provisioning jobs for new tenants
- automate tenant runtime deployment when enabled
- send setup and operational emails
- maintain audit and job history
- generate and clean up paid data export artifacts
- expose control-plane health checks

Major functional areas:

| Area | Examples |
| --- | --- |
| Operator auth | Control Center login/session |
| Tenant management | tenants, environments, runtime metadata |
| Commercial billing | checkout, subscriptions, cancellations, dormant mode, upgrades |
| Provisioning | tenant setup jobs, setup tokens, runtime bundle generation |
| Stripe integration | checkout sessions, webhooks, customer/subscription IDs |
| Mail integration | setup and notification emails |
| Data export | export package generation, secure download, expiration cleanup |
| Audit/jobs | operator activity, provisioning events, workflow history |

The control API also talks to `SQL001`. It uses the control schema for operational/commercial records and can coordinate tenant-specific work when needed.

Current data-export artifacts are written to a configured directory under the control API runtime bundle area, defaulting to:

```text
/home/debian/apps/home-school-management/runtime-bundles/data-exports
```

Those files are temporary. The control API records expiration metadata and cleanup removes expired artifacts.

## SQL001

`SQL001` runs PostgreSQL. It is the system of record.

Primary responsibilities:

- store tenant application records
- store user accounts and session-related data
- store student, curriculum, calendar, attendance, grade, and instruction records
- store control-plane records
- store tenant provisioning, billing, audit, and job metadata
- support tenant isolation through schemas and runtime `search_path`

Current database:

```text
appdb
```

Important logical data areas:

| Data Area | Owner |
| --- | --- |
| Tenant homeschool records | Tenant app API |
| Tenant users/auth data | Tenant app API |
| Student/curriculum/schedule records | Tenant app API |
| Attendance, grades, instruction actuals, flex blocks | Tenant app API |
| Control-plane operators | Control API |
| Tenant/customer/subscription metadata | Control API |
| Stripe checkout/session/subscription references | Control API |
| Legal acceptance records | Control API / signup flow |
| Provisioning jobs and audit events | Control API |
| Data export requests and artifact metadata | Control API |

`SQL001` should not be publicly exposed to browsers. Only backend services should connect to it.

## Common Request Flows

### Tenant App Page Load

1. User opens a tenant hostname such as `mitchell.navigrader.com`.
2. Browser reaches `WEB001` over HTTPS.
3. Apache serves `index.html`, `app.js`, `styles.css`, and related assets.
4. Browser starts the single-page app.
5. Browser calls `/api/setup/status` and `/api/me`.
6. Apache proxies `/api/...` to `APP001:3000`.
7. Tenant app API resolves the tenant runtime and returns the appropriate response.

### Login

1. Browser submits username/password to `/api/auth/login`.
2. Apache proxies the request to `APP001:3000`.
3. Tenant app API validates credentials against PostgreSQL on `SQL001`.
4. Backend creates a server-side session and returns a secure cookie.
5. Browser uses that cookie for future API requests.
6. Browser hydrates the app by loading the tenant data needed for the current experience.

### Normal Parent Workflow

1. Parent uses the browser app to manage students, courses, classes, schedules, attendance, grades, or account options.
2. Browser sends API requests to `/api/...`.
3. Tenant app API validates the session and tenant context.
4. Tenant app API reads or writes the tenant schema in PostgreSQL.
5. Browser receives JSON responses and updates the page.

### Dashboard

1. Browser loads core tenant data through the tenant API.
2. Browser builds dashboard views from that data.
3. Recent performance work caches expensive browser-side dashboard calculations.
4. For a large tenant, the largest remaining login payloads are historical records such as instruction actuals, tests, and attendance.

The current design is acceptable for the present tenant size. Future scaling can move more dashboard summaries to backend-scoped APIs or summary endpoints.

### Signup / Subscription / Provisioning

1. Visitor opens the public SaaS signup/pricing flow on `WEB001`.
2. Browser submits signup and plan information through `/control-api/...`.
3. Apache proxies control requests to `APP001:3100`.
4. Control API creates or updates commercial records in PostgreSQL.
5. Control API creates a Stripe Checkout session.
6. Stripe redirects the customer through payment.
7. Stripe webhook calls return to the Control API.
8. Control API records checkout/subscription state and starts provisioning jobs.
9. Provisioning prepares tenant runtime records, database schema/runtime configuration, setup tokens, and email notifications.
10. New customer receives setup instructions and creates the first admin user.

### Account Upgrade, Dormant Mode, Cancellation, and Data Export

These workflows start in the authenticated tenant app but are coordinated through backend services.

- The browser displays the Account/Profile/Options UI.
- Tenant app API validates the user and account context.
- Commercial changes are coordinated with the control-plane commercial records.
- Stripe is used for paid checkout where required.
- Webhooks update the backend state.
- The tenant app later displays the updated subscription/account state.

For data export:

1. User requests an export from Account Options.
2. Stripe Checkout collects payment.
3. Control API generates a downloadable export package.
4. The export package is saved in the configured export artifact directory.
5. The account UI shows the export as ready.
6. User downloads through a secure backend endpoint.
7. The artifact expires and is cleaned up later.

## Security Boundaries

Important boundaries:

- Browser owns display and user interaction, not secrets.
- `WEB001` owns TLS/static serving/proxying, not business data.
- `APP001` owns backend validation, auth, tenant resolution, billing coordination, and API behavior.
- `SQL001` owns durable records and tenant/control-plane data.

Secrets should live in server environment files or an approved secret manager, not in repo files or browser code.

Tenant isolation is backend-owned. The backend resolves the tenant based on runtime configuration and the request host, then uses the correct PostgreSQL schema/context.

## Release and Validation Model

Typical release responsibilities:

| Release Item | Server |
| --- | --- |
| Tenant app JavaScript/CSS/HTML | `WEB001` |
| Public SaaS/static pages | `WEB001` |
| Control Center static UI | `WEB001` |
| Tenant app API changes | `APP001` |
| Control API changes | `APP001` |
| Database migrations | `SQL001` through backend/control deployment process |

Current standard validation:

- APP001 local health over SSH
- public `/health`
- public `/terms`
- public `/privacy`
- hosted tenant smoke login
- authenticated tenant API smoke reads
- optional control-plane health and operator login

Primary release gate:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Invoke-HostedReleaseGate.ps1 `
  -PublicBaseUrl https://mitchell.navigrader.com
```

## Current Architecture Notes

- The current hosted layout is production-like but still lab-hosted.
- `WEB001`, `APP001`, and `SQL001` map cleanly to future AWS roles.
- The two project-specific items to revisit before a larger cloud cutover are:
  - control-plane provisioning assumptions tied to current host names, SSH trust, and deployment paths
  - local data-export artifact storage, which should eventually move to durable object storage such as S3
- Dashboard performance is currently acceptable after recent caching work.
- Login is acceptable for the current large tenant, but future growth should move toward date-scoped record APIs or backend dashboard summary endpoints.

