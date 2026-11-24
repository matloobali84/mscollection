# Deploy the storefront and admin on Vercel

Create two Vercel projects from the same GitHub repository and production branch `main`. Their checked-in `vercel.json` files configure installation and Next.js builds. Select Node.js 22 for both projects. Enable **Include source files outside of the Root Directory in the Build Step** so the apps can import `packages/shared`.

| Project | Root directory | Framework | Install command | Build command |
| --- | --- | --- | --- | --- |
| Storefront | `apps/web` | Next.js | `npm ci` | `npm run build` |
| Administration | `apps/admin` | Next.js | `npm ci` | `npm run build` |

Use the checked-in install command without a relative `--prefix`. npm detects the workspace root and its committed `package-lock.json` whether the command starts at the repository root or inside either app. A relative prefix can point outside the checkout during Vercel's install step and fail with `EUSAGE` / a missing lockfile. If the project dashboard has an old Install Command override, change it to `npm ci` too. Deploy the latest `main` commit rather than redeploying the earlier failed commit.

Vercel documentation: [monorepos](https://vercel.com/docs/monorepos), [monorepo FAQ](https://vercel.com/docs/monorepos/monorepo-faq).

## Deploy and configure the API first

The current Fastify service starts database migrations and a durable mail worker and uses uploaded media. Keep it on a persistent Node/Docker host with standalone PostgreSQL and either a persistent media volume or S3-compatible storage. The existing [deployment guide](go-live.md) includes the Docker configuration and catalogue-transfer commands. Vercel also [supports Fastify](https://vercel.com/docs/frameworks/backend/fastify), but moving this API there requires adapting its worker, bootstrap and filesystem behavior; the two Next.js configurations do not perform that migration.

Set real API credentials privately on the hosting service. At minimum configure `DATABASE_URL`, `ADMIN_EMAIL`, a strong `ADMIN_PASSWORD`, `NODE_ENV=production`, `API_HOST=0.0.0.0`, `API_PORT`, `WEB_ORIGIN` and `APP_ORIGINS`. `APP_ORIGINS` must include both final storefront and admin HTTPS origins. Configure image storage and SMTP there too. Allow API traffic from the Vercel apps. Verify `/health` before deploying the storefront.

The embedded development database and `.data/media` are ignored by Git. GitHub import alone does not transfer the local 24 collections and 384 products. Run `npm run catalogue:export` locally, then transfer its catalogue and media privately to the freshly seeded backend as described in [go-live.md](go-live.md). This catalogue bootstrap excludes existing accounts/orders; migrating those requires a separate full database transfer. Keep the current installation intact.

## Storefront environment variables

Set these for the Production environment before building. Replace the example origins with the actual deployed URLs.

| Variable | Example value | Purpose |
| --- | --- | --- |
| `API_INTERNAL_URL` | `https://api.example.com` | Server catalogue reads, API and media rewrites; must be reachable during requests |
| `WEB_ORIGIN` | `https://mscollection.vercel.app` | Canonical URLs, sitemap and structured product data |
| `NEXT_PUBLIC_ADMIN_URL` | `https://mscollection-admin.vercel.app` | Administration link |

## Admin environment variables

| Variable | Example value | Purpose |
| --- | --- | --- |
| `API_INTERNAL_URL` | `https://api.example.com` | Admin API and media rewrites |
| `NEXT_PUBLIC_STOREFRONT_URL` | `https://mscollection.vercel.app` | Links back to the storefront |
| `ADMIN_BASE_PATH` | leave unset | Admin uses its own Vercel project/domain; `/admin` is only for the Docker ingress topology |

Set `API_INTERNAL_URL` at build time as Next.js generates rewrites during the build. Redeploy after changing any of these values. Use stable production project domains rather than a commit-specific preview URL. Do not add backend passwords, SMTP credentials or database URLs to public `NEXT_PUBLIC_` variables.

For Preview deployments use a separate test database/API and configure its allowed origins. Avoid pointing unreviewed previews at the live commerce database.

## Verify before opening orders

1. Sign in to Admin with the backend's production owner account.
2. Verify collections, product images, variants, prices and stock after catalogue transfer.
3. Place a test COD order, confirm it in Admin, then cancel it and check stock restoration.
4. Verify password recovery through real SMTP and confirm support/policy details.
5. Review **Launch readiness** and switch the store to live mode when actual inventory and business details are ready.

The GitHub push and Vercel project import are separate operations. No live Vercel deployment is created by these configuration files alone.
