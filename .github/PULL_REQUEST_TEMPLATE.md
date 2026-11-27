## Summary

Describe the change and its user or operator impact.

## Related Issues

Link the GitHub Issues addressed. Do not duplicate the full issue description here.

## Scope and safety

- [ ] No Production database, provider, DNS, deployment or secret was changed.
- [ ] No real credentials, connection strings, OTPs, customer data or private payloads were added.
- [ ] Existing RTL, SHAHOO branding, server authorization and transaction boundaries are preserved.
- [ ] Historical documents moved to the archive remain available; active code/tests/scripts were not deleted without reference checks.

## Verification

Record exact commands, environment and source SHA where relevant.

- [ ] Typecheck
- [ ] Lint
- [ ] Project tests
- [ ] Build
- [ ] PostgreSQL tests (state whether real PostgreSQL or PGlite)
- [ ] Platform-specific tests (Windows/Docker/browser, if applicable)
- [ ] Security/secret scan (state whether current tree only or full Git history)

For each unchecked item, state why it was not executed. Do not combine counts from different source snapshots.

## Remaining risk

List deferred checks, operational dependencies and any owner decision still required.
