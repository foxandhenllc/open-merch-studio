# Deployment

Open Merch Studio can be deployed as a split frontend/backend app or as separate services.

## Required Production Inputs

- PostgreSQL database URL
- Public frontend URL
- Backend API URL

## Optional Provider Inputs

- Printful bearer value and store ID for live catalog sync and fulfillment
- OpenAI key for provider-backed design generation
- Stripe key and webhook signing value for checkout

Store all provider values in deployment-managed storage. Do not commit provider values or screenshots of provider dashboards.

## Release Gate

Before public deployment:

```bash
npm run type-check
npm test
npm run build
```

Run a manual catalog quote smoke test with fixture mode, then again with provider sandbox credentials if production integrations are enabled.
