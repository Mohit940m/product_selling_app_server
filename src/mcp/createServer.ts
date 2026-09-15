import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpAudience, ToolContext } from './context.js';
import { registerProductTools } from './tools/products.tools.js';
import { registerCartTools } from './tools/cart.tools.js';
import { registerWishlistTools } from './tools/wishlist.tools.js';
import { registerProfileTools } from './tools/profile.tools.js';
import { registerOrderTools } from './tools/orders.tools.js';
import { registerSellerTools } from './tools/seller.tools.js';

/**
 * MCP server for product_selling_app_server: a thin wrapper around the REST
 * API (see docs/mcp-server-plan.md and docs/MCP_HTTP_PLAN.md), so auth,
 * validation, caching and offer logic are reused as-is. Only tools backed by
 * existing endpoints are registered.
 */
export function createMcpServer(ctx: ToolContext, audience: McpAudience = 'all'): McpServer {
  const server = new McpServer({
    name: 'product-selling-app-mcp',
    version: '1.1.0',
  });

  if (audience === 'user' || audience === 'all') {
    registerProductTools(server, ctx);
    registerCartTools(server, ctx);
    registerWishlistTools(server, ctx);
    registerProfileTools(server, ctx);
    registerOrderTools(server, ctx);
  }

  if (audience === 'seller' || audience === 'all') {
    registerSellerTools(server, ctx);
  }

  return server;
}
