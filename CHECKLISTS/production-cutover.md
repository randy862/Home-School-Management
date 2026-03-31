# Production Cutover Checklist

## Prerequisites
- Assign cutover lead
- Assign deployment operator
- Assign rollback owner
- Assign communications owner
- Freeze intended release commit
- Record previous known-good commit
- Confirm production secrets/config are ready
- Confirm host access for `APP001`, `WEB001`, and `SQL001`
- Confirm rollback authority and threshold

## Before Deploy
- Run `scripts\Invoke-HostedReleaseGate.ps1`
- Run `scripts\Test-HostedWorkflow.ps1` if broad workflow validation is required before cutover
- Confirm both APP001 services are active
- Review recent journals for unresolved current failures
- Confirm stakeholder approval to begin

## Deploy
- Copy tenant app backend to `APP001`
- Copy web assets to `WEB001`
- Copy control-plane assets/services if included
- Restart only after all required files are fully copied

## Validate
- Run `scripts\Invoke-HostedReleaseGate.ps1`
- Run `scripts\Test-HostedWorkflow.ps1` when the change set is broad enough to justify full workflow validation
- Confirm public health is `200`
- Confirm tenant login works
- Confirm operator login works if control-plane changes were included
- Confirm no unresolved current journal errors remain

## Rollback If Needed
- Redeploy previous known-good files
- Restart affected services
- Rerun `scripts\Invoke-HostedReleaseGate.ps1`
- Rerun `scripts\Test-HostedWorkflow.ps1` when needed
- Communicate rollback status and next steps

## Complete
- Record final go/no-go result
- Record final deployed commit
- Record any residual risks or follow-up actions
