# Negative-Test Report — product_selling_app_server

**Date:** 2026-09-16
**Branch:** `mcp`
**Method:** Live HTTP tests against the running Express API, backed by a throwaway local MongoDB (`mongodb://127.0.0.1:27017/negtest_server`, Redis disabled). Real buyer/seller accounts were provisioned through the OTP flow (the API returns the OTP in the response for demo purposes), then every failure path was exercised and the HTTP status asserted.

## Summary

| Suite | Tests | Pass | Notes |
|-------|-------|------|-------|
| Auth / token rejection | 7 | 7 | |
| User auth validation | 8 | 8 | |
| Seller auth validation | 6 | 6 | |
| Public product | 3 | 3 | |
| Malformed JSON body | 1 | 1 | |
| Cart | 10 | 10 | |
| Wishlist | 6 | 6 | |
| Profile / address | 2 | 2 | |
| Order flow | 5 | 5 | |
| Seller product (cross-tenant + validation) | 11 | 11 | |
| Seller offers / shipping / orders | 10 | 10 | |
| Cross-audience tokens | 3 | 3 | |
| Offers tenant isolation | 2 | 2 | |
| MCP HTTP endpoint | 4 | 4 | |
| Unknown route | 1 | 1 | |
| **Total** | **79** | **79** | 0 defects |

`tsc --noEmit`: clean (exit 0).

## What was verified

### Authentication & authorization
- Missing header, wrong scheme (`Token …`), and a syntactically invalid JWT are all rejected with **401** on user and seller protected routes.
- **Cross-audience isolation:** a buyer JWT on any `/seller/*` route → **401**, and a seller JWT on `/user/*` (cart, profile) → **401**. Both tokens share the `{ id }` payload shape and the same `JWT_SECRET`; the separation is enforced by each middleware loading the account from its own collection.
- **Cross-tenant (seller ↔ seller):** seller 2 cannot view, deactivate, or delete seller 1's product (all **404**, matching the "not found or unauthorized" pattern). Seller-scoped offer listing returns only the caller's own offers.

### Input validation (bad request → 400, not 500)
Confirmed the app returns **400** (not a Mongoose `CastError` surfaced as 500) for:
- Cart add/remove with missing or malformed `productId`/`variantId`, quantity `0` / negative.
- Wishlist add/remove with missing/malformed id.
- `PUT /profile/address/:id` with a malformed `addressId`.
- Seller `increase-stock` (negative/zero), `edit-variant-price` (zero/negative), `add-variant` (bad price / missing attributes), `edit-variant-status` (malformed variantId).
- Offer `edit-offer-status` (malformed id, non-boolean `isActive`), `delete-offer` (malformed id), `create-offer` (missing fields).
- Shipping `create-shipping-config` (missing origin), `calculate-shipping-cost` (missing destination).
- Malformed JSON request body → **400** (Express body-parser).

### Business rules
- Add-to-cart over available stock (`10 > 3`) → **400**; adding within stock succeeds; adding again so the cart total would exceed stock (`2 + 2 > 3`) → **400**.
- Wishlist duplicate add → **400**; removing an item not present → **404**.
- Checkout with no address → **400**; create-order with an empty cart → **400**; verify-payment with missing Razorpay fields → **400**.
- Unknown but well-formed ObjectId on product / order / offer lookups → **404**.

### MCP HTTP surface (`/mcp/user`, `/mcp/seller`)
- POST without a bearer token → **401** with a JSON-RPC error envelope.
- `GET` / `DELETE` on the stateless endpoints → **405** (method not allowed).

## Observations (pre-existing, documented gaps — not defects found here)
These are already called out in code comments / `CLAUDE.md` and were **not** in scope to fix:
- No rate limiting on any route, including auth/OTP (documented in `server.ts`).
- OTP model and Cart model each have a documented non-unique-index race.
- `orderId` / variant `sku` collision windows under high concurrency.
- Offer `usageLimit` / `perUserLimit` are stored but not enforced.
- Stock oversell between the create-order check and post-payment deduction is mitigated (guarded `$inc`) but oversold-unit business policy is unresolved.

## How to reproduce
```bash
# from product_selling_app_server/
MONGO_URI="mongodb://127.0.0.1:27017/negtest_server" REDIS_ENABLED=false PORT=4000 npx tsx src/server.ts
# then drive the negative suites with curl as documented above
```
