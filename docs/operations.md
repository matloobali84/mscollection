# Running and operating MS Collection

## Local workspace

Run `npm install`, `npm run setup`, then `npm run dev` from the repository root. Node.js 20.9 or newer is required. Setup creates an ignored `.env` with random local infrastructure passwords, migrates/seeds the database, and writes the initial owner login to `.data/initial-admin.txt`. Setup is repeatable and does not reset data or change the owner password.

The launcher runs the customer site at http://localhost:3000, the separate admin app at http://localhost:3001, and the API at http://localhost:4000. Interactive API documentation: http://localhost:4000/docs. Health check: http://localhost:4000/health. Use the same hostname consistently for cookies. Stop the launcher with Ctrl+C. Individual commands are `npm run dev:web`, `npm run dev:admin`, and `npm run dev:api`.

Local data is PostgreSQL running through PGlite, persisted in `.data/postgres`. It supports the same SQL migrations as standalone PostgreSQL. It is a single-process development database; do not open a second API/management process against it. The local API also runs the durable email outbox worker. Without SMTP credentials, email messages are written privately to `.data/mail/*.eml`; they are not sent to real addresses.

## Production topology

The previous Sites URL is the earlier static prototype. This server-backed platform requires deployments of the API, customer Next.js server and admin Next.js server, plus PostgreSQL. It is not published to that static URL. Do not use `scripts/build-static.cjs`: static export is intentionally disabled so a disconnected catalogue cannot masquerade as a working store.

Use `compose.yaml` for local PostgreSQL, Redis, Mailpit and MinIO when Docker is installed. Run `docker compose up -d`. Set `DATABASE_URL=postgresql://mscollection:<POSTGRES_PASSWORD>@localhost:5432/mscollection` in `.env`, then run `npm run setup`. This seeds a new standalone database; it does not automatically transfer the embedded database. Mailpit UI is port 8025; configure `SMTP_HOST=127.0.0.1` and `SMTP_PORT=1025`. Configure MinIO's bucket and public media policy explicitly. Never expose database, Redis, Mailpit or MinIO administration ports publicly.

For deployment, set `NODE_ENV=production`, `DATABASE_URL`, explicit `APP_ORIGINS`, `WEB_ORIGIN`, `API_INTERNAL_URL`, `NEXT_PUBLIC_ADMIN_URL`, SMTP configuration and S3 media settings. Set `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD` before first production seed. Use TLS at the ingress/reverse proxy: production session cookies are Secure. Run `npm run build`, then `npm start`, or deploy each app independently using its workspace start script. Run the API on an appropriate private `API_HOST` and route requests through the configured Next.js rewrites. The admin app is a separate service with its own login.

When `REDIS_URL` is configured, the durable email outbox is delivered through BullMQ. Without Redis the API drains its SQL outbox directly. Catalogue reads query the database; the retired scene manifest/cache is no longer used. A separate `npm run worker` process requires standalone PostgreSQL. Set `RUN_WORKER=false` on the API if using that separate worker. Outbox records use claim leases and retries. SMTP delivery is at least once: a process failure after delivery but before acknowledgement can send a duplicate.

## Commerce configuration

Country and currency are editable under **Store settings**. The owner confirmed Pakistan / PKR and WhatsApp support +923114803618. No currency conversion is performed when changing the currency code. Configure prices, taxes, delivery fees and the free-shipping threshold before accepting customer orders. Existing order items and totals remain snapshots in their purchase currency.

Cash on delivery creates real persisted orders and decrements variant stock transactionally. Marking a COD order delivered records payment as collected. Cancellation/refund restocks once. Status transitions are validated server-side. Online orders cannot be fulfilled before signed provider confirmation.

The optional Stripe adapter uses hosted Checkout. Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and `WEB_ORIGIN` to enable it. Configure Stripe to send `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `checkout.session.expired` to `/api/v1/payments/webhook`. The endpoint checks the raw-body signature, deduplicates event IDs and verifies currency/amount. Browser redirects never confirm payment. Test with Stripe test keys before using live keys. No live gateway credentials were provided and no live charge was tested. Stripe may not be available for the selected merchant country; confirm that country first. Online refunds require provider reconciliation; they are deliberately blocked in the generic admin status action.

## Administration and media

The owner controls collections, categories, products/variants/images, sales, orders, customers, staff and settings. Managers manage catalogue and orders; editors manage products, categories and sales only. Authorization is checked on every admin API route. Cookie-authenticated writes require origin checks, a custom verification header and a session CSRF token. Passwords are bcrypt-hashed; session tokens are stored as hashes. Session expiry is seven days. Changing staff credentials, role or active status invalidates that staff member's sessions. Keep at least one active owner.

Products have draft/active/archived statuses and soft deletion. Collection deletion hides its products while preserving their records. Collections need no spatial assignment. CSV exports quote fields and neutralize spreadsheet formulas. Imports validate all rows and run in one database transaction. Use the export as the import template. Limit: 500 products / 1.5 MB per import. Existing product IDs update records; leave ID empty for a new product.

Image uploads accept JPEG/PNG/WebP/AVIF, up to 10 MB and 24 million pixels. Sharp validates and re-encodes to 256/512/1024 WebP images. Local uploads are served under `/media/` for development. Production supports an explicitly enabled persistent local-media volume (`LOCAL_MEDIA_STORAGE=true`) or S3-compatible storage with `S3_BUCKET`, `S3_PUBLIC_URL`, region/endpoint and standard AWS credentials. Configure a CDN/public read policy for re-encoded assets; never expose credentials. Unsplash seed photographs remain illustrative.

## Backups and verification

Embedded mode: stop the API, then run `npm run db:backup`. The backup copies the persisted database to `.data/backups/<timestamp>`. Verify restoration by copying a backup to a separate directory and running the API with `DATA_DIR` pointing to that copy on another port. Keep the original database untouched. Media and local email directories require separate backups. Backups contain customer information and password hashes and must be protected.

Standalone mode: use `pg_dump` / `pg_restore` against a separate restore database, and enable object-storage backups/versioning. Verify order counts, order-item totals, inventory, staff access and image URLs after restore. Test a restore against the chosen database infrastructure before launch.

Run `npm test`, `npm run typecheck`, `npm run build`, and (with all three services running) `npm run test:browser`. The browser check requires Chrome; override its path with `CHROME_PATH`. It creates a temporary QA collection/product/order, verifies the full flow and soft-deletes/cancels its records. Audit history remains. Physical Android/iPhone performance, external SMTP, S3, Redis and live Stripe are environment-specific checks and have not been certified here.

Before public launch, finish brand/product content and legal policies, merchant onboarding, configured uptime/error monitoring, real-device performance checks, tax/shipping rules and backup automation. The code provides structured request/error logs and a health endpoint; no 99.5% uptime guarantee is asserted by a local setup.

## Updated launch package

See [go-live.md](go-live.md) for the Docker stack, same-domain `/admin` hosting, persistent media, protected catalogue transfer and backup commands. Password recovery is implemented with hashed, expiring, single-use email tokens and revokes existing customer sessions. Customer support and policy content are editable in Store settings. The production owner-only launch view reports configuration gaps; real SMTP, domain/TLS, inventory content and hosting verification still require the actual services.
