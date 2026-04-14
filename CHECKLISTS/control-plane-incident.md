# Control-Plane Incident Checklist

## Start In `/control/`
- Identify the affected `Customer`, `Environment`, or `Operation`
- Open the latest relevant job in `Operations`
- Check:
  - status
  - attempts / retry timing
  - event history
  - result summary
  - deployment details if present

## Decide
- Retry only if failure looks transient
- Do not retry blindly if the issue is:
  - missing file/directory
  - SSH/permission failure
  - bad environment metadata
  - wrong runtime/schema
  - service startup failure

## If App Runtime Is Affected
- Check `http://192.168.1.210/health`
- Check `hsm-api.service` on `APP001`
- Check `.env.runtime` / `PGOPTIONS` if tenant state looks wrong

## If Control Plane Is Affected
- Check `http://192.168.1.210/control-api/health`
- Check `hsm-control-api.service` on `APP001`

## Escalate To Host-Level Checks When
- deploy step failed
- public hosted app is unhealthy
- service restart is suspected
- `/control/` detail is no longer enough to explain the failure

## Resolution Gate
- root cause is understood
- retry/rerun succeeded if needed
- hosted public health is normal if app was affected
- environment/job state in `/control/` matches reality
