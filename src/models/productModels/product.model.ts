import mongoose, { Schema, Document } from "mongoose";

export interface IProductDocument extends Document {
  name: string;
  description: string;
  price: number;
  category: string;
  images: string[];
  stock: number;
  isActive: boolean;
  isDelete: boolean;
  isFeatured: boolean;
  sellerId: mongoose.Types.ObjectId;
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
  price: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  images: [{
    type: String
  }],
  stock: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDelete: {
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
  }
}, { timestamps: true });

const Product = mongoose.model<IProductDocument>('Product', productSchema);

export default Product;