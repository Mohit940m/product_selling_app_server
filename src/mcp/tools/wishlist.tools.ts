import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiRequest } from '../client/apiClient.js';
import { USER_TOKEN } from '../config.js';
import { jsonResult, runTool } from './helpers.js';

/**
 * Authenticated buyer wishlist tools (require MCP_API_TOKEN).
 *
 * - get_wishlist     -> GET  /api/v1/user/wishlist/
 * - add_to_wishlist  -> POST /api/v1/user/wishlist/add (state-changing)
 */
export function registerWishlistTools(server: McpServer): void {
  server.registerTool(
    'get_wishlist',
    {
      title: 'Get wishlist',
      description: "List the authenticated user's wishlist with populated product summaries.",
      inputSchema: {},
    },
    async () =>
      runTool(async () => {
        const data = await apiRequest({
          method: 'GET',
          path: '/api/v1/user/wishlist/',
          token: USER_TOKEN,
        });
        return jsonResult(data);
      }),
  );

  server.registerTool(
    'add_to_wishlist',
    {
      title: 'Add to wishlist',
      description:
        'Add a product to the wishlist. State-changing: confirm with the user before calling.',
      inputSchema: {
        productId: z.string().describe('The product _id to add.'),
      },
    },
    async ({ productId }) =>
      runTool(async () => {
        const data = await apiRequest({
          method: 'POST',
          path: '/api/v1/user/wishlist/add',
          token: USER_TOKEN,
          body: { productId },
        });
        return jsonResult(data);
      }),
  );
}
