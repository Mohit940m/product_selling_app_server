# MCP Server Integration Plan

> Plan for adding a **Model Context Protocol (MCP)** server to `product_selling_app_server`, so AI assistants can interact with this e-commerce backend through well-defined tools.

## 1. Overview

The **Model Context Protocol (MCP)** is an open standard that lets AI assistants call external tools, read resources, and use prompts through a uniform interface. Adding an MCP server to this project would let assistants (Claude Desktop, IDE agents, internal ops tooling, etc.) browse the catalog, inspect orders, manage a cart, and let sellers query/manage their products and offers — all by reusing the existing Express/Mongoose business logic instead of hand-rolling API calls.

## 2. Current architecture summary

This is a **vanilla e-commerce backend** written in **TypeScript** running on **Node.js** with ES modules (`"type": "module"` in `package.json`).

| Concern | Detail |
| --- | --- |
| Framework | **Express 5** (`src/server.ts`) |
| Database | **MongoDB via Mongoose 9** (`src/config/db.ts`) |
| Auth | **JWT** (`jsonwebtoken`), Bearer tokens, 30-day auth token expiry (`src/utils/jwt.ts`, `src/auth/auth.middleware.ts`) |
| OTP | Email OTP registration/login flow (`src/auth/otp.service.ts`, OTP models) |
| Caching | Optional **Redis** (`src/config/redis.ts`, toggled by `REDIS_ENABLED`) |
| Payments | **Razorpay** (`src/controllers/user.controllers/order.controller.ts`) |
| Image uploads | **Cloudinary** + Multer (`src/config/cloudinary.ts`, `src/middlewares/imageUploadHandler.ts`) |
| API docs | Swagger UI at `/api-docs` (`src/config/swagger.ts`) |
| Dev runner | `nodemon --exec tsx ./src/server.ts`; build via `tsc` |

### Structure

- **Entry point:** `src/server.ts` — mounts two route trees:
  - `app.use('/api/v1/user', userRoutes)` → `src/routes/user.routes/userRoute.ts`
  - `app.use('/api/v1/seller', sellerRoutes)` → `src/routes/seller.routes/sellerRoute.ts`
- **Routes:** `src/routes/user.routes/*` and `src/routes/seller.routes/*`
- **Controllers:** `src/controllers/user.controllers/*` and `src/controllers/seller.controllers/*`
- **Models:** `src/models/{productModels,orderModels,userModels,sellerModels}/*`
- **Shared services/utils:** `src/config/redis.ts` (`getCache`/`setCache`/`clearProductCache`), `src/utils/offer.util.ts` (`findApplicableOffers`), `src/auth/otp.service.ts` (`OtpService`)

### Key domain resources (from actual models)

- **Product** (`src/models/productModels/product.model.ts`): `name`, `description`, `category`, `images[]`, `variantTypes[]` (max 2, e.g. `["size","color"]`), `variants[]` (refs), `isActive`, `isDeleted`, `isFeatured`, `sellerId`.
- **Variant** (`variant.model.ts`): `productId`, auto-generated `sku`, `attributes` (`{ size, color }`), `price`, `stock`, `isActive`.
- **Order** (`src/models/orderModels/order.model.ts`): `orderId`, `user`, `items[]` (product/variant snapshot), `shippingAddress`, `paymentStatus` (`PENDING|PAID|FAILED|REFUNDED`), `orderStatus` (`CREATED|CONFIRMED|SHIPPED|OUT FOR DELIVERY|DELIVERED|CANCELLED`), `subTotal`, `discount`, `shippingCost`, `tax`, `totalAmount`, `appliedOffer`, `tracking`.
- **Payment** (`payment.model.ts`): Razorpay order/payment/signature IDs, `amount`, `currency`, `status`, `method`.
- **Cart** (`src/models/userModels/cart.model.ts`): `userId`, `items[]` (`productId`, `variantId`, `quantity`, `attributes`, `priceSnapshot`), `subTotal`, `discount`, `total`.
- **WishList** (`wishList.model.ts`): unique `userId` + `productId`.
- **User** (`user.model.ts`): `name`, `phone`, `email`, `profileImage`, `dob`, `gender`, verification flags, `defaultAddress`.
- **Address** (`address.model.ts`), **Offer** (`offer.model.ts`: types `BUY_GET|DISCOUNT|CASHBACK|PRODUCT_BUNDLE`), **SellerShipping** (`sellerShipping.model.ts`: zone-based rates + `calculateShipping()`), **Seller** + OTP models.

