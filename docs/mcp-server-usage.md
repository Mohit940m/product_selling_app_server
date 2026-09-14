# MCP Server — Setup & Usage

This repo ships an MCP (Model Context Protocol) server under `src/mcp/` that
exposes the e-commerce backend's capabilities as MCP tools. See
[`mcp-server-plan.md`](./mcp-server-plan.md) for the design rationale.

## How it works

The MCP server is a **thin HTTP wrapper** around the existing REST API. It does
not talk to MongoDB directly; it calls the running Express app with a pre-issued
JWT, so it reuses the app's auth middleware, validation, Redis caching and offer
logic exactly as production does. Transport is **stdio** (for local desktop/IDE
assistants).

Because it is an HTTP wrapper, the API must be running for the tools to work:

```bash
npm run dev   # start the API (needs a valid MONGO_URI, JWT_SECRET, etc.)
```

## Configuration

Environment variables (see `.env.example`):

| Variable | Purpose |
| --- | --- |
| `MCP_API_BASE_URL` | Base URL of the running API. Defaults to `http://localhost:${PORT}`. |
| `MCP_API_TOKEN` | Pre-issued **buyer** JWT for buyer/public tools. Optional. |
| `MCP_SELLER_API_TOKEN` | Pre-issued **seller** JWT for seller tools. Optional. |

The server does **not** run the OTP login flow; provide an already-issued JWT
(minted by the app's login/verify flow). Public catalog tools work without a
token; authenticated tools return a clear error if their token is missing.

## Running

```bash
# Dev (ts, no build step)
npm run mcp:dev

# From a build
npm run build
npm run mcp
```

## Tools

**Buyer / public** (use `MCP_API_TOKEN`; `search_products` / `get_product` also
work anonymously):

- `search_products` — `GET /api/v1/user/products/get-all-products`
- `get_product` — `GET /api/v1/user/products/get-product/:productId`
- `get_cart` — `GET /api/v1/user/cart/get-cart`
- `add_to_cart` *(write)* — `POST /api/v1/user/cart/add-to-cart`
- `remove_from_cart` *(write)* — `POST /api/v1/user/cart/remove-from-cart`
- `get_wishlist` — `GET /api/v1/user/wishlist/`
- `add_to_wishlist` *(write)* — `POST /api/v1/user/wishlist/add`
- `get_profile` — `GET /api/v1/user/profile`

**Seller** (use `MCP_SELLER_API_TOKEN`):

- `seller_list_products` — `GET /api/v1/seller/products/get-all-products`
- `seller_get_product` — `GET /api/v1/seller/products/get-product/:productId`
- `seller_increase_stock` *(write)* — `PATCH /api/v1/seller/products/increase-stock/:productId`
- `seller_edit_variant_price` *(write)* — `PATCH /api/v1/seller/products/edit-variant-price/:productId`
- `seller_edit_product_status` *(write)* — `PATCH /api/v1/seller/products/edit-product-status/:productId`
- `seller_get_shipping_config` — `GET /api/v1/seller/shipping/get-shipping-config`
- `seller_calculate_shipping` — `POST /api/v1/seller/shipping/calculate-shipping-cost`
- `seller_create_offer` *(write)* — `POST /api/v1/seller/offers/create-offer`

Write tools are documented as state-changing so a host can gate them behind
confirmation.

## Not implemented (yet)

- `list_my_orders` / `get_order` — the plan flags these as proposals; the REST
  API has no "list my orders" / "get order by id" endpoint, so these tools are
  intentionally omitted until such endpoints exist.
- Payment execution (`create-order` / `verify-payment`), OTP auth, image
  uploads, and destructive deletes are out of scope (see the plan, section 3).
- MCP resources and prompts from the plan (section 5) are not implemented in
  this version.

## Testing with MCP Inspector

```bash
npx @modelcontextprotocol/inspector npm run mcp:dev
```

Confirm the tools list matches the table above, then invoke tools against a
running API with seeded data and valid JWTs.
