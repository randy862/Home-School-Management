## Email And SaaS Next-Session Handoff

Date: 2026-04-18

### Recommended Next Sequence

1. Build the outbound email foundation first.
2. Use that foundation to email hosted setup or activation links.
3. Add tenant-facing password-reset email flow.
4. Polish and finalize `web/saas.html` and `web/saas.css`.
5. Add broader subscription and support email flows later.

### Why This Order

- Email is now a platform capability, not a one-off feature.
- Hosted onboarding still feels incomplete until setup links are emailed instead of exposing raw setup tokens.
- Once the email foundation exists, the same delivery path can support:
  - setup or activation links
  - password reset
  - billing notices
  - export or offboarding updates
  - future support notifications
- `saas.html` polish should happen after the email foundation is in place so the public self-serve path matches the actual onboarding capability.

### Recommended First Slice

The next implementation slice should be:

1. Choose the outbound email provider.
2. Add mail-service configuration and secret wiring for staged and production.
3. Add a small mail service boundary in app code.
4. Add one shared email template path.
5. Use it for the first real workflow: hosted setup or activation link email.

### Decisions Needed At The Start Of The Next Session

The next session should confirm these before implementation begins:

1. Email provider choice.
   - Example options: `Postmark`, `SendGrid`, `SES`, or another provider you already use.
2. Staged sending behavior.
   - Real send
   - Allowlist-only send
   - Log-only mode
3. Sender identity.
   - From name
   - From email
   - Reply-to email if different
4. First workflow to ship.
   - Recommended: emailed setup or activation link
5. Whether the session should stop if provider secrets or DNS setup are missing, or continue with code plus staged-safe log-only behavior.

### Implementation Expectations For The Email Foundation

- Environment-driven provider configuration
- A single mail service abstraction instead of provider-specific calls spread through routes
- Template variables for tenant name, tenant URL, setup link, expiration, support contact, and environment label
- Delivery audit logging or equivalent send history
- Safe staged behavior to prevent accidental sends while testing
- Clear fallback error reporting when provider config is incomplete

### First Email Workflow Target

Recommended first workflow:

- Replace setup-token-on-screen behavior with emailed activation or setup links as the default onboarding path for newly provisioned tenants.

Expected outcome:

- Customer receives tenant URL plus secure setup link by email
- Setup token is no longer the primary thing shown on-screen in the handoff path
- The same templating and delivery path becomes reusable for password reset and future billing notices

### SaaS Page Follow-Up After Email Foundation

After the email foundation and setup-link email are in place, polish `web/saas.html` and `web/saas.css` with focus on:

- clearer plan comparison
- tighter subscription and provisioning copy
- stronger trust and FAQ language
- more polished subscribe and status states
- visual cleanup so the page feels production-ready, not just prototype-ready

### Suggested Prompt For The Next Session

Use this exact request to resume:

`Start the next slice from main. Use NOTES/email-and-saas-next-session-handoff.md as the plan. First, implement the outbound email foundation for hosted/commercial flows. Use [PROVIDER NAME]. Staged send behavior should be [REAL SEND / ALLOWLIST ONLY / LOG ONLY]. Sender should be [FROM NAME <FROM EMAIL>] and reply-to [REPLY-TO EMAIL if different]. Ship the first real workflow as emailed setup/activation links for newly provisioned tenants, then prepare the follow-up SaaS page polish plan. If provider secrets, DNS, or account setup are missing, stop only long enough to tell me exactly what is missing, then continue once provided.` 
