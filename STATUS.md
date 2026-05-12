# Current Status

Date: 2026-05-12

## Active Workstream

Production SaaS landing refinements plus separate redesign preview.

## Current Focus

Live SaaS landing page polish is deployed at `https://www.navigrader.com/`.

## Completed Recently

- Modern app interface was promoted to production at `https://mitchell.navigrader.com/`.
- SaaS redesign branch `saas-modern-redesign` was fast-forwarded to the modern production baseline.
- Preview-only files `web/saas-preview.html` and `web/saas-preview.css` were added.
- Existing `web/saas.js` checkout and public plan-loading behavior is reused.
- The preview page was deployed to `https://www.navigrader.com/saas-preview.html`.
- Live `https://www.navigrader.com/` now serves `/saas.html` through a guarded WEB001 Apache rewrite.
- Tenant subdomain root pages, including `https://mitchell.navigrader.com/`, still serve the hosted workspace login.
- Blended production-layout preview remains available at `https://www.navigrader.com/saas-blended-preview.html`.
- The polished production-layout SaaS page is now live through `web/saas.html` plus `web/saas-polish.css?v=202605121350`.
- Hero/Problem treatment remains as approved, with the divider removed and CTA buttons centered over trust chips.
- Built For/Solution remain production-style cards.
- Joy, Why It Helps, How It Works, Pricing, FAQ, and bottom screenshots keep distinct cards with blended section titles.
- Bottom CTA uses updated production screenshot assets and corrected labels.
- Bottom CTA screenshots open in a larger click/keyboard preview modal.
- Live `saas.html` backup exists on WEB001:
  `/var/www/home-school-management/web/saas.html.bak-20260512-saas-polish`
- Latest pushed commits before this production polish: `75533f1`, `781fffd`.

## Current Blockers

- None.

## Current Risks

- Apex `https://navigrader.com/` DNS currently resolves away from WEB001.
- Untracked scratch assets remain outside the current commit unless explicitly requested.
- Continue avoiding archive/ and NOTES/ unless the task requires them.

## Next Actions

1. Monitor live `https://www.navigrader.com/`.
2. Continue separate SaaS redesign preview work as a later branch/workstream.
