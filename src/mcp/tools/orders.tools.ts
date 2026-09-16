import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiRequest } from '../client/apiClient.js';
import type { ToolContext } from '../context.js';
import { jsonResult, runTool } from './helpers.js';

/**
 * Authenticated buyer order tools (require MCP_API_TOKEN). Read-only;
 * payment execution stays out of scope.
 *
 * - list_my_orders -> GET /api/v1/user/orders
 * - get_order      -> GET /api/v1/user/orders/:orderId
 */
export function registerOrderTools(server: McpServer, ctx: ToolContext): void {
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
          token: ctx.userToken,
          query: { page, limit, includeUnpaid: includeUnpaid ? 'true' : undefined },
        });
        return jsonResult(data);
      }),
  );

  server.registerTool(
    'checkout_summary',
    {
      title: 'Checkout summary',
      description:
        "Price the current cart for checkout: items, discounts, cashback, shipping and total. Uses the user's default address unless addressId is given. Read-only; does not place an order.",
      inputSchema: {
        addressId: z.string().optional().describe('A saved address _id; omit to use the default address.'),
      },
    },
    async ({ addressId }) =>
      runTool(async () => {
        const data = await apiRequest({
          method: 'POST',
          path: '/api/v1/user/orders/checkout',
          token: ctx.userToken,
          body: addressId ? { addressId } : {},
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
          token: ctx.userToken,
        });
        return jsonResult(data);
      }),
  );

  server.registerTool(
    'cancel_order_item',
    {
      title: 'Cancel an order item',
      description:
        "Cancel a single item (sub-order) in the authenticated user's order and start its refund. " +
        'Only works for a paid item that has not shipped yet (status CONFIRMED). Restores stock and ' +
        'records a refund; when the last item is cancelled the whole order is refunded. Write action — confirm with the user first.',
      inputSchema: {
        orderId: z.string().describe('The order Mongo _id or its ORD-... id.'),
        subOrderId: z.string().describe('The specific item/sub-order id, e.g. ORD-...-1.'),
        reason: z.string().max(300).optional().describe('Optional reason the buyer gave for cancelling.'),
      },
    },
    async ({ orderId, subOrderId, reason }) =>
      runTool(async () => {
        const data = await apiRequest({
          method: 'PATCH',
          path: `/api/v1/user/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(subOrderId)}/cancel`,
          token: ctx.userToken,
          body: reason ? { reason } : {},
        });
        return jsonResult(data);
      }),
  );
}
