# Session Handoff

Date: 2026-05-05

## Current Work

Main app modern preview refinement on branch:

app-modern-interface-shell

## Current State

The modern preview exists at:

https://mitchell.navigrader.com/modern-preview/

The live tenant app has not been replaced.

## Next Action

Before coding, inspect only the files needed for the specific requested change.

Default files for UI preview work:

- web/index.html
- web/styles.css
- web/app.js

Do NOT read:

- JOURNAL/
- archive/
- NOTES/
- long planning docs

Unless I explicitly request historical context.

## Current Risks

- Do not change live app entry point unless explicitly approved.
- Do not change backend, billing, provisioning, auth, tenant lifecycle, or database behavior during visual-only work.
- Avoid broad rewrites.

## Validation

For visual-only work:

- run git diff --check
- run node --check web/app.js only if app.js changed
- verify preview cache key was bumped if CSS/JS changed

## If More Context Is Needed

Use NOTES/app-interface-modernization-plan.md as reference only, not default startup context.
