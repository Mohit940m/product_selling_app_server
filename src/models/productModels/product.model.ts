import mongoose, { Schema, Document } from "mongoose";

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

const Product = mongoose.model<IProductDocument>('Product', productSchema);

export default Product;