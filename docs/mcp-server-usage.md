# MCP Server — Setup & Usage

This repo ships an MCP (Model Context Protocol) server under `src/mcp/` that
exposes the e-commerce backend's capabilities as MCP tools. See
[`mcp-server-plan.md`](./mcp-server-plan.md) for the design rationale.

## How it works

The MCP server is a **thin HTTP wrapper** around the existing REST API. It does
not talk to MongoDB directly; it calls the running Express app with a pre-issued
JWT, so it reuses the app's auth middleware, validation, Redis caching and offer
logic exactly as production does. Two transports:

- **stdio** (`npm run mcp`) — for local desktop/IDE assistants; one buyer and
  one seller identity from env tokens.
- **Streamable HTTP** on the running API — `POST /mcp/user` (buyer tools) and
  `POST /mcp/seller` (seller tools). Stateless: every request must send
  `Authorization: Bearer <that user's JWT>` and the tools act as that caller.
  This is what `product_selling_app_agent` uses. The token is passed straight
  to the REST API, which does the real auth check; the path decides which
  tools are available because buyer and seller JWTs look alike. `GET`/`DELETE`
  return 405.

```ts
const transport = new StreamableHTTPClientTransport(new URL("http://localhost:4000/mcp/user"), {
  requestInit: { headers: { Authorization: `Bearer ${userJwt}` } },
});
```

Because it is an HTTP wrapper, the API must be running for the tools to work:

```bash
npm run dev   # start the API (needs a valid MONGO_URI, JWT_SECRET, etc.)
```

## Configuration

Environment variables (see `.env.example`):

| Variable | Purpose |
| --- | --- |
| `MCP_API_BASE_URL` | Base URL of the running API. Defaults to `http://localhost:${PORT}`. |
| `MCP_API_TOKEN` | stdio only: pre-issued **buyer** JWT for buyer/public tools. Optional. |
| `MCP_SELLER_API_TOKEN` | stdio only: pre-issued **seller** JWT for seller tools. Optional. |

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
- `remove_from_wishlist` *(write)* — `DELETE /api/v1/user/wishlist/remove/:productId`
- `get_profile` — `GET /api/v1/user/profile`
- `list_my_orders` — `GET /api/v1/user/orders` (paid/refunded only unless `includeUnpaid`)
- `get_order` — `GET /api/v1/user/orders/:orderId` (Mongo `_id`, `ORD-...` id or item `subOrderId`)
- `checkout_summary` — `POST /api/v1/user/orders/checkout` (prices the cart with the default or given address; places nothing)

**Seller** (use `MCP_SELLER_API_TOKEN`):

- `seller_list_products` — `GET /api/v1/seller/products/get-all-products`
- `seller_get_product` — `GET /api/v1/seller/products/get-product/:productId`
- `seller_increase_stock` *(write)* — `PATCH /api/v1/seller/products/increase-stock/:productId`
- `seller_edit_variant_price` *(write)* — `PATCH /api/v1/seller/products/edit-variant-price/:productId`
- `seller_edit_product_status` *(write)* — `PATCH /api/v1/seller/products/edit-product-status/:productId`
- `seller_get_shipping_config` — `GET /api/v1/seller/shipping/get-shipping-config`
- `seller_calculate_shipping` — `POST /api/v1/seller/shipping/calculate-shipping-cost`
- `seller_create_offer` *(write)* — `POST /api/v1/seller/offers/create-offer`
- `seller_list_offers` — `GET /api/v1/seller/offers/`
- `seller_edit_offer_status` *(write)* — `PATCH /api/v1/seller/offers/edit-offer-status/:offerId`
- `seller_delete_offer` *(write, permanent)* — `DELETE /api/v1/seller/offers/delete-offer/:offerId`
- `seller_create_product` *(write)* — `POST /api/v1/seller/products/create-product` (JSON; `imageUrls` must already be uploaded, e.g. via the admin app's signed Cloudinary upload)
- `seller_add_variant` *(write)* — `POST /api/v1/seller/products/add-variant/:productId`
- `seller_edit_variant_status` *(write)* — `PATCH /api/v1/seller/products/edit-variant-status/:productId`
- `seller_list_orders` — `GET /api/v1/seller/orders`
- `seller_get_order` — `GET /api/v1/seller/orders/:orderId`
- `seller_update_order_item_status` *(write)* — `PATCH /api/v1/seller/orders/:orderId/items/:subOrderId/status`

Every tool carries MCP annotations: `readOnlyHint: false` on writes (and
`destructiveHint: true` on removals/deletes), set from one list in
`src/mcp/createServer.ts`. Hosts should confirm writes with the user.

## Not implemented (yet)

- Payment execution (`create-order` / `verify-payment`), OTP auth, file
  uploads through MCP, and product deletes are out of scope (see the plan,
  section 3).
- MCP resources and prompts from the plan (section 5) are not implemented in
  this version.

## Testing with MCP Inspector

```bash
npx @modelcontextprotocol/inspector npm run mcp:dev
```

Confirm the tools list matches the table above, then invoke tools against a
running API with seeded data and valid JWTs.