### Existing endpoints (actual, from route files)

**User** (`/api/v1/user`):
- `auth`: `POST /auth/register`, `POST /auth/verify-registration`, `POST /auth/login`, `POST /auth/verify-login`
- `products` (`optionalAuthUser`): `GET /products/get-all-products` (pagination, `category`, `search`, dynamic attribute filters like `size=M`), `GET /products/get-product/:productId`
- `cart` (auth): `POST /cart/add-to-cart`, `POST /cart/remove-from-cart`, `GET /cart/get-cart`
- `orders` (auth): `POST /orders/checkout`, `POST /orders/create-order`, `POST /orders/verify-payment`
- `wishlist` (auth): `POST /wishlist/add`, `GET /wishlist/`
- `profile` (auth): `GET /profile`, `PUT /profile`, `POST /profile/address`, `PUT /profile/address/:addressId`

**Seller** (`/api/v1/seller`):
- `auth`: `POST /auth/register`, `POST /auth/verify-registration`, `POST /auth/login`, `POST /auth/verify-login`
- `products` (auth): `GET /products/cloudinary-signature`, `POST /products/create-product`, `PUT /products/edit-product/:productId`, `PATCH /products/edit-product-status/:productId`, `PATCH /products/increase-stock/:productId`, `PATCH /products/edit-variant-price/:productId`, `PATCH /products/edit-variant-status/:productId`, `GET /products/get-all-products`, `GET /products/get-product/:productId`, `POST /products/add-variant/:productId`, `DELETE /products/delete-product/:productId`, `DELETE /products/delete-product-permanent/:productId`
- `shipping` (auth): `GET /shipping/get-shipping-config`, `POST /shipping/create-shipping-config`, `PUT /shipping/update-shipping-config`, `POST /shipping/calculate-shipping-cost`
- `offers` (auth): `POST /offers/create-offer`

## 3. Goals & scope

### Goals (v1)

Expose read-heavy and safe write operations that are valuable to an AI assistant:

- **Catalog browsing** (public): list/search products with filters, fetch a product with variants.
- **Buyer workflows** (authenticated user): view/manage cart, view wishlist, list own orders.
- **Seller workflows** (authenticated seller): list own products, view a product, check stock, view shipping config, calculate shipping cost.

### Out of scope for v1

- The **OTP-based registration/login flows** — these are stateful, email-driven, and better handled by a human (the MCP server should consume an already-issued JWT rather than orchestrating OTP).
- **Payment execution** (`create-order` → Razorpay → `verify-payment`) — money movement and signature verification are too risky to expose as an autonomous tool in v1. Optionally expose a **read-only** order/payment status tool instead.
- **Destructive seller operations** (`delete-product-permanent`) — excluded or gated behind explicit confirmation in a later version.
- File/image uploads via Cloudinary (multipart) — not a good fit for the initial tool surface.

> Note: some read tools below (e.g. "list my orders", "get order by id") map to functionality the current REST API does **not** yet expose as a dedicated endpoint. These are marked **(proposal — needs new controller/route)**.

## 4. Proposed MCP tools

Tools are grouped by audience. Each wraps existing controller logic or a proposed thin read endpoint. "Wraps" cites the real controller/route.

### Buyer / public tools

