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
- Design and implement section-based shared course scheduling so one course can have multiple resource groups/time slots and students enroll into a specific shared section.
- Add a configurable school day start time, likely under School Year settings, instead of hard-coding the scheduling day to begin at `8:00 AM`.
