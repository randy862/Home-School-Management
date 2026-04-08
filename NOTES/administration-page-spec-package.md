# Administration Page Spec Package

Date: 2026-04-07
Owner: Product Architect
Related: `web/index.html`, `web/app.js`, `web/styles.css`, `server/src/routes/admin-routes.js`

## Purpose

Define an implementation-ready `Administration` workspace that centralizes operational configuration and management tasks without diluting the focus of `School Day` or `Dashboard`.

## Product Goal

Allow an administrator to:

1. configure which optional School Day and Dashboard elements are shown
2. manage instructor records from an administrative workspace
3. manage users from an administrative workspace
4. keep setup/configuration tasks separate from daily execution workflows

## Scope

In scope for the first rollout:

- new top-level `Administration` page in the main sidebar
- internal tabs:
  - `Workspace Configuration`
  - `Instructors`
  - `Users`
- School Day configuration controls
- Dashboard configuration controls
- moving existing `Instructors` and `Users` management experiences into the new page or rendering them there as the primary administrative access point

Out of scope for the first rollout:

- role-based configuration profiles
- per-user personalized layouts
- drag-and-drop dashboard composition
- advanced widget builder
- system health, billing, or infrastructure settings
- migration of every setup-oriented page into Administration at once

## Core Principles

1. `Administration` is for setup and control, not daily execution.
2. `School Day` should stay focused on running the current day.
3. `Dashboard` should stay focused on visibility and progress.
4. First version should configure presence and default behavior, not every conceivable detail.
5. Existing working features should be reused rather than rebuilt from scratch.

## Navigation Model

### Sidebar placement

Recommended placement:

- below `School Day`
- above instructional maintenance pages like `Students` or near other admin-oriented sections depending on final nav cleanup

Reason:

- it is important and top-level, but not more primary than `Dashboard` or `School Day`

## Page Structure

Top-level page:

- `Administration`

Internal tabs:

- `Workspace Configuration`
- `Instructors`
- `Users`

## Tab 1: Workspace Configuration

### Purpose

Control what appears on `School Day` and `Dashboard` and how those optional sections behave by default.

### Section A: School Day Configuration

#### Visibility controls

Allow toggles for:

- show `Reference Date` filter
- show `Student Filter`
- show `Subject Filter`
- show `Course Filter`
- show `Student Summaries`
- show `Side-By-Side Schedule Overview`
- show quick filters:
  - `Needs Attendance`
  - `Needs Grade`
  - `Needs Completion`
  - `Overridden`

#### Default behavior controls

Allow defaults for:

- default School Day tab
- Student Summaries open/collapsed default
- Side-By-Side Overview open/collapsed default
- possibly compact mode on/off in a later phase

### Section B: Dashboard Configuration

#### Visibility controls

Allow toggles for major dashboard sections and gauges.

Initial candidates:

- KPI summary cards
- Student Performance
- Student Instructional Hours
- Grade Trending
- GPA Trending
- Instructional Hours Trending
- any current report/summary gauge blocks already present

#### Future-friendly note

The model should support later additions such as:

- gauge ordering
- gauge grouping
- role-based visibility
- new gauge definitions

## Tab 2: Instructors

### Purpose

Move instructor maintenance into an administrative workspace without losing current functionality.

### First rollout behavior

- reuse the current working instructor CRUD table/form
- surface it inside `Administration > Instructors`

### Optional transition behavior

Later options:

- keep legacy `Instructors` nav temporarily and route it into Administration
- eventually remove standalone `Instructors` from primary nav once Administration is adopted

## Tab 3: Users

### Purpose

Keep user management with the rest of the system-control tasks.

### First rollout behavior

- reuse the current working user-management table/form
- surface it inside `Administration > Users`

## Configuration Persistence Model

### First recommendation

Persist configuration at the tenant level, not per user.

Reason:

- the requested controls are workspace-level product choices
- they should shape the tenant's operational UI, not just one admin's personal preference

### Recommended storage model

