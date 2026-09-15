import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiRequest } from '../client/apiClient.js';
import type { ToolContext } from '../context.js';
import { jsonResult, runTool } from './helpers.js';

/**
 * Seller order tools. Responses contain only this seller's items; each item
 * is a sub-order with its own status and tracking.
 *
 * - seller_list_orders              -> GET   /api/v1/seller/orders
 * - seller_get_order                -> GET   /api/v1/seller/orders/:orderId
 * - seller_update_order_item_status -> PATCH /api/v1/seller/orders/:orderId/items/:subOrderId/status
 */
export function registerSellerOrderTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'seller_list_orders',
    {
      title: 'Seller: list orders',
      description: "List paid orders containing the seller's products, newest first, with each item's status.",
      inputSchema: {
        page: z.number().int().positive().optional().describe('Page number (default 1).'),
        limit: z.number().int().positive().max(50).optional().describe('Items per page (default 10, max 50).'),
      },
    },
    async ({ page, limit }) =>
      runTool(async () => {
        const data = await apiRequest({
          method: 'GET',
          path: '/api/v1/seller/orders',
          token: ctx.sellerToken,
          query: { page, limit },
        });
        return jsonResult(data);
      }),
  );

  server.registerTool(
    'seller_get_order',
    {
      title: 'Seller: get order',
      description: 'Get one order by Mongo _id, ORD-... id, or an item subOrderId (ORD-...-N).',
      inputSchema: {
        orderId: z.string().describe('Order _id, orderId or subOrderId.'),
      },
    },
    async ({ orderId }) =>
      runTool(async () => {
        const data = await apiRequest({
          method: 'GET',
          path: `/api/v1/seller/orders/${encodeURIComponent(orderId)}`,
          token: ctx.sellerToken,
        });
        return jsonResult(data);
      }),
  );

  server.registerTool(
    'seller_update_order_item_status',
    {
      title: 'Seller: update order item status',
      description:
        'Move one order item forward: SHIPPED, OUT FOR DELIVERY or DELIVERED (never backwards), optionally with tracking. State-changing.',
      inputSchema: {
        orderId: z.string().describe('Order _id or ORD-... id.'),
        subOrderId: z.string().describe('The item subOrderId (ORD-...-N).'),
        status: z.enum(['SHIPPED', 'OUT FOR DELIVERY', 'DELIVERED']).describe('Target stage.'),
        courier: z.string().max(100).optional(),
        trackingId: z.string().max(100).optional(),
        trackingUrl: z.string().url().optional(),
      },
    },
    async ({ orderId, subOrderId, status, courier, trackingId, trackingUrl }) =>
      runTool(async () => {
        const hasTracking = courier || trackingId || trackingUrl;
        const data = await apiRequest({
          method: 'PATCH',
          path: `/api/v1/seller/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(subOrderId)}/status`,
          token: ctx.sellerToken,
          body: { status, ...(hasTracking ? { tracking: { courier, trackingId, trackingUrl } } : {}) },
        });
        return jsonResult(data);
      }),
  );
}
