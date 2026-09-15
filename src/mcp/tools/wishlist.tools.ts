import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiRequest } from '../client/apiClient.js';
import type { ToolContext } from '../context.js';
import { jsonResult, runTool } from './helpers.js';

/**
 * Authenticated buyer wishlist tools (require MCP_API_TOKEN).
 *
 * - get_wishlist        -> GET    /api/v1/user/wishlist/
 * - add_to_wishlist     -> POST   /api/v1/user/wishlist/add (state-changing)
 * - remove_from_wishlist -> DELETE /api/v1/user/wishlist/remove/:productId (state-changing)
 */
export function registerWishlistTools(server: McpServer, ctx: ToolContext): void {
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
          token: ctx.userToken,
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
          token: ctx.userToken,
          body: { productId },
        });
        return jsonResult(data);
      }),
  );

  server.registerTool(
    'remove_from_wishlist',
    {
      title: 'Remove from wishlist',
      description:
        'Remove a product from the wishlist. State-changing: confirm with the user before calling.',
      inputSchema: {
        productId: z.string().describe('The product _id to remove.'),
      },
    },
    async ({ productId }) =>
      runTool(async () => {
        const data = await apiRequest({
          method: 'DELETE',
          path: `/api/v1/user/wishlist/remove/${encodeURIComponent(productId)}`,
          token: ctx.userToken,
        });
        return jsonResult(data);
      }),
  );
}