Add a tenant-level configuration document or settings table entry that stores:

```json
{
  "schoolDay": {
    "showReferenceDateFilter": true,
    "showStudentFilter": true,
    "showSubjectFilter": true,
    "showCourseFilter": true,
    "showStudentSummaries": true,
    "showSideBySideOverview": true,
    "showNeedsAttendanceFilter": true,
    "showNeedsGradeFilter": true,
    "showNeedsCompletionFilter": true,
    "showOverriddenFilter": true,
    "defaultTab": "dailySchedule",
    "studentSummariesDefaultExpanded": true,
    "sideBySideOverviewDefaultExpanded": false
  },
  "dashboard": {
    "showKpiCards": true,
    "showStudentPerformance": true,
    "showStudentInstructionalHours": true,
    "showGradeTrending": true,
    "showGpaTrending": true,
    "showInstructionalHoursTrending": true
  }
}
```

## API Contract

### First rollout

`GET /api/admin/workspace-config`

- admin only
- returns current tenant workspace configuration

`PUT /api/admin/workspace-config`

- admin only
- validates and replaces workspace configuration

Payload:

```json
{
  "schoolDay": {
    "showReferenceDateFilter": true,
    "showStudentFilter": true,
    "showSubjectFilter": true,
    "showCourseFilter": true,
    "showStudentSummaries": true,
    "showSideBySideOverview": true,
    "showNeedsAttendanceFilter": true,
    "showNeedsGradeFilter": true,
    "showNeedsCompletionFilter": true,
    "showOverriddenFilter": true,
    "defaultTab": "dailySchedule",
    "studentSummariesDefaultExpanded": true,
    "sideBySideOverviewDefaultExpanded": false
  },
  "dashboard": {
    "showKpiCards": true,
    "showStudentPerformance": true,
    "showStudentInstructionalHours": true,
    "showGradeTrending": true,
    "showGpaTrending": true,
    "showInstructionalHoursTrending": true
  }
}
```

## UI Behavior

### Workspace Configuration tab

- render configuration groups as simple cards/sections
- use toggles or checkboxes for visibility flags
- use dropdowns where there is one selected default value
- include `Save Configuration`
- include `Reset To Defaults`

### Instructors tab

- preserve current instructor CRUD behavior

### Users tab

- preserve current user CRUD behavior

## Acceptance Criteria

1. `Administration` is available as a top-level page.
2. The page contains `Workspace Configuration`, `Instructors`, and `Users` tabs.
3. Workspace Configuration can load and save tenant-level UI configuration.
4. School Day respects stored visibility/default settings.
5. Dashboard respects stored visibility settings.
6. Existing instructor and user management remain fully functional inside Administration.
7. The new page reduces the need to keep setup/configuration controls mixed into daily workflows.

## Recommended Rollout Order

### Phase 1

- add Administration shell and tab structure
- render existing Instructors and Users content inside Administration

### Phase 2

- add backend storage and API for workspace configuration
- wire School Day visibility/default settings

### Phase 3

- wire Dashboard section visibility

### Phase 4

- evaluate nav cleanup:
  - standalone `Instructors`
  - standalone `Users`
  - possible future setup pages

## Risks

### 1. Over-configuring the app

Risk:

- too many switches can make the product harder to manage

Mitigation:

- keep first version to high-value visibility/default controls only

### 2. Duplicate navigation during transition

Risk:

- users may temporarily see both legacy and Administration entry points

Mitigation:

- accept short transition period
- consolidate later after validation

### 3. Per-user versus tenant confusion

Risk:

- admins may assume settings are personal preferences

Mitigation:

- label them clearly as tenant workspace settings

## Open Decisions

1. Should `Instructors` and `Users` remain standalone nav items during transition?
   - recommendation: yes initially, then consolidate later
2. Should workspace settings be tenant-wide or per-admin?
   - recommendation: tenant-wide
3. Should Dashboard support section ordering in v1?
   - recommendation: no, visibility only

