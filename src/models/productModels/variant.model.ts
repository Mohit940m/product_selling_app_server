import mongoose, { Schema, Document } from "mongoose";
import { IProductDocument } from "./product.model.js";
import { clearProductCache } from "../../config/redis.js";

export interface IVariantDocument extends Document {
  productId: mongoose.Types.ObjectId;
  sku: string;

  attributes: Record<string, string>; // { size: "M", color: "Red" }

  price: number;

  stock: number;
  
  isActive: boolean;
}

const variantSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },

    sku: {
      type: String,
      required: true
    },

    attributes: {
      type: Object,
      required: true
    },

    price: {
        type: Number,
        required: true,
        min: [0.01, 'Price must be greater than 0']
    },

    stock: { type: Number, default: 0, min: [0, 'Stock cannot be negative'] },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

variantSchema.index({ productId: 1 });
// Unique GLOBALLY (across every seller), not per-seller. sku is
// auto-generated below as category-code + 3 random alphanumeric chars +
// attribute codes (~46,656 combinations per identical category+attributes
// combo) — a real, if low-probability-at-current-scale, collision risk:
// two different sellers (or the same seller) creating similar variants in
// the same category with the same attribute values could eventually hit
// this constraint. When it happens, the pre-validate hook doesn't retry
// with a new random code, so the actual .save()/.create() call surfaces a
// raw MongoDB duplicate-key error, reported to the seller as a generic
// 500 with no indication a retry would likely succeed. Not changed here:
// either scoping this per-seller (arguably the more realistic real-world
// model — SKUs are normally vendor-specific, not globally unique) or
// adding retry-on-collision to the hook below are both legitimate fixes
// with real tradeoffs, not something to pick unilaterally.
variantSchema.index({ sku: 1 }, { unique: true });

// Pre-validate hook to generate SKU automatically
variantSchema.pre("validate", async function () {
  // Only generate SKU for new documents
  if (!this.isNew) return;

  try {
    const Product = mongoose.model<IProductDocument>("Product");
    const product = await Product.findById(this.productId);

    if (!product) {
      throw new Error("Product not found for variant SKU generation");
    }

    // 1. Category Code (First 3 chars, uppercase)
    const categoryCode = (product.category || "GEN").substring(0, 3).toUpperCase();

    // 2. Random Code (3 random alphanumeric chars)
    const randomCode = Math.random().toString(36).substring(2, 5).toUpperCase();

    // 3. Attributes Code
    let attributesCode = "";
    // Use product.variantTypes to ensure consistent order (e.g., Size then Color)
    if (this.attributes && product.variantTypes && Array.isArray(product.variantTypes)) {
      product.variantTypes.forEach((type) => {
        const val = this.attributes[type];
        if (val) {
          // Take first 3 chars of the attribute value (e.g., "32" -> "32", "Blue" -> "BLU")
          attributesCode += "-" + String(val).substring(0, 3).toUpperCase();
        }
      });
    } else if (this.attributes) {
      // Fallback if variantTypes are missing
      for (const val of Object.values(this.attributes)) {
        attributesCode += "-" + String(val).substring(0, 3).toUpperCase();
      }
    }

    // Format: CAT-RND-ATTR1-ATTR2 (e.g., DJ-LEV-32-BLU)
    this.sku = `${categoryCode}-${randomCode}${attributesCode}`;
  } catch (error: any) {
    throw error;
  }
});

variantSchema.post("save", async function () {
  await clearProductCache();
});

variantSchema.post("findOneAndDelete", async function () {
  await clearProductCache();
});

variantSchema.post("findOneAndUpdate", async function () {
  await clearProductCache();
});

const Variant = mongoose.model<IVariantDocument>("Variant", variantSchema);

export default Variant;