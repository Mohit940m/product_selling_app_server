import mongoose from "mongoose";
import Offer, { IOfferDocument, IDiscountConfig, ICashbackConfig } from "../models/productModels/offer.model.js";

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
export const findApplicableOffers = async (
  items: IOfferCheckItem[],
  cartTotal?: number
): Promise<IOfferCheckItem[]> => {
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
      discountedPrice: calculateBestPrice(item.price, Array.from(uniqueOffersMap.values()), cartTotal)
    };
  });
};

/**
 * Helper to calculate the best price given a list of offers.
 *
 * `cartTotal`, when supplied by the caller, is the real cart/order
 * subtotal to check `minCartValue` against. Without it, this falls back
 * to gating on `originalPrice` alone (this single item's price) — a
 * caller with no real cart context (e.g. a product browsing/listing
 * page, where there's no cart yet) has nothing better to check against,
 * so the offer is shown speculatively based on the item's own price.
 * Callers that *do* have a real cart (cart view, checkout, order
 * creation) must pass it, or a "spend ₹2000+" offer would only ever
 * apply when a single item alone exceeds the threshold — never for a
 * cart that reaches it across several smaller items, which defeats the
 * entire point of a cart-value-gated offer.
 */
const calculateBestPrice = (originalPrice: number, offers: IOfferDocument[], cartTotal?: number): number => {
  let bestPrice = originalPrice;
  const valueToCheck = cartTotal ?? originalPrice;

  for (const offer of offers) {
    // Per-unit price changes only. CASHBACK is order-level (see
    // calculateCashback). BUY_GET and PRODUCT_BUNDLE still have no price
    // effect: each needs its own rules (free-unit thresholds, detecting a
    // bundle combination) that haven't been decided.
    if (offer.type === "DISCOUNT" && offer.isActive) {
      if (offer.minCartValue && valueToCheck < offer.minCartValue) continue;

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

export interface ICashbackLine {
  offers?: IOfferDocument[];
  /** What the buyer pays for this line after per-unit discounts. */
  payable: number;
}

export interface IAppliedCashback {
  offerId: mongoose.Types.ObjectId;
  name: string;
  amount: number;
}

/**
 * CASHBACK offers are deducted once from the order total at checkout, not
 * per unit. Each distinct offer counts once however many lines it covers,
 * is gated on minCartValue against the cart subtotal, and is capped at the
 * payable amount of the lines it applies to; the combined cashback never
 * exceeds the whole cart's payable amount.
 */
export const calculateCashback = (lines: ICashbackLine[], cartTotal: number) => {
  const byOffer = new Map<string, { offer: IOfferDocument; eligiblePayable: number }>();

  for (const line of lines) {
    for (const offer of line.offers ?? []) {
      if (offer.type !== "CASHBACK" || !offer.isActive) continue;
      if (offer.minCartValue && cartTotal < offer.minCartValue) continue;
      const key = offer._id.toString();
      const entry = byOffer.get(key) ?? { offer, eligiblePayable: 0 };
      entry.eligiblePayable += line.payable;
      byOffer.set(key, entry);
    }
  }

  let remaining = Math.max(0, lines.reduce((sum, line) => sum + line.payable, 0));
  const applied: IAppliedCashback[] = [];

  for (const { offer, eligiblePayable } of byOffer.values()) {
    const configured = Number((offer.config as ICashbackConfig).amount);
    if (!Number.isFinite(configured) || configured <= 0) continue;
    const amount = Math.min(configured, eligiblePayable, remaining);
    if (amount <= 0) continue;
    remaining -= amount;
    applied.push({ offerId: offer._id as mongoose.Types.ObjectId, name: offer.name, amount });
  }

  return {
    amount: applied.reduce((sum, c) => sum + c.amount, 0),
    applied,
  };
};