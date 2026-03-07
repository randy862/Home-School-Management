# Release Runbook

## Purpose
Provide a controlled release process for MVP increments.

## Steps
1. Confirm release candidate scope in `WORKPLAN.md`.
2. Run testing runbook and record outcomes.
3. Update `DECISIONS.md` with go/no-go rationale.
4. Tag release notes in `NOTES/`.

## Rollback
- Revert to previous tagged commit.
- Re-run smoke checks and re-open defect workstream.
