import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiRequest } from '../client/apiClient.js';
import { USER_TOKEN } from '../config.js';
import { jsonResult, runTool } from './helpers.js';

/**
 * Authenticated buyer order tools (require MCP_API_TOKEN). Read-only;
 * payment execution stays out of scope.
 *
 * - list_my_orders -> GET /api/v1/user/orders
 * - get_order      -> GET /api/v1/user/orders/:orderId
 */
export function registerOrderTools(server: McpServer): void {
  server.registerTool(
    'list_my_orders',
    {
      title: 'List my orders',
      description:
        "List the authenticated user's orders, newest first. Only paid/refunded orders unless includeUnpaid is true.",
      inputSchema: {
        page: z.number().int().positive().optional().describe('Page number (default 1).'),
        limit: z.number().int().positive().max(50).optional().describe('Items per page (default 10, max 50).'),
        includeUnpaid: z
          .boolean()
          .optional()
          .describe('Also include PENDING/FAILED orders (e.g. abandoned checkouts).'),
      },
    },
    async ({ page, limit, includeUnpaid }) =>
      runTool(async () => {
        const data = await apiRequest({
          method: 'GET',
          path: '/api/v1/user/orders',
          token: USER_TOKEN,
          query: { page, limit, includeUnpaid: includeUnpaid ? 'true' : undefined },
        });
        return jsonResult(data);
      }),
  );

  server.registerTool(
    'get_order',
    {
      title: 'Get order',
      description:
        "Get one of the authenticated user's orders: items, payment/order status, tracking, address and totals.",
      inputSchema: {
        orderId: z.string().describe('The order Mongo _id or its ORD-... id.'),
      },
    },
    async ({ orderId }) =>
      runTool(async () => {
        const data = await apiRequest({
          method: 'GET',
          path: `/api/v1/user/orders/${encodeURIComponent(orderId)}`,
          token: USER_TOKEN,
        });
        return jsonResult(data);
      }),
  );
}
