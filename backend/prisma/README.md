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
npm run db:migrate --workspace open-merch-studio-backend
npm run db:seed --workspace open-merch-studio-backend
```

Use committed migrations rather than `db push` for shared environments. Production applies them
from the repository root with:

```bash
npx prisma migrate deploy --schema backend/prisma/schema.prisma
```
