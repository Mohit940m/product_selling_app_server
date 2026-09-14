// c:\Users\Mohit\Downloads\Full Stack\NodeJs\product_selling_app\product_selling_app_server\src\controllers\user.controllers\order.controller.ts

import crypto from "crypto";
import { Response } from "express";
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Razorpay from "razorpay";
import { AuthRequest } from "../../auth/auth.middleware.js";
import Cart from "../../models/userModels/cart.model.js";
import Address from "../../models/userModels/address.model.js";
import User from "../../models/userModels/user.model.js";
import SellerShipping from "../../models/productModels/sellerShipping.model.js";
import Order, { ORDER_STATUS } from "../../models/orderModels/order.model.js";
import Payment, { PAYMENT_STATUS } from "../../models/orderModels/payment.model.js";
import Variant from "../../models/productModels/variant.model.js";
import { findApplicableOffers } from "../../utils/offer.util.js";

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || "",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});

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
    let rawSubtotal = 0; // Pre-discount subtotal — doesn't depend on which offers apply

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
      rawSubtotal += variant.price * item.quantity;

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
    // rawSubtotal is passed so a minCartValue-gated offer is checked
    // against the real cart total, not each item's own price — see the
    // comment on calculateBestPrice in offer.util.ts.
    const itemsWithOffers = await findApplicableOffers(itemsToCheckForOffers, rawSubtotal);

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

