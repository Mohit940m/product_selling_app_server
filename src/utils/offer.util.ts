import mongoose from "mongoose";
import Offer, { IOfferDocument, IDiscountConfig } from "../models/productModels/offer.model.js";

export interface IOfferCheckItem {
  productId: string | mongoose.Types.ObjectId;
  variantId: string | mongoose.Types.ObjectId;
  price: number;
  offers?: IOfferDocument[];
  discountedPrice?: number;
  bestOffer?: IOfferDocument;
}

/**
 * Optimized utility to find applicable offers for a list of items.
 * Uses Maps to reduce complexity from O(N*M) to O(N) where N is items and M is offers.
 */
export const findApplicableOffers = async (items: IOfferCheckItem[]): Promise<IOfferCheckItem[]> => {
  if (!items || items.length === 0) return [];

  const productIds = items.map((item) => item.productId);
  const variantIds = items.map((item) => item.variantId);
  const now = new Date();

  // 1. Fetch relevant active offers
  // We use .lean() for performance as we don't need Mongoose document methods here
  const offers = await Offer.find({
    isActive: true,
    validFrom: { $lte: now },
    validTill: { $gte: now },
    $or: [
      { "appliesTo.productIds": { $in: productIds } },
      { "appliesTo.variantIds": { $in: variantIds } }
    ]
  }).lean();

  // 2. Create Maps for O(1) lookup
  const productOfferMap = new Map<string, IOfferDocument[]>();
  const variantOfferMap = new Map<string, IOfferDocument[]>();

  for (const offer of offers) {
    // Cast to IOfferDocument to satisfy type checking with the interface
    const typedOffer = offer as unknown as IOfferDocument;

    // Index by Product ID (if applyToAllVariants is true)
    if (typedOffer.appliesTo.applyToAllVariants && typedOffer.appliesTo.productIds) {
      for (const pid of typedOffer.appliesTo.productIds) {
        const pidStr = pid.toString();
        if (!productOfferMap.has(pidStr)) productOfferMap.set(pidStr, []);
        productOfferMap.get(pidStr)?.push(typedOffer);
      }
    }

    // Index by Variant ID
    if (typedOffer.appliesTo.variantIds) {
      for (const vid of typedOffer.appliesTo.variantIds) {
        const vidStr = vid.toString();
        if (!variantOfferMap.has(vidStr)) variantOfferMap.set(vidStr, []);
        variantOfferMap.get(vidStr)?.push(typedOffer);
      }
    }
  }

  // 3. Attach offers to items
  return items.map((item) => {
    const pidStr = item.productId.toString();
    const vidStr = item.variantId.toString();
    const applicableOffers: IOfferDocument[] = [];

    // Add Product-level offers (Apply to all variants)
    if (productOfferMap.has(pidStr)) {
        applicableOffers.push(...(productOfferMap.get(pidStr) || []));
    }

    // Add Variant-specific offers
    if (variantOfferMap.has(vidStr)) {
        applicableOffers.push(...(variantOfferMap.get(vidStr) || []));
    }

    // Deduplicate offers by _id
    const uniqueOffersMap = new Map<string, IOfferDocument>();
    applicableOffers.forEach(offer => uniqueOffersMap.set(offer._id.toString(), offer));
    
    return {
      ...item,
      offers: Array.from(uniqueOffersMap.values()),
      discountedPrice: calculateBestPrice(item.price, Array.from(uniqueOffersMap.values()))
    };
  });
};

/**
 * Helper to calculate the best price given a list of offers
 */
const calculateBestPrice = (originalPrice: number, offers: IOfferDocument[]): number => {
  let bestPrice = originalPrice;

  for (const offer of offers) {
    // We only calculate price changes for DISCOUNT type here. 
    // BUY_GET or BUNDLE usually apply at cart level logic or have complex UI requirements.
    if (offer.type === "DISCOUNT" && offer.isActive) {
      // Check minimum cart value (treat item price as cart value for single item context)
      if (offer.minCartValue && originalPrice < offer.minCartValue) continue;

      const config = offer.config as IDiscountConfig;
      let discountAmount = 0;

      if (config.discountType === "FLAT") {
        discountAmount = config.value;
      } else if (config.discountType === "PERCENTAGE") {
        discountAmount = originalPrice * (config.value / 100);
        if (offer.maxDiscountAmount) {
          discountAmount = Math.min(discountAmount, offer.maxDiscountAmount);
        }
      }

      const currentPrice = originalPrice - discountAmount;
      if (currentPrice < bestPrice) bestPrice = currentPrice;
    }
  }

  return Math.max(0, bestPrice); // Ensure price doesn't go negative
};