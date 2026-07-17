# Public Repository Readiness

Before publishing:

- Confirm `.env`, `.env.*`, local database dumps, provider exports, screenshots, and private account artifacts are untracked.
- Run type-checks, tests, build, and a public-safety scan.
- Review all screenshots and docs for customer data, provider account IDs, payment pages, and private order information.
- Keep legacy staging-domain references out of public copy unless a temporary staging note explicitly needs them.
- Keep private local filesystem paths, deployment/team links, and database project references out of
  public launch evidence.
- While launch review is incomplete, verify the HTML robots directive and `X-Robots-Tag` header both
  remain `noindex`. Keep `robots.txt` crawlable and pointed at the canonical sitemap so crawlers can
  observe the page-level noindex directives. Enable indexing only through the reviewed branded-domain
  cutover.
