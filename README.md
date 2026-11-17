# MS Collection virtual shopping mall

A Next.js / TypeScript Phase 0 implementation based on the supplied 17-page requirements PDF. Includes a procedural React Three Fiber mall, clothing and jewellery interiors, 20 products, classic view, search and filters, wishlist, variant-aware local bag, demo checkout and shop/sale studio.

## Run

Node.js 20.9+ required.

```sh
npm install
npm run dev
```

Open http://localhost:3000. Production: `npm run build` then `npm start`. Verify business rules: `npm test`.

Create a static hosting bundle with `node scripts/build-static.cjs` (output: `dist/`). The private Sites deployment uses this bundle; API responses are exported seed snapshots.

## Structure

- `apps/web`: customer app, SSR product/shop routes, demo studio, manifest/display API.
- `packages/shared`: product data, shared schemas and sale/visibility rules.
- `packages/mall-scenes`: procedural Three.js scenes. Anchor groups: `rack_NN`, `shelf_NN`, `sale_NN` in the display API.
- `docs/decisions.md`: assumptions, scope and limitations.

## Delivery status

This is a functioning prototype, not a production commerce system. No real charges or shipments are created. Shop visibility and cart persist only in this browser; sales and orders are session-only. API and SEO pages expose the seed catalogue. No secure admin authentication, PostgreSQL, Redis, S3 media pipeline, transactional inventory, gateway webhooks or email provider is connected. Do not use the demo studio for production management.

Before public commerce launch, implement the Phase 1 backend and separate authenticated admin app described in the PDF, replace sample photography, and perform iOS Safari / Android Chrome performance and accessibility testing. The target 30 fps and download budgets have not been certified on physical devices.
