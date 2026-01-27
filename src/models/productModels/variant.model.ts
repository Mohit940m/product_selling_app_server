import mongoose, { Schema, Document } from "mongoose";

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
      type: Map,
      of: String,
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

const Variant = mongoose.model<IVariantDocument>("Variant", variantSchema);

export default Variant;