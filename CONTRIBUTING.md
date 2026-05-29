# Contributing

Thanks for helping improve Open Merch Studio. The project is intended to stay public-safe, reproducible from a clean clone, and useful to small teams building custom merch workflows.

## Development Standards

- Keep provider credentials and private data out of the repository.
- Prefer fixture-backed tests for provider behavior.
- Document new environment variables in `.env.example` with empty values.
- Keep product-specific assumptions out of shared catalog, quote, and fulfillment logic.
- Run `npm run type-check` and `npm test` before opening a pull request.

## Pull Request Checklist

- The change is scoped to a clear catalog, design, pricing, checkout, docs, or infrastructure improvement.
- The app still runs without Printful, OpenAI, or Stripe credentials.
- Any new API endpoint has a small test or a clear manual verification note.
- Screenshots or recordings do not include private account data.
