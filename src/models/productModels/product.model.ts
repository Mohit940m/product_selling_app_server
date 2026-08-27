import mongoose, { Schema, Document } from "mongoose";
import { clearProductCache } from "../../config/redis.js";

export interface IProductDocument extends Document {
  name: string;
  description: string;
  category: string;
  images: string[];
  isActive: boolean;
  isDeleted: boolean;
  isFeatured: boolean;
  sellerId: mongoose.Types.ObjectId;

  variantTypes: string[]; // ["size", "color"]
  variants: mongoose.Types.ObjectId[]; // References to Variant documents
}

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  images: [{
    type: String
  }],
  variantTypes: {
    type: [String], // dynamic (max 2)
    validate: {
      validator: (v: string[]) => v.length <= 2,
      message: "Maximum 2 variant types allowed"
    }
    
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true
  },
  variants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Variant'
  }]
}, { timestamps: true });

// Unlike variant.model.ts (which already had this), the Product model
// had no cache-invalidation hooks at all — createProduct, editProduct,
// editProductStatus, and deleteProduct all persist via a document
// .save(), and none of them cleared the Redis products:* cache. A
// product's own fields (name/description/category/images/isActive)
// could change while a cached listing/detail response kept serving the
// stale version for up to the full 300s TTL — including a deactivated
// or soft-deleted product still showing as available. Mirrors the
// pattern already used correctly on the Variant schema below.
productSchema.post("save", async function () {
  await clearProductCache();
});

// Covers deleteProductPermanent's Product.deleteOne({ _id }) — a static
// query-level call, not a document .deleteOne(), so it needs the
// { document: false, query: true } middleware registration to fire.
productSchema.post("deleteOne", { document: false, query: true }, async function () {
  await clearProductCache();
});

const Product = mongoose.model<IProductDocument>('Product', productSchema);

export default Product;