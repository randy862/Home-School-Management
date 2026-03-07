# Workplan

## Milestone 1: Foundation (Complete)
- Owner: CEO Orchestrator
- Goal: Establish project operating system and minimal web scaffold
- Dependencies: None
- Workstreams:
  - [x] Create governance docs and folders
  - [x] Define initial 5-agent roster
  - [x] Seed reusable prompts and runbooks
  - [x] Create minimal web app starter structure

## Milestone 2: Product Discovery (In Progress)
- Owner: Product Architect
- Goal: Define MVP features for home school workflows
- Dependencies: Milestone 1
- Workstreams:
  - [ ] Draft personas and primary user journeys
  - [x] Define MVP feature set and acceptance criteria
  - [x] Draft data model v1 (students, subjects, courses, enrollments, plans, attendance, tests)

## Milestone 3: MVP Build (In Progress)
- Owner: Frontend + Backend
- Goal: Ship first usable version
- Dependencies: Milestone 2
- Workstreams:
  - [x] Build core UI screens (dashboard, management, planning/calendar, attendance/testing)
  - [x] Implement local storage layer for MVP persistence
  - [x] Implement grade analytics (running, student, subject, quarterly, annual)
  - [x] Implement planning-based calendar generation (daily/weekly/monthly/quarterly/annual views)
  - [ ] Connect UI to backend contracts
  - [ ] Complete smoke and regression checks

## Active Next Actions
1. Add stronger validation (overlapping quarter/break detection and enrollment constraints).
2. Add data import/export and backup/restore for local state.
3. Define backend API contracts to replace local storage persistence.
