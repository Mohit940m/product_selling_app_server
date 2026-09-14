import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiRequest } from '../client/apiClient.js';
import { SELLER_TOKEN } from '../config.js';
import { jsonResult, runTool } from './helpers.js';

/**
 * Seller tools (require a seller JWT via MCP_SELLER_API_TOKEN). Each wraps a
 * real `/api/v1/seller/...` endpoint guarded by `authenticateSeller`.
 *
 * Read:  seller_list_products, seller_get_product, seller_get_shipping_config,
 *        seller_calculate_shipping, seller_list_offers
 * Write: seller_increase_stock, seller_edit_variant_price,
 *        seller_edit_product_status, seller_create_offer,
 *        seller_edit_offer_status, seller_delete_offer
 */
export function registerSellerTools(server: McpServer): void {
  server.registerTool(
    'seller_list_products',
    {
      title: 'Seller: list products',
      description: "List the authenticated seller's own products with pagination and optional filters.",
      inputSchema: {
        page: z.number().int().positive().optional().describe('Page number (default 1).'),
        limit: z.number().int().positive().optional().describe('Items per page (default 10).'),
        category: z.string().optional().describe('Filter by category.'),
        search: z.string().optional().describe('Match against the product name.'),
      },
    },
    async ({ page, limit, category, search }) =>
      runTool(async () => {
        const data = await apiRequest({
          method: 'GET',
          path: '/api/v1/seller/products/get-all-products',
          token: SELLER_TOKEN,
          query: { page, limit, category, search },
        });
        return jsonResult(data);
      }),
  );

  server.registerTool(
    'seller_get_product',
    {
      title: 'Seller: get product',
      description: "Get one of the seller's products with all of its variants.",
      inputSchema: {
        productId: z.string().describe('The product _id.'),
      },
    },
    async ({ productId }) =>
      runTool(async () => {
        const data = await apiRequest({
          method: 'GET',
          path: `/api/v1/seller/products/get-product/${encodeURIComponent(productId)}`,
          token: SELLER_TOKEN,
        });
        return jsonResult(data);
      }),
  );

  server.registerTool(
    'seller_increase_stock',
    {
      title: 'Seller: increase stock',
      description:
        "Increase stock for one of the seller's product variants. State-changing: confirm with the user before calling.",
      inputSchema: {
        productId: z.string().describe('The product _id.'),
        variantId: z.string().describe('The variant _id to restock.'),
        addedStock: z.number().int().positive().describe('Units to add to current stock.'),
      },
    },
    async ({ productId, variantId, addedStock }) =>
      runTool(async () => {
        const data = await apiRequest({
          method: 'PATCH',
          path: `/api/v1/seller/products/increase-stock/${encodeURIComponent(productId)}`,
          token: SELLER_TOKEN,
          body: { variantId, addedStock },
        });
        return jsonResult(data);
      }),
  );

  server.registerTool(
    'seller_edit_variant_price',
    {
      title: 'Seller: edit variant price',
      description:
        "Update the price of one of the seller's product variants. State-changing: confirm with the user before calling.",
      inputSchema: {
        productId: z.string().describe('The product _id.'),
        variantId: z.string().describe('The variant _id.'),
        price: z.number().positive().describe('New price (must be greater than 0).'),
      },
    },
    async ({ productId, variantId, price }) =>
      runTool(async () => {
        const data = await apiRequest({
          method: 'PATCH',
          path: `/api/v1/seller/products/edit-variant-price/${encodeURIComponent(productId)}`,
          token: SELLER_TOKEN,
          body: { variantId, price },
        });
        return jsonResult(data);
      }),
  );

  server.registerTool(
    'seller_edit_product_status',
    {
      title: 'Seller: activate/deactivate product',
      description:
        "Activate or deactivate one of the seller's products. State-changing: confirm with the user before calling.",
      inputSchema: {
        productId: z.string().describe('The product _id.'),
        status: z.boolean().describe('true to activate, false to deactivate.'),
      },
    },
    async ({ productId, status }) =>
      runTool(async () => {
        const data = await apiRequest({
          method: 'PATCH',
          path: `/api/v1/seller/products/edit-product-status/${encodeURIComponent(productId)}`,
          token: SELLER_TOKEN,
          body: { status },
        });
        return jsonResult(data);
      }),
  );

  server.registerTool(
    'seller_get_shipping_config',
    {
      title: 'Seller: get shipping config',
      description: "Read the authenticated seller's shipping origin and zone-based rates.",
      inputSchema: {},
    },
    async () =>
      runTool(async () => {
        const data = await apiRequest({
          method: 'GET',
          path: '/api/v1/seller/shipping/get-shipping-config',
          token: SELLER_TOKEN,
        });
        return jsonResult(data);
      }),
  );

  server.registerTool(
    'seller_calculate_shipping',
    {
      title: 'Seller: calculate shipping cost',
      description:
        "Calculate the shipping cost from the seller's configured origin to a destination city/state.",
      inputSchema: {
        destinationCity: z.string().describe('Destination city.'),
        destinationState: z.string().describe('Destination state.'),
      },
    },
    async ({ destinationCity, destinationState }) =>
      runTool(async () => {
        const data = await apiRequest({
          method: 'POST',
          path: '/api/v1/seller/shipping/calculate-shipping-cost',
          token: SELLER_TOKEN,
          body: { destinationCity, destinationState },
        });
        return jsonResult(data);
      }),
  );

  server.registerTool(
    'seller_create_offer',
    {
      title: 'Seller: create offer',
      description:
        'Create a promotional offer for the seller\'s products. State-changing: confirm with the user before calling. Dates must be today or in the future.',
      inputSchema: {
        name: z.string().describe('Offer name.'),
        type: z
          .enum(['BUY_GET', 'DISCOUNT', 'CASHBACK', 'PRODUCT_BUNDLE'])
          .describe('Offer type.'),
        appliesTo: z
          .object({
            productIds: z
              .array(z.string())
              .min(1)
              .describe('Product _ids this offer applies to (must belong to the seller).'),
            variantIds: z
              .array(z.string())
              .optional()
              .describe('Optional specific variant _ids; omit to apply to all variants.'),
            applyToAllVariants: z.boolean().optional(),
          })
          .describe('Targets for the offer.'),
        config: z
          .record(z.string(), z.any())
          .describe('Type-specific offer configuration (shape depends on `type`).'),
        validFrom: z.string().describe('Start date (ISO), today or future.'),
        validTill: z.string().describe('End date (ISO), today or future.'),
        minCartValue: z.number().optional(),
        maxDiscountAmount: z.number().optional(),
        usageLimit: z.number().optional(),
        perUserLimit: z.number().optional(),
        isStackable: z.boolean().optional(),
      },
    },
    async (args) =>
      runTool(async () => {
        const data = await apiRequest({
          method: 'POST',
          path: '/api/v1/seller/offers/create-offer',
          token: SELLER_TOKEN,
          body: args,
        });
        return jsonResult(data);
      }),
  );

  server.registerTool(
    'seller_list_offers',
    {
      title: 'Seller: list offers',
      description: "List the authenticated seller's promotional offers.",
      inputSchema: {},
    },
    async () =>
      runTool(async () => {
        const data = await apiRequest({
          method: 'GET',
          path: '/api/v1/seller/offers/',
          token: SELLER_TOKEN,
        });
        return jsonResult(data);
      }),
  );

  server.registerTool(
    'seller_edit_offer_status',
    {
      title: 'Seller: enable/disable offer',
      description:
        "Enable or disable one of the seller's offers. State-changing: confirm with the user before calling.",
      inputSchema: {
        offerId: z.string().describe('The offer _id.'),
        isActive: z.boolean().describe('true to enable, false to disable.'),
      },
    },
    async ({ offerId, isActive }) =>
      runTool(async () => {
        const data = await apiRequest({
          method: 'PATCH',
          path: `/api/v1/seller/offers/edit-offer-status/${encodeURIComponent(offerId)}`,
          token: SELLER_TOKEN,
          body: { isActive },
        });
        return jsonResult(data);
      }),
  );

  server.registerTool(
    'seller_delete_offer',
    {
      title: 'Seller: delete offer',
      description:
        "Permanently delete one of the seller's offers. State-changing: confirm with the user before calling — this cannot be undone.",
      inputSchema: {
        offerId: z.string().describe('The offer _id.'),
      },
    },
    async ({ offerId }) =>
      runTool(async () => {
        const data = await apiRequest({
          method: 'DELETE',
          path: `/api/v1/seller/offers/delete-offer/${encodeURIComponent(offerId)}`,
          token: SELLER_TOKEN,
        });
        return jsonResult(data);
      }),
  );
}
