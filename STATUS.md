# Current Status

Date: 2026-05-27

## Active Workstream

Forgot-password deployment and home lab production validation.

## Current Focus

Prepare the forgot-password/login-refresh work for commit and push.

## Completed Recently

- Built local password-reset request/complete screens and compact refreshed login styling.
- Added tenant password-reset API endpoints, reset-token persistence, Postmark mail service/templates, and migration `032_password_reset_tokens.sql`.
- Local reset UI/API checks passed; local hosted login works from `http://localhost:5500/web/`.
- Deployed forgot-password/login refresh to home lab WEB001 and APP001.
- Restored APP001 protected env from rollback after a merge hiccup, then re-added mail/reset settings without exposing secrets.
- Applied migration `032_password_reset_tokens.sql` to lab Postgres.
- Restarted `hsm-api.service`; APP001 local health passed.
- Public health and reset endpoint checks passed at `https://mitchell.navigrader.com/`.
- Postmark shows a hosted password-reset email for `admin` sent to `support@navigrader.com`.
- User completed the hosted email reset flow and signed in successfully at `https://mitchell.navigrader.com/`.
- Administrator users already require an email address in both the deployed UI and backend API; student users may omit email.
- APP001 and WEB001 deployed file hashes match the local working tree for the password-recovery files.
- Added `JOURNAL/2026-05-27.md` for the home lab password recovery deployment.

## Production State

- Home lab production URL: `https://mitchell.navigrader.com/`
- Tenant app assets:
  - `app.js?v=202605271529`
  - `styles.css?v=202605271537`
- Mail mode: `allowlist_only`
- Mail allowlist: `randy862@gmail.com`, `support@navigrader.com`
- APP001 rollback: `/home/debian/rollback/hsm/forgot-password-20260527161035/app001/`
- WEB001 rollback: `/var/www/home-school-management/rollback/web-forgot-password-20260527161035.tgz`

## Validation

- APP001 deployed JS syntax checks passed with `node --check`.
- Home lab migration `032_password_reset_tokens.sql` applied successfully.
- APP001 `hsm-api.service` restarted and is active.
- APP001 local `/health` returned `{"ok":true}`.
- Public `/health` returned HTTP 200.
- Public root references `styles.css?v=202605271537` and `app.js?v=202605271529`.
- Served app script contains `password-reset/request`.
- Public reset request for `admin` returned generic success.
- Postmark outbound status for message `9887bd1a-3070-44a1-81dd-84fb224cc95d` is `Sent`.
- Hosted deployed code contains `emailInput.required = !needsStudent` and the server-side admin email validation message.
- APP001 and WEB001 deployed SHA-256 hashes matched local files before commit.

## Current Blockers

- None.

## Current Risks

- Forgot-password/login refresh is deployed to the hosted lab but not yet committed or pushed.
- The lab `admin` password should be reset to the user's desired value after validating the email flow.
- Do not store Postmark, database, Stripe, or smoke credentials in repo files.
- Untracked local scratch assets and `tmp/` remain outside the intended commit.

## Next Actions

1. Stage/commit/push the password-recovery and login refresh work while excluding scratch assets.
2. Continue AWS commercial production migration work after this home lab checkpoint is committed.
