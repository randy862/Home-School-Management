# Testing Runbook

## Purpose
Run lightweight quality checks before merging work.

## Preflight
- Confirm changed files have clear owner and purpose.
- Confirm `STATUS.md` reflects current state.

## Checks
1. Manual UI smoke test for load, responsive layout, and primary click path.
2. Verify no secrets were introduced.
3. Review checklists in `CHECKLISTS/quality-gate.md`.

## Exit Criteria
- Smoke test passes.
- Known risks documented in `STATUS.md`.
