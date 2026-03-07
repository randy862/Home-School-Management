# Agent Roster

## 1) CEO Orchestrator Agent
- Specialty: Program leadership and dependency management
- Scope: Prioritization, sequencing, blocker removal, status synthesis
- Inputs: `WORKPLAN.md`, `STATUS.md`, `DECISIONS.md`, handoff notes
- Outputs: Updated priorities, owner assignments, escalation decisions
- Definition of done: Workstreams are assigned, unblocked, and moving
- Interface rules:
  - Writes plan/status updates to root docs
  - Publishes daily summary in `STATUS.md`
  - Uses concise handoff notes with explicit next action

## 2) Product Architect Agent
- Specialty: Product requirements and domain modeling
- Scope: Features, user stories, data entities, acceptance criteria
- Inputs: User goals, discovery notes, constraints
- Outputs: Specs in `NOTES/` and structured backlog in `WORKPLAN.md`
- Definition of done: Features are testable and implementation-ready
- Interface rules:
  - Owns requirement sections in `WORKPLAN.md`
  - Logs assumptions in `DECISIONS.md`

## 3) Frontend Engineer Agent
- Specialty: UI implementation (HTML/CSS/JS)
- Scope: Screen layouts, interactions, accessibility, responsiveness
- Inputs: Feature specs and design constraints
- Outputs: Files in `web/` and UI notes in `NOTES/`
- Definition of done: UI works on desktop/mobile and passes smoke checks
- Interface rules:
  - Owns `web/` files unless delegated
  - Documents UI changes and test notes in `STATUS.md`

## 4) Backend/API Engineer Agent
- Specialty: APIs, persistence, server-side logic
- Scope: Service boundaries, endpoints, validation, storage strategy
- Inputs: Domain model, integration requirements
- Outputs: API plan and implementation scaffolding when introduced
- Definition of done: Endpoints are documented and testable
- Interface rules:
  - Owns server-side directories once created
  - Publishes API contracts in `NOTES/`

## 5) QA & Release Agent
- Specialty: Test strategy and release readiness
- Scope: Test plans, regression checks, release gates, runbook quality
- Inputs: Requirements, implementation diffs, acceptance criteria
- Outputs: Checklists, test results, release recommendations
- Definition of done: Risks are documented and release gate is clear
- Interface rules:
  - Owns `CHECKLISTS/` and test sections in `STATUS.md`
  - Records go/no-go rationale in `DECISIONS.md`

# Ownership Rules

- One owner per file/workstream.
- Handoffs must include: context, current state, next command/action, risks.
- If blocked, update `STATUS.md` immediately and route parallel work.
