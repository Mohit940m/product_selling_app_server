import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerProductTools } from './tools/products.tools.js';
import { registerCartTools } from './tools/cart.tools.js';
import { registerWishlistTools } from './tools/wishlist.tools.js';
import { registerProfileTools } from './tools/profile.tools.js';
import { registerSellerTools } from './tools/seller.tools.js';
import { API_BASE_URL } from './config.js';

/**
 * MCP server for product_selling_app_server.
 *
 * Exposes the e-commerce backend's capabilities as MCP tools over a stdio
 * transport. It is a thin HTTP wrapper around the existing REST API (see
 * docs/mcp-server-plan.md), reusing the app's JWT auth, validation, caching
 * and offer logic. Configure MCP_API_BASE_URL, MCP_API_TOKEN (buyer) and
 * MCP_SELLER_API_TOKEN (seller) in the environment.
 *
 * Only tools backed by existing endpoints are registered. The plan's
 * `list_my_orders` / `get_order` tools are intentionally omitted because no
 * corresponding REST endpoint exists yet.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'product-selling-app-mcp',
    version: '1.0.0',
  });

  // Public / buyer tools
  registerProductTools(server);
  registerCartTools(server);
  registerWishlistTools(server);
  registerProfileTools(server);

  // Seller tools
  registerSellerTools(server);

  return server;
}

async function main(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdout is reserved for the MCP protocol; log to stderr.
  console.error(`MCP server connected (stdio). API base URL: ${API_BASE_URL}`);
}

main().catch((err) => {
  console.error('Fatal error starting MCP server:', err);
  process.exit(1);
});
