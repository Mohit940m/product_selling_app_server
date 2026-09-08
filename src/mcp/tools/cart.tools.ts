import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiRequest } from '../client/apiClient.js';
import { USER_TOKEN } from '../config.js';
import { jsonResult, runTool } from './helpers.js';

/**
 * Authenticated buyer cart tools (require MCP_API_TOKEN).
 *
 * - get_cart          -> GET  /api/v1/user/cart/get-cart
 * - add_to_cart       -> POST /api/v1/user/cart/add-to-cart      (state-changing)
 * - remove_from_cart  -> POST /api/v1/user/cart/remove-from-cart (state-changing)
 */
export function registerCartTools(server: McpServer): void {
  server.registerTool(
    'get_cart',
    {
      title: 'Get cart',
      description:
        "Return the authenticated user's cart with items, offers and recalculated totals.",
      inputSchema: {},
    },
    async () =>
      runTool(async () => {
        const data = await apiRequest({
          method: 'GET',
          path: '/api/v1/user/cart/get-cart',
          token: USER_TOKEN,
        });
        return jsonResult(data);
      }),
  );

  server.registerTool(
    'add_to_cart',
    {
      title: 'Add to cart',
      description:
        'Add a product/variant with a quantity to the cart. State-changing: confirm with the user before calling.',
      inputSchema: {
        productId: z.string().describe('The product _id.'),
        variantId: z.string().describe('The variant _id.'),
        quantity: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Quantity to add (default 1).'),
      },
    },
    async ({ productId, variantId, quantity }) =>
      runTool(async () => {
        const data = await apiRequest({
          method: 'POST',
          path: '/api/v1/user/cart/add-to-cart',
          token: USER_TOKEN,
          body: { productId, variantId, quantity },
        });
        return jsonResult(data);
      }),
  );

  server.registerTool(
    'remove_from_cart',
    {
      title: 'Remove from cart',
      description:
        'Remove a quantity of a product/variant from the cart (defaults to removing 1). State-changing: confirm with the user before calling.',
      inputSchema: {
        productId: z.string().describe('The product _id.'),
        variantId: z.string().describe('The variant _id.'),
        quantity: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Quantity to remove (default 1; removing >= current removes the item).'),
      },
    },
    async ({ productId, variantId, quantity }) =>
      runTool(async () => {
        const data = await apiRequest({
          method: 'POST',
          path: '/api/v1/user/cart/remove-from-cart',
          token: USER_TOKEN,
          body: { productId, variantId, quantity },
        });
        return jsonResult(data);
      }),
  );
}
