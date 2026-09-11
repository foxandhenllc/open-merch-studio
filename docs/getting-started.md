# Try Open Merch Studio without provider accounts

Use a fresh checkout for this walkthrough. The local fixture mode simulates artwork and commerce;
it creates no paid provider request, payment, or fulfillment order. The public reference storefront
is a separate deployment and is not this fixture environment.

## Start the local demo

Install Git and a Node version manager, then clone your fork or this repository. From its root:

```bash
nvm use
npm ci
cp .env.example backend/.env
cp .env.example frontend/.env
npm run doctor
npm run db:generate
npm run dev
```

The copy commands are for a fresh checkout; do not overwrite existing configuration. If nvm reports
that the declared version is missing, run `nvm install`, then repeat `nvm use`. The root
package-lock.json is the installation authority. Use the npm version declared in package.json
(currently 10.9.2).

The template deliberately leaves DATABASE_URL and provider credentials empty. Doctor should say
fixture-ready. `db:generate` generates the Prisma client; it does not provision or migrate a database.
Open the local URL Vite prints, normally http://localhost:5173. The backend uses port 5001.

Try a supplied artwork upload, product/placement preview, and the simulated checkout. Fixture images,
shipping, prices, and order states demonstrate interaction contracts, not live provider output.
Browser state can survive reload; database-free server records reset when the server restarts.

## Try owner controls

Set a randomly generated ADMIN_ACCESS_CODE in your ignored backend/.env, restart the backend, and
open `/admin`. Enter that code there. There is no default administrator password. Never put it in
a VITE variable, URL, repository file, or screenshot.

Try Store profile and its preview, policy drafts, model selection, and budgets. Database-free
settings are explicitly labeled temporary. Provider saving/publication needs the deployment bridge;
the local form does not provision hosting or establish provider accounts.

## If something stops you

| Symptom | Next step |
| --- | --- |
| Node check fails | Use the exact version in .nvmrc, then rerun npm ci. |
| Database connection fails during the demo | Confirm DATABASE_URL is empty in the demo environment and restart the backend. |
| API cannot be reached | Check the backend terminal and port 5001. Keep VITE_API_URL empty for the local Vite proxy. |
| Vite chooses a different port | Use its printed URL and align FRONTEND_URL in the backend configuration. |
| Admin asks for access | Set ADMIN_ACCESS_CODE on the server; sign in again after reloading. |
| A connection says saved, but behavior is unchanged | Hosting values require a successful new deployment. Saved is not active. |

See [Support](../SUPPORT.md) for a safe bug report. For your own real store, continue to
[Deployment](../DEPLOYMENT.md). Hosting, database/storage, domains, provider verification, and policy
approval are still explicit setup work. A nontechnical end-to-end installation study remains a V1 gate.

## Verify the checkout

```bash
npm run lint
npm run type-check
npm test
npm run build
npm run test:browser
```

`npm run config:rehearse-admin` installs maintained source in a temporary directory and proves a
distinct admin-published profile reaches the compiled store. `npm run config:rehearse` uses Git-indexed
files and therefore requires all required new source files to be tracked. Neither command launches
a real store or contacts paid providers. A successful agent rehearsal does not measure human setup time.
