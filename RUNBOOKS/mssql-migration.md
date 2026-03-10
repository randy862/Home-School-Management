# Runbook: MSSQL Migration

## Purpose

Execute schema creation and data import from local state JSON into SQL Server Express.

## Prerequisites

1. SQL Server Express installed and reachable.
2. `.env` populated from `.env.example`.
3. Node.js 18+ installed.
4. Local state JSON exported to a file path (for example `NOTES/local-state-export.json`).

## Commands

1. Install dependencies
   - `cd server`
   - `npm install`
2. Create schema
   - `npm run db:migrate`
3. Import state JSON
   - `npm run db:import-state -- --file ../NOTES/local-state-export.json`
4. Start API server
   - `npm run start`

## Validation

1. Confirm health endpoint: `GET /health`.
2. Confirm import summary printed expected row counts.
3. Run SQL checks:
   - No orphan `courses.subject_id`
   - No orphan `enrollments.student_id` or `enrollments.course_id`
   - No duplicate `attendance(student_id, attendance_date)`

## Rollback

1. Stop API server.
2. Restore DB from pre-migration backup or drop/recreate target database.
3. Re-run migration/import after correcting data issues.
