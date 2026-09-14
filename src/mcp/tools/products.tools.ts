import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiRequest } from '../client/apiClient.js';
import { USER_TOKEN } from '../config.js';
import { jsonResult, runTool } from './helpers.js';

/**
 * Public catalog tools. Wrap the buyer-facing product endpoints which use
 * `optionalAuthUser`, so they work with or without MCP_API_TOKEN.
 *
 * - search_products -> GET /api/v1/user/products/get-all-products
 * - get_product     -> GET /api/v1/user/products/get-product/:productId
 */
export function registerProductTools(server: McpServer): void {
  server.registerTool(
    'search_products',
    {
      title: 'Search products',
      description:
        'List and search active products with pagination, an optional category, a name search term, and dynamic variant attribute filters (e.g. size, color). Public catalog data.',
      inputSchema: {
        page: z.number().int().positive().optional().describe('Page number (default 1).'),
        limit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Items per page (default 10).'),
        category: z.string().optional().describe('Filter by product category.'),
        search: z
          .string()
          .optional()
          .describe('Case-insensitive match against the product name.'),
        attributes: z
          .record(z.string(), z.string())
          .optional()
          .describe(
            'Variant attribute filters, e.g. { "size": "M", "color": "red" }. Matched case-insensitively against active variants.',
          ),
      },
    },
    async ({ page, limit, category, search, attributes }) =>
      runTool(async () => {
        const query: Record<string, string | number | undefined> = {
          page,
          limit,
          category,
          search,
        };
        if (attributes) {
          for (const [key, value] of Object.entries(attributes)) {
            query[key] = value;
          }
        }
        const data = await apiRequest({
          method: 'GET',
          path: '/api/v1/user/products/get-all-products',
          token: USER_TOKEN,
          allowAnonymous: true,
          query,
        });
        return jsonResult(data);
      }),
  );

  server.registerTool(
    'get_product',
    {
      title: 'Get product',
      description:
        'Fetch a single active product with its active variants, computed price and any applicable offer. Optionally select a specific variant.',
      inputSchema: {
        productId: z.string().describe('The product _id.'),
        variantId: z
          .string()
          .optional()
          .describe('Optional variant _id to select (sent as the variant-id header).'),
      },
    },
    async ({ productId, variantId }) =>
      runTool(async () => {
        const data = await apiRequest({
          method: 'GET',
          path: `/api/v1/user/products/get-product/${encodeURIComponent(productId)}`,
          token: USER_TOKEN,
          allowAnonymous: true,
          headers: variantId ? { 'variant-id': variantId } : undefined,
        });
        return jsonResult(data);
      }),
  );
}