| Tool | Description | Underlying app functionality |
| --- | --- | --- |
| `search_products` | List/search products with `page`, `limit`, `category`, `search`, and dynamic attribute filters (e.g. `size`, `color`). | `getAllProducts` — `GET /api/v1/user/products/get-all-products` (`user.controllers/product.controller.ts`) |
| `get_product` | Get one product with its active variants and computed price. | `getProductById` — `GET /api/v1/user/products/get-product/:productId` |
| `get_cart` | Return the authenticated user's cart with items and totals. | `getCart` — `GET /api/v1/user/cart/get-cart` |
| `add_to_cart` | Add a product/variant + quantity to the cart. | `addToCart` — `POST /api/v1/user/cart/add-to-cart` |
| `remove_from_cart` | Remove an item from the cart. | `removeFromCart` — `POST /api/v1/user/cart/remove-from-cart` |
| `get_wishlist` | List the user's wishlist. | `getWishList` — `GET /api/v1/user/wishlist/` |
| `add_to_wishlist` | Add a product to the wishlist. | `addProductToWishList` — `POST /api/v1/user/wishlist/add` |
| `remove_from_wishlist` | Remove a product from the wishlist. | `removeProductFromWishList` — `DELETE /api/v1/user/wishlist/remove/:productId` |
| `get_profile` | Get the authenticated user's profile. | `getUserProfile` — `GET /api/v1/user/profile` |
| `list_my_orders` | List the current user's orders with status. | `getMyOrders` — `GET /api/v1/user/orders` |
| `get_order` | Get a single order (status, items, tracking) by `_id` or `orderId`. | `getMyOrderById` — `GET /api/v1/user/orders/:orderId` |

### Seller tools (require a seller JWT)

| Tool | Description | Underlying app functionality |
| --- | --- | --- |
| `seller_list_products` | List the seller's own products. | `getAllProducts` — `GET /api/v1/seller/products/get-all-products` (`seller.controllers/product.controller.ts`) |
| `seller_get_product` | Get one of the seller's products with variants. | `getProductById` — `GET /api/v1/seller/products/get-product/:productId` |
| `seller_increase_stock` | Increase stock for a product/variant. | `increaseStock` — `PATCH /api/v1/seller/products/increase-stock/:productId` |
| `seller_edit_variant_price` | Update a variant's price. | `editVariantPrice` — `PATCH /api/v1/seller/products/edit-variant-price/:productId` |
| `seller_edit_product_status` | Activate/deactivate a product. | `editProductStatus` — `PATCH /api/v1/seller/products/edit-product-status/:productId` |
| `seller_get_shipping_config` | Read the seller's shipping zones/rates. | `getShippingConfig` — `GET /api/v1/seller/shipping/get-shipping-config` |
| `seller_calculate_shipping` | Calculate shipping cost to a destination. | `calculateShippingCost` — `POST /api/v1/seller/shipping/calculate-shipping-cost` |
| `seller_create_offer` *(gate behind confirmation)* | Create a promotional offer. | `createOffer` — `POST /api/v1/seller/offers/create-offer` |
| `seller_list_offers` | List the seller's promotional offers. | `getSellerOffers` — `GET /api/v1/seller/offers/` |
| `seller_edit_offer_status` | Enable/disable an offer. | `editOfferStatus` — `PATCH /api/v1/seller/offers/edit-offer-status/:offerId` |
| `seller_delete_offer` *(gate behind confirmation)* | Permanently delete an offer. | `deleteOffer` — `DELETE /api/v1/seller/offers/delete-offer/:offerId` |

> Write-heavy seller tools (`create-product`, `edit-product`, `add-variant`, `delete-product`) can be added incrementally once the read tools are validated. `delete-product-permanent` stays out of scope.

## 5. Proposed MCP resources / prompts

**Resources** (read-only, addressable content the assistant can pull into context):

- `catalog://categories` — distinct product categories (derived from the `category` field on `Product`).
- `product://{productId}` — a single product document rendered as JSON/Markdown (mirrors `get_product`).
- `order://{orderId}` — order summary (proposal; depends on the new read endpoint).
- `docs://openapi` — expose the existing Swagger/OpenAPI spec (already generated by `src/config/swagger.ts`) so assistants can self-describe the API surface.

**Prompts** (reusable templates):

