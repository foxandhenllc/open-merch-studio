# Support

Open Merch Studio is maintained by Fox & Hen. The maintainers review changes and decide which
commits become releases. Work in the repository may be ahead of the deployed reference store.
The package version is currently 0.1.0; it does not establish that a corresponding release tag
or V1 release has been published. See [Changelog](./CHANGELOG.md) and the [V1 contract](./docs/launch/v1-release-contract.md).

## Running your own store

Start with [Getting started](./docs/getting-started.md), [Deployment](./DEPLOYMENT.md), and
the [owner setup guide](./frontend/public/admin/setup-guide.txt). The fixture demo needs no provider
account. Initial live installation still requires hosting, storage/database, account verification,
and merchant-specific configuration. Normal owner controls do not make those steps automatic.

For a reproducible bug, use the repository's bug-report issue template. Include the source commit,
Node/npm versions, fixture or provider mode, steps, and redacted error text. Reproduce with fixtures
when possible. Community support is best effort, with no promised response time or uptime SLA.
Do not include .env files, artwork access links, provider identifiers, order bearer values, or
customer information. Report security problems through [SECURITY.md](./SECURITY.md).

## Store customer questions

For an order, use the support contact on the store where you placed it. A store operator's refunds,
delivery commitments, and customer support are separate from software-maintainer support. Do not
post order or shipping details in this repository.

## Paid implementation

[Fox & Hen](https://foxandhenllc.com/merch) can scope a store build, custom workflow, supervised launch,
and optional care. Scope, price, operating responsibilities, and response commitments belong in that
engagement. The source remains available independently of purchasing services.

## Maintenance

The current security policy covers main and active release branches. There is no published long-term
support schedule or automatic-upgrade guarantee for merchant forks. Use the
[upgrade and recovery checklist](./docs/operations/upgrading.md) and test a candidate release against
your own installation before promotion. V1 requires an observed upgrade and restore rehearsal.
