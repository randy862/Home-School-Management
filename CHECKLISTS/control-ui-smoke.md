# Control UI Smoke Checklist

## Access
- [ ] `/control/` loads without a server error
- [ ] `/control-api/health` returns healthy
- [ ] operator login works
- [ ] sign out works
- [ ] `My Account` opens and closes cleanly

## Desktop Navigation
- [ ] sidebar shows:
  - `Customers`
  - `Environments`
  - `Operations`
  - `User Management` only for `manageUsers`
- [ ] switching sections updates the main workspace cleanly
- [ ] summary KPI cards render above the sidebar/content area

## Customers
- [ ] customer table loads
- [ ] organization name opens detail view
- [ ] `Details` opens detail-only main view
- [ ] `Edit` is available from detail view
- [ ] closing detail returns to the table
- [ ] create-customer form opens and closes cleanly

## Environments
- [ ] environment table loads
- [ ] `Details` opens detail-only main view
- [ ] closing detail returns to the table
- [ ] create-environment form opens and closes cleanly

## Operations
- [ ] operations table loads
- [ ] `Details` opens detail-only main view
- [ ] job detail shows result, event, and deployment sections when applicable
- [ ] queue-operation form opens and closes cleanly

## User Management
- [ ] visible only to user admins
- [ ] user table loads
- [ ] `Details` opens detail-only main view
- [ ] `Edit` is available from detail view
- [ ] create-user form validates password and confirm-password fields

## Mobile / Narrow Width
- [ ] sidebar remains usable
- [ ] buttons remain readable and clickable
- [ ] tables/details remain understandable without broken layout
- [ ] no critical actions disappear off-screen

## Noise / UX
- [ ] no stray flash/status banners appear during normal loading
- [ ] logged-in operator identity remains visible
- [ ] labels still feel business-facing rather than overly technical
