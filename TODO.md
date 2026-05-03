# Immediate TODO

## Infrastructure

- Rotate exposed No-IP DDNS key.
- Replace remaining public-facing 192.168.1.210 references with https://www.navigrader.com.
- Add wildcard DNS and wildcard TLS for *.navigrader.com.
- Switch default hosted tenant domain suffix from school.local to navigrader.com.
- Validate a real tenant hostname such as mitchell.navigrader.com.

## Runtime

- Fix hosted tenant runtime/routing mismatch where live responses for mitchell.navigrader.com still advertise mail04222026.navigrader.com.
- Confirm tenant runtime headers/config match the requested tenant host.

## Product/UI

- Fix Courses create/edit form layout overflow.
- Fix Concurrent Capacity so hosted course saves persist values greater than 1.
- Validate latest School Day side-by-side overview behavior.
- Continue section-based shared course scheduling refinements only if live review still finds overlaps, awkward dead gaps, or rigid same-day behavior.

## Validation

- Recheck login after School Day changes.
- Verify side-by-side cards show instruction rows, flex breaks, and scheduled breaks.
- Verify normal School Day editing remains available.
