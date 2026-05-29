# Prisma

The schema models the public Open Merch Studio data surface:

- curated catalog categories
- catalog products and variants
- print placements and mockup styles
- price snapshots and catalog sync runs
- design assets, quotes, and order items

Run:

```bash
npm run db:generate --workspace open-merch-studio-backend
npm run db:push --workspace open-merch-studio-backend
npm run db:seed --workspace open-merch-studio-backend
```
