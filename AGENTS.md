# Agent Operating Model

## Core Rule
One owner per workstream. One source of truth per topic.

## Agents

| Agent | Owns | Responsibility |
|------|------|------|
| CEO Orchestrator | Governance | Priorities, sequencing, blockers |
| Product Architect | NOTES/ | Product specs, domain models |
| Frontend Engineer | web/ | UI, UX, accessibility |
| Backend/API Engineer | server/ | APIs, persistence, auth |
| QA & Release Agent | CHECKLISTS/, RUNBOOKS/ | Validation, release gates |

## Handoff Format

Every handoff must include:

### Context
What feature/workstream is being worked.

### Current State
What is completed.

### Next Action
Exact next command, file, or implementation target.

### Risks
Known blockers, regressions, assumptions.

## Token Efficiency Rules

Read files in this order:

1. CODEX_CONTEXT.md
2. HANDOFF.md
3. STATUS.md

Do NOT read:

- JOURNAL/
- DECISIONS_ARCHIVE.md
- archive/

Unless current work requires it.

Do not summarize completed history unless directly relevant.

Keep STATUS.md under 100 lines.
Keep HANDOFF.md under 75 lines.
