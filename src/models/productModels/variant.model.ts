import mongoose, { Schema, Document } from "mongoose";
import { IProductDocument } from "./product.model.js";

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
        required: true 
    },

    stock: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

variantSchema.index({ productId: 1 });
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

const Variant = mongoose.model<IVariantDocument>("Variant", variantSchema);

export default Variant;