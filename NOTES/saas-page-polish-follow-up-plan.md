## SaaS Page Polish Follow-Up Plan

Date: 2026-04-19

### Goal

Polish `web/saas.html` and `web/saas.css` now that hosted onboarding can honestly point to email-delivered setup links instead of on-screen setup-token handoff.

### Recommended Next Slice

1. Tighten the hero and plan-copy language around hosted setup.
2. Make the pricing comparison read more production-ready and less prototype-like.
3. Improve signup-status states so billing, provisioning, and emailed handoff feel consistent.
4. Add trust/support language that matches the new support mailbox and onboarding path.
5. Clean visual polish across `saas.html`, `saas.css`, and `signup-status.html` so they feel like one commercial flow.

### Content Updates

- Replace any remaining wording that implies setup tokens are shown directly to customers.
- Say clearly that setup and activation links are emailed after provisioning.
- Call out `support@navigrader.com` as the support and reply-to contact.
- Tighten wording around what happens after checkout:
  - billing confirmed
  - tenant environment provisioned
  - setup link emailed
  - first admin initializes access

### UX Polish Targets

- Strengthen plan-card hierarchy and plan comparison readability.
- Improve CTA disabled, loading, and post-checkout states.
- Make signup-status copy more reassuring while provisioning is underway.
- Add stronger FAQ or trust copy around support responsiveness, onboarding, and hosted data handling.
- Smooth mobile spacing and button sizing for the public SaaS funnel.

### Implementation Notes

- Preserve the current brand direction instead of redesigning from scratch.
- Keep `signup-status.html` aligned with the staged email states:
  - sent
  - logged
  - skipped by allowlist
  - failed and needs review
- Prefer copy and visual cleanup first, then any larger layout refinements.

### Before Starting

- Confirm the desired staged mail mode for the deployed environment:
  - `real_send`
  - `allowlist_only`
  - `log_only`
- Confirm the deployed control-api environment has:
  - `CONTROL_MAIL_POSTMARK_SERVER_TOKEN`
  - sender/reply-to values
  - allowlist entries if staged mode stays `allowlist_only`
