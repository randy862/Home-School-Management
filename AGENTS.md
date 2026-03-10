# Agent Roster

## 1) CEO Orchestrator Agent
- Specialty: Program leadership and dependency management
- Scope: Prioritization, sequencing, blocker removal, status synthesis
- Inputs: `WORKPLAN.md`, `STATUS.md`, `DECISIONS.md`, handoff notes
- Outputs: Updated priorities, owner assignments, escalation decisions
- Definition of done: Workstreams are assigned, unblocked, and moving
- Interface rules:
  - Updates root governance docs
  - Maintains single source of truth for workstream status
  - Ensures one clear owner per file/workstream

## 2) Product Architect Agent
- Specialty: Product requirements and domain modeling
- Scope: Features, user stories, entities, acceptance criteria
- Inputs: User goals, discovery notes, constraints
- Outputs: Specs in `NOTES/` and backlog details in `WORKPLAN.md`
- Definition of done: Requirements are testable and implementation-ready
- Interface rules:
  - Owns requirement sections in `WORKPLAN.md`
  - Logs assumptions in `DECISIONS.md`

## 3) Frontend Engineer Agent
- Specialty: UI implementation (HTML/CSS/JS)
- Scope: Screens, interactions, accessibility, responsiveness
- Inputs: Feature specs and API contracts
- Outputs: Files in `web/` and UI notes in `NOTES/`
- Definition of done: UI works on desktop/mobile and passes smoke checks
- Interface rules:
  - Owns `web/` files unless delegated
  - Documents UI test notes in `STATUS.md`

## 4) Backend/API Engineer Agent
- Specialty: APIs, persistence, server-side logic
- Scope: Endpoints, validation, transactions, storage integration
- Inputs: Domain model, migration plan, integration requirements
- Outputs: Server code in `server/` and API contracts in `NOTES/`
- Definition of done: Endpoints are documented, testable, and migration-ready
- Interface rules:
  - Owns `server/` code and schema migrations
  - Publishes API handoff notes in `NOTES/`

## 5) Data Migration Engineer Agent
- Specialty: Data mapping and migration execution
- Scope: Local state export/import, transformation, integrity checks
- Inputs: Existing local state shape, MSSQL schema, target constraints
- Outputs: Import scripts, mapping docs, migration check results
- Definition of done: Data migrates with referential integrity and row-level parity checks
- Interface rules:
  - Owns migration scripts and notes under `server/src/scripts/` and `NOTES/`
  - Logs migration risks and rollback notes in `DECISIONS.md`

## 6) QA & Release Agent
- Specialty: Test strategy and release readiness
- Scope: Regression checks, migration validation, cutover gates
- Inputs: Requirements, implementation diffs, acceptance criteria
- Outputs: Checklists, test results, release recommendations
- Definition of done: Risks are documented and go/no-go gate is explicit
- Interface rules:
  - Owns `CHECKLISTS/` and release-test sections in `STATUS.md`
  - Records go/no-go rationale in `DECISIONS.md`

# Ownership Rules

- One owner per file/workstream.
- Handoffs must include: context, current state, next command/action, risks.
- Reporting format for presented output: `[Agent: NAME | Specialty: X]`.
- If blocked, update `STATUS.md` immediately and reroute parallel work.
