# MS Collection storefront design

The November 2026 refresh uses white and cool gray surfaces, graphite text and a forest green accent. Bold sans serif headings, consistent controls and restrained card borders carry through the storefront, account, checkout and administration pages.

## Customer experience

- Search includes matching product suggestions and collection shortcuts. Filters support collection, category, price, availability and sale items, with removable applied filters.
- Product cards link to full product pages and offer a separate quick view. Product pages include ordered sizes, compatible color selections, image enlargement, stock information and mobile purchase controls.
- Mobile navigation, keyboard dismissal, focus containment and visible focus states are included in the shopping and administration dialogs.
- The homepage clothing rail displays real product photos on illustrated hangers, with prices, mobile scrolling, desktop arrows, quick view and product links. Admin product editors can select "Show on homepage clothing rail" and set Display order. Active, available selections appear first; when no selections exist, the rail offers clothing from the current catalogue. Transparent garment photos work best. Hidden collections and unavailable products are excluded.
- Bag and checkout display the existing server-calculated prices, delivery charges and stock. Account, order tracking, help pages and the administration dashboard share the refreshed typography and spacing.
- Sample inventory and unconfigured merchant policies remain identified; the design does not add invented reviews, payment methods or delivery promises.

## Campaign image

Generated using the built-in Image Generation tool in generation mode on 24 November 2026. This is general campaign artwork, not a photograph of a specific catalogue product. Existing product photographs remain unchanged.

Repository assets:

- `apps/web/public/images/everyday-campaign.webp` (1920 pixels wide)
- `apps/web/public/images/everyday-campaign-960.webp` (responsive variant)

Generation brief:

> Photorealistic ecommerce campaign hero in a bright, cool light-gray architectural studio with soft daylight and shadows. Two stylish South Asian adult models, around 28 years old: a woman in a charcoal draped casual outfit carrying a dark leather bag, and a man in an ivory knit polo, charcoal trousers and clean sneakers. Natural poses at different depths in the right 55% of the frame, three-quarter or full-body composition, realistic faces, hands, skin and fabric. Keep the left 45% as clean, uninterrupted pale cool-gray negative space for real website text and buttons. Minimal architectural steps at the far right. White, graphite, stone gray and subtle blue-gray palette. Professional editorial photography. No text, logos, watermark, border, collage or synthetic rendering. General campaign inspiration rather than a photograph of a catalogue SKU.

The original PNG was converted to WebP and resized for delivery; the composition was not edited.

## Verification

Run `npm run typecheck` and `npm run build` for compilation. `npm run test:ux` checks search, combined filters, keyboard navigation, product zoom, mobile layouts and administration dialogs. `npm run test:professional` exercises administration, product uploads, checkout and stock restoration; it creates and cleans up temporary test records.

Browser checks default to local ports 3000 and 3001. Set `STOREFRONT_URL` and `ADMIN_URL` to verify a deployment. Owner credentials are read from the ignored local `.data/initial-admin.txt` file and must never be committed.
