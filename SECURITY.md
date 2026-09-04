# Security Policy

## Supported Versions

The `main` branch and active release branches receive security fixes.

## Reporting

Open a [private GitHub security advisory](https://github.com/foxandhenllc/open-merch-studio/security/advisories/new) or use the support contact published by the app. Do not open a public issue for exploitable vulnerabilities or leaked credentials.

## Repository Safety Rules

- Do not commit provider credentials, session cookies, private customer data, payment exports, payment screenshots, or account identifiers.
- Keep `.env`, `.env.*`, local database dumps, and generated provider artifacts ignored.
- Use fixture data for tests and screenshots.
- Rotate any credential that may have been committed, logged, or shared.
- Treat customer order-access values as bearer credentials: store only their digest server-side,
  send them only in the `Authorization` header, and revoke them through the protected operator API.