- `draft_product_listing` — given a name/category/attributes, draft a product `description` and `variantTypes` suggestion for a seller.
- `explain_shipping_estimate` — given origin/destination, summarize the zone-based cost from `SellerShipping.calculateShipping()`.

## 6. Architecture & integration approach

**Recommended: a separate MCP package/process in the same repo** (e.g. `src/mcp/`), using the official **TypeScript SDK `@modelcontextprotocol/sdk`** — matching the project's Node/TS stack.

Two integration options for how tools reach the business logic:

1. **HTTP client to the existing Express API (recommended for v1).** The MCP server holds a base URL (`http://localhost:$PORT`) and a Bearer JWT, and calls the real REST endpoints listed above. Pros: zero duplication, reuses auth middleware, validation, Redis caching, and offer logic exactly as production does; the MCP layer stays thin. Cons: requires the API to be running.
2. **Embedded / direct service reuse.** Import controllers/models directly (`connectDB()` + call model queries or refactored service functions). Pros: no network hop. Cons: controllers are written against Express `req`/`res` and would need refactoring into framework-agnostic service functions first; also needs its own Mongo/Redis connection lifecycle.

> Start with **option 1** (HTTP wrapper). If latency or coupling becomes a problem, refactor shared controller bodies into service functions under `src/services/` that both Express and MCP import (option 2).

**Transport:**
- **stdio** for local/desktop assistant integration (Claude Desktop, IDE agents) — simplest, no network exposure.
- **Streamable HTTP / SSE** transport as a later addition if the MCP server needs to be hosted for remote clients (would require its own auth on the MCP endpoint).

**Runtime:** ship as an npm script (e.g. `npm run mcp`) run with `tsx`, consistent with the existing `dev` script.

## 7. Authentication & security considerations

- The app authenticates via **JWT Bearer tokens** (`Authorization: Bearer <token>`), verified in `authenticateUser` / `authenticateSeller` (`src/auth/auth.middleware.ts`) using `JWT_SECRET`. Auth tokens are minted by `generateAuthToken` with `{ id: userId }` and a 30-day expiry (`src/utils/jwt.ts`).
- **Token provisioning:** the MCP server should receive a pre-issued JWT via environment/config (e.g. `MCP_API_TOKEN`, plus `MCP_API_BASE_URL`), **not** perform the OTP login flow. Each MCP session acts as one user or one seller.
- **Least privilege:** keep buyer and seller tools separated; a buyer token must not be wired to seller tools. Consider two configs (user vs seller) or scope tools by which token is present.
- **Never log tokens** or forward `JWT_SECRET`, Razorpay keys, or Cloudinary secrets into tool outputs.
- **Confirmation gating:** any state-changing tool (cart writes, stock/price edits, offer creation) should be flagged so the assistant/host asks for confirmation. Payment execution stays out of scope (Section 3).
- **Transport exposure:** prefer stdio locally. If HTTP transport is added, protect the MCP endpoint itself (network isolation or an auth layer) — do not expose it publicly unauthenticated.
- **CORS/rate limits:** the API currently allows `origin: '*'` (`src/server.ts`); the MCP server calling it locally is unaffected, but rate limiting is worth adding before any hosted deployment.

## 8. Implementation steps

1. **Decide integration mode** (HTTP wrapper vs embedded) — recommend HTTP wrapper for v1.
2. **Add dependency:** `npm i @modelcontextprotocol/sdk` (and `zod` for input schemas, if not transitively present).
3. **Scaffold** `src/mcp/` with `server.ts`, a typed HTTP client, and a `tools/` folder.
4. **Config/env:** add `MCP_API_BASE_URL` and `MCP_API_TOKEN` (buyer) / seller token to `.env.example`.
5. **Implement read tools first:** `search_products`, `get_product`, `get_cart`, `get_wishlist`, `get_profile`, `seller_list_products`, `seller_get_product`, `seller_get_shipping_config`, `seller_calculate_shipping`. Define Zod input schemas matching the actual query/body params.
6. **Add safe write tools:** `add_to_cart`, `remove_from_cart`, `add_to_wishlist`, `seller_increase_stock`, `seller_edit_variant_price`, `seller_edit_product_status` — each marked as state-changing.
7. **(Optional) Add new read endpoints** for `list_my_orders` / `get_order` in a new controller (e.g. `user.controllers/order.controller.ts` additions + `order.routes.ts`), then wire the corresponding tools.
8. **Expose resources/prompts** (Section 5), including `docs://openapi` from the existing Swagger config.
9. **Wire stdio transport** and add an `npm run mcp` script (`tsx ./src/mcp/server.ts`).
10. **Test with MCP Inspector** (Section 10) and against the running API.
11. **Document** setup (env vars, how to obtain a JWT, example client config) in `docs/`.
12. **(Later)** add Streamable HTTP transport + endpoint auth for remote hosting.

