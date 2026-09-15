# MCP over HTTP for the Agent — Plan (branch `mcp`)

Master plan: `product_selling_app_agent/doc/MCP_AGENT_PLAN.md`.

## Problem
`src/mcp` runs over **stdio** with **one buyer + one seller token from env**.
The agent service serves many users, each with their own JWT, so it needs
an MCP endpoint where every request carries the caller's own token. Buyer
and seller JWTs have the same payload (`{ id }`), so the audience must come
from the URL, not the token.

## Design
- `POST /mcp/user` and `POST /mcp/seller` on the main Express app
  (`src/mcp/http.ts`), **stateless** Streamable HTTP
  (`sessionIdGenerator: undefined`): each request builds a fresh
  `McpServer`, connects a fresh transport, handles the request, closes.
- The bearer token is required and passed into the tools. Tools still call
  the REST API, so `authenticateUser` / `authenticateSeller` stay the only
  permission check (a buyer token on `/mcp/seller` fails with 401 there).
- `/mcp/user` registers buyer tools only; `/mcp/seller` seller tools only.
- `GET`/`DELETE /mcp/*` return 405 (no sessions to stream or close).
- stdio (`npm run mcp`) keeps working with the env tokens.
- `API_BASE_URL` for the HTTP transport defaults to this server itself
  (`http://localhost:${PORT}`).

## Steps — commit after each
1. **Plan** — this file.
2. **Token context refactor** — tools take a `ToolContext` (`userToken`,
   `sellerToken`) instead of importing env tokens; `createMcpServer(ctx,
   audience)`; stdio entry builds the context from env.
3. **HTTP transport** — `src/mcp/http.ts`, mounted in `server.ts`.
4. **New tools for the chats**
   - Buyer: `checkout_summary` (`POST /orders/checkout`, default address).
   - Seller: `seller_create_product` (JSON body with `productImagesURL`),
     `seller_add_variant`, `seller_edit_variant_status`,
     `seller_list_orders`, `seller_get_order`,
     `seller_update_order_item_status`.
   - Mark writes with MCP annotations (`readOnlyHint: false`) so the agent
     can gate them behind confirmation.
5. **Docs** — `docs/mcp-server-usage.md`, `.env.example`, route docs.

## Not changing
REST controllers, auth middleware, and business logic. The MCP layer stays a
thin wrapper.
