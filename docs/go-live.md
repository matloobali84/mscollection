# MS Collection: deployment handoff

The working application is the Next.js customer site, Next.js admin, Fastify API and PostgreSQL database. The older Sites static preview is a separate prototype. This package preserves the complete server-backed store; it does not publish a disconnected static catalogue.

## Current local state

- Pakistan / PKR, WhatsApp support `+923114803618`.
- 24 active collections and 384 products, including illustrative inventory.
- Conventional responsive storefront with collection/product pages, search, filters, wishlist and checkout; the 3D mall has been retired.
- Accounts, saved addresses, server carts, COD orders, inventory updates, admin roles, password recovery, customer-care pages and launch-readiness view.
- All catalogue product photos and UI fonts are served locally. Product media is processed by authenticated uploads.
- The catalogue is demonstration inventory. Replace illustrative photos, prices and stock with the actual goods you will fulfil. Review store policies before taking real orders.

The owner supplied a WhatsApp number and approved Pakistan/PKR. No real email mailbox, SMTP credentials, domain ownership or hosting account connection has been supplied. “Admin” is not a complete deliverable email address; email is editable in Store settings and is not fabricated in the public site. Delivery, return, privacy and terms text is editable there too. Empty policy pages direct customers to actual support instead of inventing merchant commitments.

## Production stack on a Linux VPS

The root `compose.production.yaml` runs five services: PostgreSQL, API, storefront, admin and a Caddy ingress. Only ports 80/443 are published. Database and media have persistent volumes. Public customer and admin traffic share the domain; admin is under `/admin`. The app image runs as an unprivileged Node user.

The stack uses health checks and `service_healthy` dependencies so the API waits for PostgreSQL and Next.js waits for the API. See [Docker startup-order documentation](https://docs.docker.com/compose/how-tos/startup-order/). Caddy routes the public paths to their services using the [documented reverse-proxy configuration](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy). DNS and inbound ports must be configured on the actual host before TLS can be verified.

1. Put the source checkout on a server with Docker Engine and Compose. Copy `.env.production.example` to ignored `.env.production` on that server.
2. Set your actual domain, TLS contact address, strong unique database/owner passwords, owner email and SMTP credentials. Use a URL-safe database password. Leave Stripe blank for COD-only operation. Never paste secret values into chat or commit the real environment file.
3. Point the domain at the VPS, then start:

```sh
docker compose --env-file .env.production -f compose.production.yaml up -d --build
docker compose --env-file .env.production -f compose.production.yaml ps
```

The API migrates the fresh database and creates its owner account from the configured credentials. The storefront is `https://YOUR_DOMAIN/`; admin is `https://YOUR_DOMAIN/admin`. The Compose deployment explicitly enables the persistent local-media provider. Retain its volume and back it up; use the existing S3 provider if deploying multiple API instances or external object storage.

### Transfer the current catalogue

From this local running installation:

```sh
npm run catalogue:export
```

Copy `outputs/deployment-catalogue/` to the server. It contains the store settings, catalogue and referenced uploaded media. It intentionally excludes customer accounts, orders and owner credentials. A real existing customer database needs a separate full database migration; this tool is only a catalogue bootstrap.

On a freshly seeded deployment, before adding customers or new products:

```sh
docker compose --env-file .env.production -f compose.production.yaml exec -T api mkdir -p /app/.data/catalogue-import
docker compose --env-file .env.production -f compose.production.yaml cp outputs/deployment-catalogue/catalogue.json api:/app/.data/catalogue-import/catalogue.json
docker compose --env-file .env.production -f compose.production.yaml cp outputs/deployment-catalogue/media/. api:/app/.data/media/
docker compose --env-file .env.production -f compose.production.yaml exec -T api npm run catalogue:import -- /app/.data/catalogue-import/catalogue.json
```

Import validates records and runs in a transaction. It replaces only an empty/default seeded catalogue and refuses a database with customers, orders or custom shops/products. Invalid imports roll back. Existing local data is preserved.

### Open the store

Use **Admin → Launch readiness** to review the actual deployment. Fill store policies, verify support contact details, replace sample inventory and test a complete COD order and cancellation. Verify order email and a customer password-reset email using a real inbox. Configure store mode as `live` after reviewing the store; preview labels and the preview crawler restriction then change accordingly.

```sh
docker compose --env-file .env.production -f compose.production.yaml exec -T api npm run launch:check
```

The check exits with a nonzero status while configuration or preview-inventory review remains. It reports configuration, not guaranteed external delivery, payment settlement, performance or uptime. Online payments need eligible merchant/provider credentials and test/live verification; COD is already available.

### Backups

Run `sh deploy/backup.sh` from the deployed checkout to create a private PostgreSQL dump and media archive. Keep backups off the server too, schedule them in the chosen hosting environment, and test a restore into a separate database/volume. The script does not remove data or restore over the live database. Redis is optional and is not needed for the default SQL outbox worker.

## Managed hosting

Railway supports [Docker services](https://docs.railway.com/builds/dockerfiles), [PostgreSQL](https://docs.railway.com/databases/postgresql) and [persistent volumes](https://docs.railway.com/volumes), making it a compatible managed-hosting candidate for this stack. A connected account and provider-specific service URLs are required. The Docker build supports `API_INTERNAL_URL`, `ADMIN_BASE_PATH`, `NEXT_PUBLIC_ADMIN_URL` and `NEXT_PUBLIC_STOREFRONT_URL` build arguments; set them for the chosen service topology and keep runtime API/HTTPS origins consistent. A full Node/PostgreSQL hosting connection was not available during this work. The prior static Sites project has not been overwritten with a misleading store preview.

## Verification limits

Local automated API tests verify roles, CSRF, stock, checkout races, reset-token expiry/single use/session revocation, media-rate allowance and transactional catalogue import. Browser checks cover conventional product/collection pages, search, filters, wishlist, server cart, slot-free collection creation, image upload, COD checkout, order pages, stock restoration and mobile screens. Normal Next.js production builds and TypeScript checks run locally. Docker is not installed on this workstation, so the production Compose file has been parsed but the image, ingress TLS, remote PostgreSQL, real SMTP and provider payments still require verification on the chosen host. Physical-device performance/load testing and an operational backup restore remain deployment work.
