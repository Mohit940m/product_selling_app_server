import mongoose, { Schema, Document } from "mongoose";

const OFFER_TYPES = [
  "BUY_GET",
  "DISCOUNT",
  "CASHBACK",
  "PRODUCT_BUNDLE"
] as const;

export type OfferType = typeof OFFER_TYPES[number];

export interface IBuyGetConfig {
  buyQty: number;
  getQty: number;
}

export interface IDiscountConfig {
  discountType: "PERCENTAGE" | "FLAT";
  value: number;
}

export interface ICashbackConfig {
  amount: number;
}

export interface IBundleConfig {
  bundleItems: { productId: mongoose.Types.ObjectId; quantity: number }[];
  bundlePrice: number;
}

export interface IOfferDocument extends Document {
  name: string;
  type: OfferType;

  appliesTo: {
    productIds?: mongoose.Types.ObjectId[];
    variantIds?: mongoose.Types.ObjectId[];
  };

  config: IBuyGetConfig | IDiscountConfig | ICashbackConfig | IBundleConfig;

  minCartValue?: number;
  maxDiscountAmount?: number;

  validFrom: Date;
  validTill: Date;

  usageLimit?: number;
  perUserLimit?: number;

  isStackable: boolean;
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const offerSchema = new Schema(
  {
    name: { type: String, required: true },

    type: {
      type: String,
      enum: OFFER_TYPES,
      required: true
    },

    appliesTo: {
      productIds: {
        type: [{ type: Schema.Types.ObjectId, ref: "Product" }],
        validate: {
          validator: (v: any[]) => Array.isArray(v) && v.length > 0,
          message: "At least one product ID is required."
        }
      },
      variantIds: [{ type: Schema.Types.ObjectId, ref: "Variant" }],
    },

    config: {
      type: Schema.Types.Mixed,
      required: true,
      validate: {
        validator: function (this: IOfferDocument, v: any) {
          if (!v) return false;
          switch (this.type) {
            case "BUY_GET":
              return typeof v.buyQty === "number" && typeof v.getQty === "number";
            case "DISCOUNT":
              return (
                ["PERCENTAGE", "FLAT"].includes(v.discountType) &&
                typeof v.value === "number"
              );
            case "CASHBACK":
              return typeof v.amount === "number";
            case "PRODUCT_BUNDLE":
              return (
                Array.isArray(v.bundleItems) &&
                v.bundleItems.every((i: any) => i.productId && typeof i.quantity === "number") &&
                typeof v.bundlePrice === "number"
              );
            default:
              return false;
          }
        },
        message: "Invalid config structure for the selected Offer Type."
      }
    },

    minCartValue: Number,
    maxDiscountAmount: Number,

    validFrom: { type: Date, required: true },
    validTill: { type: Date, required: true },

    usageLimit: Number,
    perUserLimit: Number,

    isStackable: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

offerSchema.index({ type: 1 });
offerSchema.index({ validFrom: 1, validTill: 1 });

export default mongoose.model<IOfferDocument>("Offer", offerSchema);