const createOrder = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const userId = req.user._id;
        const { addressId } = req.body || {};

        // 1. Resolve Address
        // In createOrder, we strictly expect an addressId or we use default. 
        // We do not create new addresses here to keep logic simple (should be done in checkout/add-address).
        let shippingAddress;
        if (addressId) {
            if (!mongoose.Types.ObjectId.isValid(addressId)) {
                return res.status(400).json({ success: false, message: "Invalid addressId." });
            }
            shippingAddress = await Address.findOne({ _id: addressId, user: userId });
        } else {
            shippingAddress = await Address.findOne({ user: userId, isDefault: true });
        }

        if (!shippingAddress) {
            return res.status(400).json({ success: false, message: "Shipping address is required." });
        }

        // 2. Fetch Cart & Validate
        const cart = await Cart.findOne({ userId })
            .populate({ path: "items.productId", select: "name sellerId images" })
            .populate({ path: "items.variantId", select: "price stock sku" });

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: "Cart is empty." });
        }

        // 3. Re-Calculate Totals (Secure Calculation)
        const validItems = [];
        const itemsToCheckForOffers = [];
        const sellerGroups = new Map<string, any[]>();
        let rawSubtotal = 0; // Pre-discount subtotal — doesn't depend on which offers apply

        for (const item of cart.items) {
            const product = item.productId as any;
            const variant = item.variantId as any;

            if (!product || !variant) continue;

            // Stock Check
            if (variant.stock < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for ${product.name}. Available: ${variant.stock}`
                });
            }

            validItems.push(item);
            rawSubtotal += variant.price * item.quantity;
            itemsToCheckForOffers.push({
                productId: product._id,
                variantId: variant._id,
                price: variant.price
            });

            const sellerIdStr = product.sellerId.toString();
            if (!sellerGroups.has(sellerIdStr)) sellerGroups.set(sellerIdStr, []);
            sellerGroups.get(sellerIdStr)?.push(item);
        }

        if (validItems.length === 0) {
            return res.status(400).json({ success: false, message: "No valid items to order." });
        }

        // Calculate Offers — rawSubtotal passed so minCartValue is checked
        // against the real cart total, not each item's own price.
        const itemsWithOffers = await findApplicableOffers(itemsToCheckForOffers, rawSubtotal);

        // Calculate Item Totals
        let subTotal = 0;
        let totalDiscount = 0;
        const orderItems = [];

        for (let i = 0; i < validItems.length; i++) {
            const item = validItems[i];
            const offerData = itemsWithOffers[i];
            const quantity = item.quantity;
            const originalPrice = (item.variantId as any).price;
            const discountedPrice = offerData.discountedPrice ?? originalPrice;

            subTotal += originalPrice * quantity;
            totalDiscount += (originalPrice - discountedPrice) * quantity;

            orderItems.push({
                productId: item.productId._id,
                variantId: item.variantId._id,
                name: (item.productId as any).name,
                image: (item.productId as any).images[0],
                priceAtPurchase: discountedPrice,
                quantity: quantity,
                attributes: item.attributes
            });
        }

        // Calculate Shipping
        let shippingCost = 0;
        for (const [sellerId, _] of sellerGroups) {
            const sellerShipping = await SellerShipping.findOne({ sellerId });
            let cost = 0;
            if (sellerShipping) {
                cost = sellerShipping.calculateShipping({
                    city: shippingAddress.city,
                    state: shippingAddress.state
                }).cost;
            }
            shippingCost += cost;
        }

        const totalAmount = subTotal - totalDiscount + shippingCost;

        // 4. Create Order Document
        //
        // Known gap, not fixed here: this unconditionally creates a new
        // Order + Razorpay order + Payment on every call, with no reuse of
        // an existing pending one for the same cart. A buyer who opens the
        // Razorpay modal and then closes it without paying — completely
        // normal behavior, not just a network glitch — and clicks
        // "Place Order & Pay" again gets a second CREATED/PENDING
        // Order+Payment pair for the same cart; nothing ever cleans up or
        // dedupes the first. This doesn't double-charge anyone (Razorpay
        // only charges on an actual completed payment, and verifyPayment
        // is now idempotent per-payment — see the guard added above in
        // this same session) and there's currently no order-listing
        // endpoint for either the user or seller side, so these orphaned
        // records aren't visibly surfaced anywhere today. A real fix needs
        // a product decision this isn't safe to guess at: how stale a
        // pending order must be before it's reusable vs. abandoned outright
        // (Razorpay orders themselves also expire), and whether stale ones
        // should be actively cleaned up. Left as a documented gap rather
        // than a partial, unreviewed idempotency-key implementation.
        const newOrder = new Order({
            user: userId,
            items: orderItems,
            shippingAddress: {
                addressId: shippingAddress._id,
                fullName: shippingAddress.fullName,
                phone: shippingAddress.phone,
                addressLine1: shippingAddress.addressLine1,
                addressLine2: shippingAddress.addressLine2,
                city: shippingAddress.city,
                state: shippingAddress.state,
                pincode: shippingAddress.pincode,
                country: shippingAddress.country
            },
            paymentStatus: "PENDING",
            orderStatus: ORDER_STATUS.CREATED,
            subTotal,
            discount: totalDiscount,
            shippingCost,
            totalAmount
        });

        await newOrder.save();

        // Check for keys before attempting to create order
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
             throw new Error("Razorpay API keys are missing in environment variables.");
        }

        // 5. Create Razorpay Order
        const razorpayOrder = await razorpay.orders.create({
            amount: Math.round(totalAmount * 100), // Amount in paise
            currency: "INR",
            receipt: newOrder.orderId,
            notes: {
                mongoOrderId: newOrder._id.toString()
            }
        });

        // 6. Create Payment Document
        const newPayment = new Payment({
            orderId: newOrder._id,
            razorpayOrderId: razorpayOrder.id,
            amount: totalAmount,
            currency: "INR",
            status: "PENDING"
        });

        await newPayment.save();

        return res.status(200).json({
            success: true,
            message: "Order created successfully",
            data: {
                orderId: newOrder._id,
                razorpayOrderId: razorpayOrder.id,
                amount: totalAmount,
                currency: "INR",
                key: process.env.RAZORPAY_KEY_ID,
                user: {
                    name: shippingAddress.fullName,
                    email: req.user.email,
                    phone: shippingAddress.phone
                }
            }
        });

    } catch (error: any) {
        console.error("Create Order Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
};

const verifyPayment = async (req: AuthRequest, res: Response) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, message: "Payment details missing." });
        }

        // Idempotency guard: nothing before this fix stopped verifyPayment
        // from running its full body more than once for the same order — a
        // network retry, a double-fired Razorpay `handler` callback, or the
        // same request simply replayed with the same (still-valid)
        // signature would each re-run the stock-deduction loop below,
        // decrementing stock again for an order that was already paid and
        // already had its stock taken the first time. If this payment is
        // already PAID, that work has already happened once — return
        // success without repeating it, rather than re-verifying and
        // re-deducting.
        const existingPayment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
        if (existingPayment?.status === PAYMENT_STATUS.PAID) {
            return res.status(200).json({
                success: true,
                message: "Payment already verified.",
                data: { orderId: existingPayment.orderId }
            });
        }

        // 1. Verify Signature
        const generated_signature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest("hex");

        if (generated_signature !== razorpay_signature) {
            // Mark payment as failed
            await Payment.findOneAndUpdate(
                { razorpayOrderId: razorpay_order_id },
                { status: PAYMENT_STATUS.FAILED, errorDescription: "Invalid Signature" }
            );
            return res.status(400).json({ success: false, message: "Payment verification failed" });
        }

        // 2. Update Payment and Order Status
        const payment = await Payment.findOneAndUpdate(
            { razorpayOrderId: razorpay_order_id },
            {
                status: PAYMENT_STATUS.PAID,
                razorpayPaymentId: razorpay_payment_id,
                razorpaySignature: razorpay_signature,
                paidAt: new Date()
            },
            { new: true }
        );

        if (!payment) return res.status(404).json({ success: false, message: "Payment record not found" });

        const order = await Order.findByIdAndUpdate(
            payment.orderId,
            { paymentStatus: "PAID", orderStatus: ORDER_STATUS.CONFIRMED },
            { new: true }
        );

        // 3. Deduct Stock & Clear Cart
        //
        // createOrder re-checks stock right before payment starts, but that
        // check and this deduction are separated by however long the buyer
        // takes in the Razorpay modal — two concurrent buyers for the last
        // unit can both pass that check and both pay successfully. Guard
        // the actual deduction with stock: { $gte: quantity } so it can
        // never take stock negative, rather than the unconditional $inc
        // this used to be. If it doesn't match (oversold), the order stays
        // PAID/CONFIRMED exactly as it would have anyway — the customer has
        // already been charged, so silently failing the order here would
        // leave them charged with nothing to show for it, which is worse.
        // This only stops the data corruption (negative stock); deciding
        // what to actively do about an oversold unit (refund, backorder,
        // notify the seller) is a business-policy call outside this fix's
        // scope, logged here so it's at least visible instead of silent.
        if (order) {
            for (const item of order.items) {
                const updated = await Variant.findOneAndUpdate(
                    { _id: item.variantId, stock: { $gte: item.quantity } },
                    { $inc: { stock: -item.quantity } }
                );
                if (!updated) {
                    console.error(
                        `Stock oversold: order ${order._id} paid for ${item.quantity} unit(s) of variant ${item.variantId}, but insufficient stock remained to deduct. Order stays PAID/CONFIRMED; needs manual seller follow-up.`
                    );
                }
            }
            await Cart.findOneAndDelete({ userId: order.user });
        }

        return res.status(200).json({
            success: true,
            message: "Payment verified and order placed successfully.",
            data: { orderId: order?._id }
        });

    } catch (error: any) {
        console.error("Verify Payment Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
};

const MAX_ORDERS_PAGE_SIZE = 50;

// createOrder writes a PENDING order before the Razorpay modal opens, so every
// abandoned or retried checkout leaves one behind; hide those unless asked.
const getMyOrders = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Unauthorized. User not found." });
        }

        const pageNum = Math.max(parseInt(req.query.page as string) || 1, 1);
        const limitNum = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), MAX_ORDERS_PAGE_SIZE);
        const includeUnpaid = req.query.includeUnpaid === "true";

        const filter: Record<string, unknown> = { user: req.user._id };
        if (!includeUnpaid) {
            filter.paymentStatus = { $in: ["PAID", "REFUNDED"] };
        }

        const [orders, total] = await Promise.all([
            Order.find(filter)
                .sort({ createdAt: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .select("-appliedOffer")
                .lean(),
            Order.countDocuments(filter),
        ]);

        return res.status(200).json({
            success: true,
            data: orders,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    } catch (error: any) {
        console.error("Get My Orders Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
};

// Accepts either the Mongo _id (what verify-payment returns) or the ORD-... orderId.
const getMyOrderById = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Unauthorized. User not found." });
        }

        const { orderId } = req.params;
        if (!orderId) {
            return res.status(400).json({ success: false, message: "orderId is required." });
        }

        const idFilter = mongoose.isValidObjectId(orderId) ? { _id: orderId } : { orderId };
        const order = await Order.findOne({ ...idFilter, user: req.user._id })
            .select("-appliedOffer")
            .lean();

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        return res.status(200).json({ success: true, data: order });
    } catch (error: any) {
        console.error("Get My Order Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
};

export { checkout, createOrder, verifyPayment, getMyOrders, getMyOrderById };
