# TODO

- Rotate the No-IP DDNS key because it was exposed during setup troubleshooting.
- Finish Stripe on `https://www.navigrader.com`, including public return URLs and webhook validation.
- Replace remaining public-facing `192.168.1.210` references with `https://www.navigrader.com`.
- Add wildcard DNS and wildcard TLS for `*.navigrader.com`.
- Switch the default hosted tenant domain suffix from `school.local` to `navigrader.com`.
- Validate a real tenant hostname such as `mitchell.navigrader.com`.
- Fix the `Courses` create/edit form layout after the new resource fields landed; the current hosted UI overflows its framing and wraps helper text awkwardly in narrow space.
- Fix the hosted tenant runtime/routing mismatch where live responses for `mitchell.navigrader.com` still advertise `mail04222026.navigrader.com` in runtime headers/config.
- Fix the `Concurrent Capacity` field so hosted course saves persist values greater than `1`; right now non-`1` entries fall back to `Unrestricted`.
- Validate the latest School Day side-by-side overview fix: login must still work, and side-by-side cards must show instruction rows, flex breaks, and scheduled breaks without hiding normal School Day editing.
- Continue refining section-based shared course scheduling only if live review still finds overlaps, awkward dead gaps, or same-day shared-class behavior that feels too rigid.
