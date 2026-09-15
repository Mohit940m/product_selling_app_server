import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiRequest } from '../client/apiClient.js';
import type { ToolContext } from '../context.js';
import { jsonResult, runTool } from './helpers.js';

const variantInput = z.object({
  attributes: z
    .record(z.string(), z.string())
    .describe('Values for the product\'s variant types, e.g. { "size": "M", "color": "Black" }.'),
  price: z.number().positive().describe('Price in INR (greater than 0).'),
  stock: z.number().int().nonnegative().optional().describe('Units in stock (default 0).'),
});

/**
 * Seller catalog writes used by the seller assistant.
 *
 * - seller_create_product      -> POST  /api/v1/seller/products/create-product (JSON, image URLs)
 * - seller_add_variant         -> POST  /api/v1/seller/products/add-variant/:productId
 * - seller_edit_variant_status -> PATCH /api/v1/seller/products/edit-variant-status/:productId
 */
export function registerSellerCatalogTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'seller_create_product',
    {
      title: 'Seller: create product',
      description:
        'Create a product with its variants. Images must already be uploaded (https URLs). At most 2 variant types; every variant needs a value for each type. State-changing.',
      inputSchema: {
        name: z.string().min(1).describe('Product name.'),
        description: z.string().min(1).describe('Product description.'),
        category: z.string().min(1).describe('Category, e.g. "T-Shirts".'),
        variantTypes: z
          .array(z.string().min(1))
          .max(2)
          .describe('Variant dimensions, e.g. ["size", "color"]. Use ["default"] for a single-variant product.'),
        variants: z.array(variantInput).min(1).describe('One entry per sellable combination.'),
        imageUrls: z.array(z.string().url()).min(1).max(5).describe('Uploaded product image URLs (1-5).'),
      },
    },
    async ({ name, description, category, variantTypes, variants, imageUrls }) =>
      runTool(async () => {
        const data = await apiRequest({
          method: 'POST',
          path: '/api/v1/seller/products/create-product',
          token: ctx.sellerToken,
          body: { name, description, category, variantTypes, variants, productImagesURL: imageUrls },
        });
        return jsonResult(data);
      }),
  );

  server.registerTool(
    'seller_add_variant',
    {
      title: 'Seller: add variant',
      description: "Add a new variant to one of the seller's products. State-changing.",
      inputSchema: {
        productId: z.string().describe('The product _id.'),
        attributes: variantInput.shape.attributes,
        price: variantInput.shape.price,
        stock: variantInput.shape.stock,
      },
    },
    async ({ productId, attributes, price, stock }) =>
      runTool(async () => {
        const data = await apiRequest({
          method: 'POST',
          path: `/api/v1/seller/products/add-variant/${encodeURIComponent(productId)}`,
          token: ctx.sellerToken,
          body: { attributes, price, stock },
        });
        return jsonResult(data);
      }),
  );

  server.registerTool(
    'seller_edit_variant_status',
    {
      title: 'Seller: activate/deactivate variant',
      description: "Activate or deactivate one variant of the seller's product. State-changing.",
      inputSchema: {
        productId: z.string().describe('The product _id.'),
        variantId: z.string().describe('The variant _id.'),
        status: z.boolean().describe('true to activate, false to deactivate.'),
      },
    },
    async ({ productId, variantId, status }) =>
      runTool(async () => {
        const data = await apiRequest({
          method: 'PATCH',
          path: `/api/v1/seller/products/edit-variant-status/${encodeURIComponent(productId)}`,
          token: ctx.sellerToken,
          body: { variantId, status },
        });
        return jsonResult(data);
      }),
  );
}
