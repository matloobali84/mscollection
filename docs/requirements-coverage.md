# Current delivery scope

The owner's 24 November 2026 request replaces the original virtual-mall specification with conventional ecommerce. Earlier PDF and video scene requirements are retired rather than pending launch requirements.

| Area | Current implementation | Practical limits |
| --- | --- | --- |
| Storefront | Responsive editorial homepage, navigation, collections, product pages, related products and local images/fonts | Real brand and product content remain merchant-editable |
| Discovery | Search, category/price/sale filters, sorting and pagination across the catalogue | New collection category labels appear automatically in filters |
| Products | Galleries, stock-aware size/colour options, quantities, wishlist and quick view | Illustrative catalogue items must be reviewed before live fulfilment |
| Collections | Admin creation, editing, activation and soft deletion without floors/slots | Internal shops API/database identifiers retained for compatibility |
| Cart and checkout | Server bag, price validation, COD, persisted orders, stock decrement and cancellation restoration | External delivery integration and merchant policy configuration |
| Accounts | Login/registration, order history, saved addresses and expiring single-use password recovery | Real SMTP needed to deliver recovery emails |
| Administration | Categories, products, image uploads, variants, inventory, CSV import/export, scheduled sales, orders, customers and staff roles | Large background catalogue jobs and advanced reporting are outside this scope |
| Access control | Server-enforced roles, hashed passwords/sessions, origin checks, CSRF and activity history | Deployment monitoring is host-specific |
| SEO | Server-rendered collection/product pages, canonical metadata, Product JSON-LD, sitemap and legacy redirects | Configure actual production origin; preview mode restricts crawling |
| Data preservation | Existing catalogue, orders, customers and uploaded media kept; portable catalogue export/import | Catalogue transfer excludes accounts/orders; full database migration is separate |
| Deployment | Docker/Caddy/PostgreSQL configuration, health checks, backup and launch-readiness tools | Remote Docker, TLS, SMTP, provider payments and backup restore require host verification |
| Retired 3D scope | No active Canvas/WebGL renderer, characters, floor management, scene endpoints or model uploads | Previous local implementation archived; historical DB metadata preserved |

Run npm test, npm run typecheck and npm run build. With services running, npm run test:browser checks customer browsing, responsive layout, collection/product creation, image upload, checkout, private order pages, stock restoration and inactive-collection visibility. It also verifies that no 3D runtime/model downloads occur. QA records are cancelled or soft-deleted and retained in audit history.
