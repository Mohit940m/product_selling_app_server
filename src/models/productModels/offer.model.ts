import mongoose, { Schema, Document } from "mongoose";
import { clearProductCache } from "../../config/redis.js"

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
  sellerId: mongoose.Types.ObjectId;
  name: string;
  type: OfferType;

  appliesTo: {
    productIds?: mongoose.Types.ObjectId[];
    applyToAllVariants: boolean;
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
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: "Seller",
      required: true
    },

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
      applyToAllVariants: { type: Boolean, default: false },
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

    // Neither of these is currently enforced anywhere — createOffer
    // accepts and stores them, but findApplicableOffers/calculateBestPrice
    // (src/utils/offer.util.ts) never reads them, so an offer applies an
    // unlimited number of times, to the same buyer repeatedly, for its
    // entire validity window regardless of what's set here. Currently
    // dormant rather than actively wrong, though: the seller admin app's
    // OffersPage has no form fields for either value at all, so no real
    // offer created through the actual product has ever had them set to
    // anything but undefined — this only bites a caller hitting
    // create-offer directly. A real fix needs more than a read-side
    // check: Order/OrderItem (src/models/orderModels/order.model.ts)
    // doesn't currently record which offer (if any) was applied to a
    // line item at all — only the final priceAtPurchase — so enforcement
    // would first need that tracking added, then an atomic usage-count
    // check at order-creation time (the same class of concurrency
    // concern as the stock-oversell fix in verifyPayment). Left as a
    // known gap rather than a partial, unsafe implementation.
    usageLimit: Number,
    perUserLimit: Number,

    isStackable: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

offerSchema.index({ type: 1 });
offerSchema.index({ validFrom: 1, validTill: 1 });

offerSchema.post("save", async function () {
  await clearProductCache();
});

offerSchema.post("findOneAndDelete", async function () {
  await clearProductCache();
});

offerSchema.post("findOneAndUpdate", async function () {
  await clearProductCache();
});

export default mongoose.model<IOfferDocument>("Offer", offerSchema);