## 9. Directory / file layout

Proposed new files (nothing existing is modified except `package.json` scripts/deps and `.env.example`):

```text
src/
  mcp/
    server.ts              # MCP server bootstrap + transport (stdio)
    client/
      apiClient.ts         # thin fetch wrapper: base URL + Bearer token, error mapping
    tools/
      products.tools.ts    # search_products, get_product
      cart.tools.ts        # get_cart, add_to_cart, remove_from_cart
      wishlist.tools.ts    # get_wishlist, add_to_wishlist
      profile.tools.ts     # get_profile
      orders.tools.ts      # list_my_orders, get_order
      seller.tools.ts      # seller_* product/shipping/offer tools
    resources/
      catalog.resource.ts  # categories, product://, docs://openapi
    prompts/
      prompts.ts           # draft_product_listing, explain_shipping_estimate
    schemas/
      inputs.ts            # Zod schemas mirroring real query/body params
docs/
  mcp-server-plan.md       # this document
  mcp-server-usage.md      # (to be written) setup + client config
```

`package.json` additions (illustrative):

```json
{
  "scripts": {
    "mcp": "tsx ./src/mcp/server.ts"
  }
}
```

## 10. Testing & validation

- **MCP Inspector** (`npx @modelcontextprotocol/inspector`): launch the server over stdio, confirm each tool/resource/prompt is listed with correct input schemas, and invoke them interactively.
- **Live API preflight:** start the backend (`npm run dev`) with a valid `MONGO_URI`; seed at least one seller, product with variants, and a user; mint a JWT to use as `MCP_API_TOKEN`.
- **Per-tool checks:** verify `search_products` honors `category`/`search`/attribute filters and pagination; `get_product` returns variants + min price; cart write tools mutate and reflect in `get_cart`; seller tools reject a buyer token (and vice versa).
- **Auth failure paths:** confirm expired/invalid token surfaces as a clean tool error (401 from `auth.middleware.ts`), not a crash.
- **Regression:** ensure the MCP package does not import Express request/response types incorrectly and that `tsc` build still passes.
- **(Optional) integration tests:** a lightweight script that starts the API against a test Mongo instance and exercises tools end-to-end.

## 11. Open questions / decisions

1. **Integration mode:** ship the HTTP-wrapper approach for v1, or invest upfront in refactoring controllers into reusable services (`src/services/`) for embedded direct calls?
2. ~~**Order read endpoints:** add thin "list my orders" / "get order by id" endpoints, or defer those tools?~~ Resolved: `GET /api/v1/user/orders` and `GET /api/v1/user/orders/:orderId` now exist and both tools are wired.
3. **Token model:** one JWT per MCP session (single user/seller identity), or a mechanism to switch identities? How are tokens rotated given the 30-day expiry?
4. **Seller write surface:** how far to go in v1 — read-only, or include `increase-stock` / price / status edits? Where to draw the confirmation line?
5. **Payments:** keep entirely out of scope, or expose a **read-only** order/payment status tool (no Razorpay execution)?
6. **Hosting:** stdio-only for local assistants, or is a hosted Streamable-HTTP deployment needed (which requires MCP-endpoint auth and tighter CORS/rate limiting)?
7. **Redis dependency:** the MCP HTTP wrapper inherits caching transparently; if embedded mode is chosen later, decide whether the MCP process shares the Redis connection.
