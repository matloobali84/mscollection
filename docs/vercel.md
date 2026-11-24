# MS Collection on Vercel

The storefront now runs the existing Fastify commerce API inside a Next.js Node Route Handler, backed by external PostgreSQL and public Blob storage. The separate admin project proxies API requests to the storefront. A separate always-on API server is not required for this topology.

## Projects

| Application | Project | Root directory | Production URL |
| --- | --- | --- | --- |
| Storefront and API | mscollection-web | apps/web | https://mscollection-web.vercel.app |
| Admin | mscollection | apps/admin | https://mscollection-rouge.vercel.app |

Both use Next.js, Node.js 22, install command `npm ci`, build command `npm run build` and output directory `.next`. Include source files outside the root directory. The app manifests declare their workspace dependencies. Deploy the latest main commit; do not rerun an old failed commit with a relative --prefix override.

The previous duplicate imports remain intact. Their root directories and install commands have been corrected; they proxy the same primary API rather than owning separate databases.

## Production services and environment

The Neon Free resource mscollection-db and public Blob store mscollection-products belong to the same Vercel team. Production credentials are injected into mscollection-web through their project connections. Keep secrets in Vercel and ignored .data files. Never put them in NEXT_PUBLIC variables.

| Project | Variable | Value |
| --- | --- | --- |
| Storefront | DATABASE_URL | Neon connection, injected by integration |
| Storefront | BLOB_READ_WRITE_TOKEN | Blob credential, injected by connection |
| Storefront | WEB_ORIGIN | https://mscollection-web.vercel.app |
| Storefront | NEXT_PUBLIC_ADMIN_URL | https://mscollection-rouge.vercel.app |
| Storefront | APP_ORIGINS | Actual storefront and admin HTTPS origins |
| Storefront | TRUST_PROXY | 1 |
| Storefront | API_INTERNAL_URL | Leave unset to use the integrated API |
| Admin | API_INTERNAL_URL | https://mscollection-web.vercel.app |
| Admin | NEXT_PUBLIC_STOREFRONT_URL | https://mscollection-web.vercel.app |
| Admin | NEXT_PUBLIC_MAX_IMAGE_MB | 4 |
| Admin | ADMIN_BASE_PATH | Leave unset; admin has its own project/domain |

Changing build-time rewrites or public variables requires a new deployment. For previews, use a separate test database/API; do not attach unreviewed previews to production commerce data.

## Bootstrap and catalogue transfer

The database is bootstrapped separately, not during function cold starts. The local development database remains intact. Catalogue transfer excludes customer accounts, orders and sessions.

1. Link the CLI to the storefront project and pull its production environment into ignored .data/vercel-production.env.
2. Run `npm run catalogue:export` against the local API.
3. Run `npm run deploy:bootstrap` once against the freshly provisioned production database.

The bootstrap script requires external PostgreSQL and Blob credentials, applies migrations, seeds the owner, transfers media with a resumable private URL map, and imports the catalogue transactionally. It refuses a database with customer/order or custom catalogue data. It never opens or overwrites local PGlite. Owner login is saved privately to .data/production-admin.txt; no password belongs in this document.

Future database migrations must also run as an explicit deployment task against production before publishing code that needs them. Do not rerun bootstrap over an operating store.

## Runtime behavior

- Existing cart, checkout, stock locks, idempotency, access tokens, admin roles and CSRF checks are reused.
- HTTP methods, binary request bodies and separate Set-Cookie headers pass through the Node adapter. API responses are not cached.
- Product images are re-encoded and uploaded to Blob. Admin limits Vercel image uploads to 4 MB to stay within the function request limit. The standalone API retains its 10 MB limit.
- No embedded database, local media directory, migration, initial seed or recurring interval runs inside the hosted API.
- Email jobs remain durable in PostgreSQL. With actual SMTP configured, Next.js after() drains the outbox following writes. Without SMTP, email delivery and password-reset delivery remain unconfigured; jobs are retained rather than reported as sent.
- Cash on delivery works without gateway credentials. Online payments require an eligible provider account and signed webhook configuration.

## Verify

Run `npm test`, `npm run typecheck`, `npm run build`, and browser QA. The browser script accepts STOREFRONT_URL and ADMIN_URL for testing the actual deployment. It creates a temporary collection/product/order, verifies image uploads, checkout, order links and stock restoration, then cancels and soft-deletes its QA records.

Review Launch readiness, actual inventory and store policies before accepting real fulfilment commitments. SMTP, a real support email and merchant-authored policies require the business's actual details. The store retains its truthful sample-inventory label until reviewed.

References: [Vercel monorepos](https://vercel.com/docs/monorepos), [storage integrations](https://vercel.com/docs/marketplace-storage), [Blob](https://vercel.com/docs/vercel-blob), [Next.js Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route), [after](https://nextjs.org/docs/app/api-reference/functions/after).
