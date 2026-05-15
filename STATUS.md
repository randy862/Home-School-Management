# Current Status

Date: 2026-05-15

## Active Workstream

Product/platform priorities on `saas-modern-redesign`.

## Current Focus

Public-site polish is deployed and verified. Next work moves back to authenticated release gates, Account Profile upgrade wiring, Account Options Dormant Mode, and Account Options Data Export.

## Completed Recently

- Deployed and committed `6fd203e Blend public closing cards`:
  - Removed the lighthouse/coastal graphic and extra line-pattern decoration from the public closing sections.
  - Connected the CTA and footer as one blended closing unit.
  - Kept footer logo, Product/Resources/Get In Touch links, icon badges, support email, site URL, and copyright.
- Public bottom CTA screenshot collage uses four refreshed UI polish screenshots.
- Account Options copy polish is deployed and committed as `c042e07 Polish account options copy`.
- Operational tab polish is deployed and committed as `677417b Polish operational tab styling`.
- Workspace consistency surfaces are deployed and committed as `34743f5 Polish workspace consistency surfaces`.
- Account billing surface polish is deployed and committed as `2fa0b01 Polish account billing surfaces`.
- Detailed dormant/data export execution plan exists:
  - `NOTES/dormant-data-export-end-to-end-plan.md`
- Detailed next-efforts plan added:
  - `NOTES/product-platform-next-efforts-plan.md`

## Production State

- Public SaaS page:
  - `saas-polish.css?v=202605151220`
  - Latest WEB001 rollback snapshot:
    `/var/www/home-school-management/rollback/web-202605151220.tgz`
- Tenant app assets:
  - `styles.css?v=202605150913`
  - `app.js?v=202605150933`
  - Latest WEB001 rollback snapshot:
    `/var/www/home-school-management/rollback/web-202605150933.tgz`

## Validation

- Public `https://www.navigrader.com/` returned HTTP 200 and includes `saas-polish.css?v=202605151220`, no scenic mark, footer logo, contact email, and copyright.
- Public `https://www.navigrader.com/saas-polish.css?v=202605151220` returned HTTP 200 and includes the connected CTA/footer card styling with no line-pattern graphic.
- Remote WEB001 hashes matched local `web/saas.html` and `web/saas-polish.css`.
- `node --check web/app.js`
- `git diff --check -- web/app.js web/index.html web/styles.css STATUS.md HANDOFF.md`
- Local Web Preview returned HTTP 200 at `http://127.0.0.1:5500/?seedPreview=1`.
- PowerShell parser checks passed for hosted smoke and release-gate scripts.
- Public health endpoint returned `{"ok":true}`.
- WEB001 Apache config syntax OK and Apache service active.

## Current Blockers

- Authenticated production smoke requires production-safe tenant credentials.
- Optional control-plane release gate requires production-safe control credentials.
- Dormant/Data Export and Account Profile upgrade flows are not end-to-end complete.

## Current Risks

- Do not claim Dormant Mode, Data Export, or Upgrade complete until Stripe billing, webhook reconciliation, backend state transitions, UI states, and QA gates are finished.
- Do not store smoke credentials in repo files.
- Use a smoke/test tenant, not a real family account, for mutating release-gate validation.
- Untracked local scratch assets remain outside committed work.

## Next Actions

1. Create production-safe smoke credentials and run the hosted release gate from `NOTES/product-platform-next-efforts-plan.md`.
2. Complete Account Profile upgrade end-to-end, including Stripe subscription update and UI confirmation/success/error states.
3. Complete Dormant Mode end-to-end, including reduced Stripe billing, period-boundary transition, reactivation billing restore, and write-block validation.
4. Complete Data Export end-to-end, including checkout/payment, export job, secure download, expiration, and operator retry/status.
