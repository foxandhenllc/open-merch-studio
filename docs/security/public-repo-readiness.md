# Public Repository Readiness

Before publishing:

- Confirm `.env`, `.env.*`, local database dumps, provider exports, screenshots, and private account artifacts are untracked.
- Run type-checks, tests, build, and a public-safety scan.
- Review all screenshots and docs for customer data, provider account IDs, payment pages, and private order information.
- Keep legacy staging-domain references out of public copy unless a temporary staging note explicitly needs them.
- Keep private local filesystem paths, deployment/team links, and database project references out of
  public launch evidence.
- After explicit open-source launch approval, verify canonical public routes use `index,follow`, the
  temporary global `X-Robots-Tag` gate is absent, and `robots.txt` points to the branded canonical
  sitemap. Keep the custom 404 page `noindex` and keep payment and fulfillment authorization governed
  by their independent server-side gates.
- Retain a path-specific `X-Robots-Tag` on `/api/*` so provider-accessible artwork and JSON responses
  remain excluded from search and image indexes.
- When live AI is public, reserve estimated OpenAI and background-removal spend in PostgreSQL before
  each provider call. Fail closed if the reservation cannot be stored, and pair the durable daily and
  per-session budgets with edge rate limits before materially increasing traffic.
