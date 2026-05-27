# Session Handoff

Date: 2026-05-27

## Context

Forgot-password capability and compact login refresh for the home lab production tenant.

## Current State

- Local uncommitted work includes password-reset request/complete UI, tenant reset APIs, Postmark mail support, and PostgreSQL migration `032_password_reset_tokens.sql`.
- Home lab WEB001 has the refreshed tenant app deployed:
  - `/var/www/home-school-management/web/index.html`
  - `/var/www/home-school-management/web/app.js`
  - `/var/www/home-school-management/web/styles.css`
  - new auth icons `mail.svg`, `cloud.svg`, `secure-shield.svg`, `user-round.svg`
- Home lab APP001 has the changed API files and migration deployed under `/home/debian/apps/home-school-management/server`.
- Home lab APP001 protected env now preserves original runtime secrets and adds password-reset mail config:
  - `PUBLIC_APP_BASE_URL=https://mitchell.navigrader.com`
  - `MAIL_MODE=allowlist_only`
  - `MAIL_ALLOWLIST=randy862@gmail.com,support@navigrader.com`
- Migration `032_password_reset_tokens.sql` has been applied to lab Postgres.
- `hsm-api.service` was restarted successfully and APP001 local health returned `{"ok":true}`.
- Public `https://mitchell.navigrader.com/health` returned HTTP 200.
- Public root references `styles.css?v=202605271537` and `app.js?v=202605271529`.
- Served public app script contains the password-reset request endpoint wiring.
- Public reset request for `admin` returned generic success.
- Postmark shows the hosted reset email was sent to `support@navigrader.com` with message ID `9887bd1a-3070-44a1-81dd-84fb224cc95d`.
- User completed the hosted email reset flow and signed in successfully at `https://mitchell.navigrader.com/`.
- Administrator users already require an email address in the UI and backend; student users may omit email but can use forgot-password if one is present.
- APP001 and WEB001 deployed file hashes match the local working tree for the password-recovery files.
- Journal entry added at `JOURNAL/2026-05-27.md`.

## Next Action

Stage, commit, and push the password-recovery and login refresh work while excluding scratch assets.

## Risks

- Forgot-password/login refresh is deployed to the hosted lab but is still uncommitted locally.
- Treat the lab `admin` password as temporary until validation is complete.
- Keep Postmark and database secrets out of repo files and chat output.
- Local scratch assets and `tmp/` remain outside the intended commit.

## Rollback

- APP001 source/env backup: `/home/debian/rollback/hsm/forgot-password-20260527161035/app001/`
- WEB001 web rollback: `/var/www/home-school-management/rollback/web-forgot-password-20260527161035.tgz`

## Validation

- APP001 deployed JS syntax checks passed with `node --check`.
- Password-reset migration applied with `psql -v ON_ERROR_STOP=1`.
- APP001 `hsm-api.service` restarted and stayed active.
- APP001 local `/health` returned `{"ok":true}`.
- Public `https://mitchell.navigrader.com/health` returned HTTP 200.
- Public reset request endpoint returned `{"ok":true,...}`.
- Postmark outbound status for the hosted reset email is `Sent`.
- Hosted deployed code contains the admin-email-required UI marker and server-side validation message.
- APP001 and WEB001 deployed SHA-256 hashes matched local files before commit.
