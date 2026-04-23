# Immediate Follow-up 2026-04-23

## Courses Form Layout

- The `Courses` create/edit form needs a layout cleanup after the new `Resource Group` and `Concurrent Capacity` fields landed.
- In hosted mode the current form can overflow its framing, and the helper text wraps into a cramped narrow block.
- The next pass should keep the new fields but rebalance the form grid, spacing, and helper-text placement so the section reads cleanly on the live tenant UI.

## Hosted Runtime Routing

- There is still a hosted runtime/routing follow-up to resolve for all tenants.
- Live responses for `https://mitchell.navigrader.com` were still advertising `mail04222026.navigrader.com` in runtime headers/config during this session.
- The `/api/courses` login regression was patched with a shared schema-tolerant backend fix, but the tenant-runtime mapping/config issue is separate and still needs to be corrected in the hosted stack.
