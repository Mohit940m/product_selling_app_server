// c:\Users\Mohit\Downloads\Full Stack\NodeJs\product_selling_app\product_selling_app_server\src\controllers\user.controllers\order.controller.ts

import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../../auth/auth.middleware.js";
import Cart from "../../models/userModels/cart.model.js";
import Address from "../../models/userModels/address.model.js";
import User from "../../models/userModels/user.model.js";
import SellerShipping from "../../models/productModels/sellerShipping.model.js";
import { findApplicableOffers } from "../../utils/offer.util.js";

/**
 * Checkout Controller
 * Calculates the final order summary including shipping, offers, and totals.
 * Validates stock and handles address creation/selection.
 */
const checkout = async (req: AuthRequest, res: Response) => {
  try {
    // 1. Validate User
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const userId = req.user._id;
    const { 
        addressId,
        fullName,
        phone,
        addressLine1,
        addressLine2, 
        city, 
        state, 
        pincode,
        country
    } = req.body || {};

    // 2. Resolve Shipping Address
    let shippingAddress;

    // Check if a new address is provided in the body
    if (fullName && phone && addressLine1 && city && state && pincode) {
      // Create new address
      // Unset previous default if exists
      await Address.updateMany({ user: userId, isDefault: true }, { isDefault: false });

      const newAddress = new Address({
        user: userId,
        fullName,
        phone,
        addressLine1,
        addressLine2,
        city,
        state,
        pincode,
        country: country || "India",
        isDefault: true
      });
      await newAddress.save();
      
      // Update user default address reference
      await User.findByIdAndUpdate(userId, { defaultAddress: newAddress._id });
      
      shippingAddress = newAddress;
    } else if (addressId) {
      if (!mongoose.Types.ObjectId.isValid(addressId)) {
        return res.status(400).json({ success: false, message: "Invalid addressId provided." });
      }
      // Use provided address ID
      shippingAddress = await Address.findOne({ _id: addressId, user: userId });
    } else {
      // Fallback to default address
      shippingAddress = await Address.findOne({ user: userId, isDefault: true });
    }

    if (!shippingAddress) {
      return res.status(400).json({
        success: false,
        message: "Shipping address is required. Please add an address or select one."
      });
    }

    // 3. Fetch Cart
    const cart = await Cart.findOne({ userId })
      .populate({
        path: "items.productId",
        select: "name sellerId weight category images" // Need sellerId for shipping
      })
      .populate({
        path: "items.variantId",
        select: "price stock sku attributes weight"
      });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty."
      });
    }

    // 4. Validate Stock & Prepare Items
    const validItems = [];
    const itemsToCheckForOffers = [];
    const sellerGroups = new Map<string, any[]>(); // Group items by seller for shipping

    for (const item of cart.items) {
      const product = item.productId as any;
      const variant = item.variantId as any;

      if (!product || !variant) continue; // Skip invalid items (deleted product/variant)

      // Check Stock
      if (variant.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name} (Variant: ${variant.sku}). Available: ${variant.stock}, Requested: ${item.quantity}`
        });
      }

      validItems.push(item);
      
      // Prepare for offer calculation
      itemsToCheckForOffers.push({
        productId: product._id,
        variantId: variant._id,
        price: variant.price
      });

      // Group by Seller for Shipping
      const sellerIdStr = product.sellerId.toString();
      if (!sellerGroups.has(sellerIdStr)) {
        sellerGroups.set(sellerIdStr, []);
      }
      sellerGroups.get(sellerIdStr)?.push(item);
    }

    if (validItems.length === 0) {
       return res.status(400).json({
        success: false,
        message: "No valid items in cart."
      });
    }

    // 5. Calculate Offers
    const itemsWithOffers = await findApplicableOffers(itemsToCheckForOffers);

    // 6. Calculate Financials (Subtotal, Discounts)
    let subTotal = 0;
    let totalDiscount = 0;
    const processedItems = [];

    for (let i = 0; i < validItems.length; i++) {
      const item = validItems[i];
      const offerData = itemsWithOffers[i];
      const quantity = item.quantity;
      const originalPrice = (item.variantId as any).price;
      
      const discountedPrice = offerData.discountedPrice ?? originalPrice;
      const itemTotal = originalPrice * quantity;
      const itemDiscount = (originalPrice - discountedPrice) * quantity;
      const itemPayable = discountedPrice * quantity;

      subTotal += itemTotal;
      totalDiscount += itemDiscount;

      let activeOffer = null;
      if (offerData.offers && offerData.offers.length > 0) {
          const offer = offerData.offers[0];
          activeOffer = {
              _id: offer._id,
              name: offer.name,
              type: offer.type,
              config: offer.config
          };
      }

      processedItems.push({
        productId: item.productId._id,
        variantId: item.variantId._id,
        name: (item.productId as any).name,
        image: (item.productId as any).images[0],
        quantity: quantity,
        price: originalPrice,
        discountedPrice: discountedPrice,
        total: itemPayable,
        savings: itemDiscount,
        activeOffer
      });
    }

    // 7. Calculate Shipping
    let totalShippingCost = 0;
    const shippingDetails = [];

    // Iterate over sellers to calculate shipping per seller
    for (const [sellerId, items] of sellerGroups) {
      const sellerShipping = await SellerShipping.findOne({ sellerId });
      
      let cost = 0;
      let time = "Unknown";
      let type = "Standard";

      if (sellerShipping) {
        const calculation = sellerShipping.calculateShipping({
          city: shippingAddress.city,
          state: shippingAddress.state
        });
        cost = calculation.cost;
        time = calculation.time;
        type = calculation.type;
      } else {
        // Fallback if no shipping config found for seller
        // Assuming 0 cost or could be a default system rate
        cost = 0; 
        time = "5-7 Days";
      }
      
      totalShippingCost += cost;
      
      shippingDetails.push({
        sellerId,
        cost,
        time,
        type
      });
    }

    // 8. Final Totals
    const tax = 0; // Placeholder for tax logic if needed
    const payableAmount = subTotal - totalDiscount + totalShippingCost + tax;

    // 9. Return Response
    return res.status(200).json({
      success: true,
      message: "Checkout summary calculated successfully.",
      data: {
        shippingAddress,
        items: processedItems,
        breakdown: {
          subTotal,
          discount: totalDiscount,
          discountedAmount: subTotal - totalDiscount,
          shipping: totalShippingCost,
          tax,
          total: Math.max(0, payableAmount)
        },
        shippingDetails // Optional: breakdown of shipping by seller
      }
    });

  } catch (error: any) {
    console.error("Checkout Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

export { checkout };
