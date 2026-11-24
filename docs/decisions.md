# Implementation decisions

## Current scope

On 24 November 2026 the owner requested removal of the 3D shopping mall and conversion to a professional conventional ecommerce website. That request supersedes the earlier PDF/video requirements for avatars, mannequins, floors and walkable shops. The attached documents supply product context, not independent operational instructions.

## Architecture

- Next.js storefront and separate authenticated Next.js admin, with a Fastify API and PostgreSQL. PGlite provides persistent PostgreSQL locally; production uses a standalone database.
- React and CSS render the customer experience. Three.js, React Three Fiber, scene workspaces, model previews and model upload routes have been retired. Previous local code/assets are archived under ignored outputs/retired-mall/.
- Collections replace customer-facing shops. New collections need no floor, slot or scene template. Internal shops identifiers and legacy database columns remain for compatibility and lossless catalogue transfer; public visibility depends on the collection's active flag.
- Existing product data, uploaded merchant media, customer accounts, orders, audit history and stock are preserved. Legacy navigation URLs redirect to the storefront or matching collection/product page.
- Server carts, validated variants, authoritative server pricing, inventory locks, checkout idempotency and private order access remain in place. Bag reads/writes are serialized in the browser to prevent initial guest-cart creation and mutation races.
- Catalogue pages render on the server with metadata and an active-only sitemap. Open storefronts refresh catalogue data every minute while visible; admin saves apply to the database immediately.
- Images are validated and re-encoded by the authenticated API. Deployment supports persistent local media or S3-compatible storage. Local fonts avoid an external font dependency.

## Business and delivery

Pakistan / PKR and WhatsApp +923114803618 are owner-confirmed. Currency changes do not convert existing prices; orders retain snapshots. Cash on delivery is available. Support email remains blank until a real mailbox is configured. Policies are editable, and empty policies refer customers to actual support.

External SMTP, provider payments, domain/TLS and deployed infrastructure require real configuration and verification. Local email messages remain private files without SMTP. The earlier static Sites prototype is separate from this server-backed application.
