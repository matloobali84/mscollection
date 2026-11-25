# MS Collection

A conventional ecommerce website with an editorial storefront, collection and product pages, customer accounts, a separate admin panel, a Fastify API and persistent PostgreSQL data.

The 24 November 2026 redesign replaces the former virtual mall. There is no active 3D renderer, character navigation, floor selection or GLB upload. Existing products, collections, uploaded media, customers, orders and inventory are preserved. The previous implementation is archived locally under ignored outputs/retired-mall/.

## Run locally

Requires Node.js 20.9 or newer and npm.

```sh
npm install
npm run setup
npm run dev
```

- Storefront: http://localhost:3000
- Administration: http://localhost:3001
- API documentation: http://localhost:4000/docs

Setup is repeatable. It writes the initial owner login to private .data/initial-admin.txt and persists development PostgreSQL through PGlite in .data/postgres. Do not run a second API process against the same embedded database.

Admin accepts an email address or, for internal `@mscollection.local` accounts, the username before `@`. Customer sign-in continues to require an email address. Current owner credentials are stored only in ignored local files.

## Shopping and administration

The storefront includes responsive navigation, collection pages, search, category/price/sale filters, sorting, product galleries and variants, wishlist, server-backed bag, checkout, private order links, customer accounts, saved addresses and password recovery. Product photos and fonts are served locally. Admin manages collections, categories, products/images/variants, inventory, scheduled sales, orders, customers, staff roles, policies and store settings.

The current catalogue contains 24 collections and 384 products, including illustrative inventory. Pakistan / PKR and WhatsApp +923114803618 are configured. Review sample content, real stock, prices and policies before accepting customer orders. Cash on delivery works; external email and online payments require the actual service credentials. Without SMTP, local emails are written to private .data/mail/ rather than delivered externally.

## Verify and build

```sh
npm test
npm run typecheck
npm run build
npm start
```

With the three services running, use npm run test:browser. Browser QA requires Chrome (override CHROME_PATH if necessary). It checks the storefront, mobile layout, collection creation without spatial fields, image upload, checkout, order visibility and stock restoration. Temporary QA products/collections are soft-deleted and orders cancelled; audit history remains.

## Project structure

```text
apps/web         Next.js customer storefront
apps/admin       Next.js administration
apps/api         Fastify, database migrations and integrations
packages/shared  Validation and commerce rules
scripts          Setup, checks, backups and catalogue transfer
deploy           Production container and ingress configuration
```

See [operations](docs/operations.md), [Vercel setup for website and admin](docs/vercel.md), [Docker deployment](docs/go-live.md) and [scope](docs/requirements-coverage.md). The Vercel topology runs commerce inside the storefront Node functions with external PostgreSQL and Blob; the earlier hosted static prototype is separate. Sample-photo attribution is retained in [sample-catalogue-license.txt](docs/sample-catalogue-license.txt).
