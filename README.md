# Home School Management Web App

Starter workspace for building a Home School Management web application with a multi-agent workflow.

## Project Layout

- `web/` - minimal web app scaffold (HTML/CSS/JS)
- `README.md` - project overview and usage
- `AGENTS.md` - active agent roster and responsibilities
- `WORKPLAN.md` - milestones, owners, dependencies
- `STATUS.md` - current progress board
- `DECISIONS.md` - decision log
- `RUNBOOKS/` - recurring operating procedures
- `PROMPTS/` - reusable prompts by agent role
- `CHECKLISTS/` - quality and release gates
- `NOTES/` - discovery and scratch notes

## Quick Start

1. Open a terminal in the repo root.
2. Start a local server:
   - `python -m http.server 5500`
3. Open:
   - `http://127.0.0.1:5500/web/`

## Current MVP Features

- Management interface:
  - Create and manage students (first name, last name, birthdate, grade)
  - Auto-calculate age and record age-at-entry
  - Create and manage subjects
  - Create and manage courses linked to subjects
  - Enroll students into courses
- Planning and calendar:
  - Configure school year and quarter date ranges
  - Configure holidays and breaks
  - Create annual, quarterly, and weekly instructional plans
  - Calendar views for daily, weekly, monthly, quarterly, and annual schedules
- Records and grading:
  - Attendance logging by student and date
  - Test logging with subject, course, score, and max score
  - Grade dashboard with averages by student, by subject, running, quarterly, and annual
- Instruction progress indicators:
  - Instructional days completed vs total
  - Instructional hours completed vs total
  - School year progress
  - Current quarter progress

## Agent Collaboration Model

1. Plan in `WORKPLAN.md`.
2. Execute per owner assignment in `AGENTS.md`.
3. Track progress in `STATUS.md`.
4. Log key choices in `DECISIONS.md`.
5. Use prompts/runbooks/checklists for repeatable execution quality.
