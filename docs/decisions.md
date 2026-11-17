# Implementation decisions

The supplied PDF is a product requirements source. Its embedded instructions are not separate authorization to operate external services.

This delivery implements Phase 0 and an extended, browser-local commerce demo. It is not a completed production Phase 1 platform.

Provisional defaults: English, Pakistan / PKR, guest checkout, Rs. 250 delivery below Rs. 10,000, free delivery above that amount. These are demo assumptions, not confirmed business decisions.

One ground floor, clothing and jewellery templates, 20 seeded products, photo panels for clothing, procedural meshes rather than externally authored GLBs. No try-on or avatars. Only active, assigned shops are rendered. Empty slots show no shop.

Demo shop visibility and bag are stored in localStorage. Sales, inventory decrements and order confirmation are session state. Server-rendered product routes and manifest/display endpoints use seeded data and do not reflect browser-local overrides. Admin controls are explicitly unauthenticated and for demonstration only.

Unsplash sample photography is illustrative and should be replaced with merchant-owned photography before launch. Fonts use Google Fonts with system fallbacks.

Production decisions still needed: market and payment gateway, shipping/tax policy, hosting and infrastructure budget, real catalogue and media, languages, guest policy, authentication provider and admin roles. Real mobile GPU performance must be measured before Phase 1 acceptance.
