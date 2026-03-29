# Hosted Admin Initialization Flow

## Purpose
Replace the former bootstrap-admin shortcut with a controlled initialization flow that is safer for hosted deployments and clearer for operators.

## Problem With The Current Bootstrap Path
- a default admin credential is convenient for first install but is not a good long-term hosted pattern
- operators need a way to know whether a deployment is initialized without exposing tenant app internals broadly
- the app should not depend on a permanent well-known default password existing in production

## Goal
Allow a brand-new hosted deployment to move from "not initialized" to "admin established" once, then permanently disable the bootstrap path.

## Proposed States

### `uninitialized`
- no active hosted admin has completed setup
- tenant app may expose only the minimum initialization status needed for first-run setup

### `initializing`
- an operator- or setup-issued one-time initialization token has been created
- the token has a short TTL and can be redeemed once

### `initialized`
- at least one hosted admin exists and the one-time initialization path is disabled

## Recommended Backend Behavior

### 1. Initialization status check
- add a narrow backend-owned status endpoint, for example:
  - `GET /api/setup/status`
- response shape:
  - `{ "initialized": true|false }`
- this endpoint should reveal only initialization state, not account details

### 2. One-time setup token creation
- do not expose token creation to the tenant-facing browser by default
- preferred creation paths:
  - operator action from a future control plane
  - explicit CLI/script run on the app host
- token properties:
  - random, high-entropy
  - stored only as a hash
  - one-time use
  - short TTL
  - optional IP or request-context binding if operationally practical

### 3. Admin establishment endpoint
- add a one-time endpoint, for example:
  - `POST /api/setup/initialize`
- request body:
  - initialization token
  - admin username
  - admin password
- backend behavior:
  - verify deployment is not already initialized
  - verify token exists, is not expired, and is unused
  - create the first admin with server-side password hashing
  - revoke the setup token
  - mark setup as complete
  - optionally create a normal authenticated session for the newly created admin

### 4. Disable bootstrap fallback
- once the initialization flow exists, remove reliance on the default seeded password for hosted production
- the hosted codebase should not keep a production bootstrap-admin seed path after the replacement flow is validated

## Data Model Direction

### `setup_tokens`
- `id`
- `token_hash`
- `purpose`
- `created_at`
- `expires_at`
- `used_at`
- `created_by`

### `app_runtime_state` or equivalent
- `setup_completed_at`
- `initialized_by_user_id`

## Operational Flow
1. Deploy app and database.
2. Check `GET /api/setup/status`.
3. If uninitialized, operator creates a one-time setup token.
4. First admin redeems token through a dedicated setup UI or operator-guided request.
5. App marks deployment initialized.
6. Normal login flow takes over.

## UI Direction
- show a dedicated first-run setup screen only when backend status reports `initialized: false`
- once initialized, the setup screen should be inaccessible
- do not mix setup UI with the normal login form after initialization

## Guardrails
- never allow setup if an active admin already exists
- never log raw setup tokens
- rate-limit initialization attempts
- audit token creation and redemption events
- keep this flow separate from future operator control-plane auth

## Delivery Outcome
1. added `GET /api/setup/status`
2. added hashed one-time setup token storage
3. added `POST /api/setup/initialize`
4. added a minimal first-run setup UI
5. validated the flow against an isolated rehearsal environment on `APP001`
6. retired the hosted bootstrap-admin seed path from the production code path
