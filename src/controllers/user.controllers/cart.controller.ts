import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../../auth/auth.middleware.js";
import Cart from "../../models/userModels/cart.model.js";
import Product from "../../models/productModels/product.model.js";
import Variant from "../../models/productModels/variant.model.js";

const addToCart = async (req: AuthRequest, res: Response) => {
    try {
        // 1. Validate User
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. User not found."
            });
        }
        const userId = req.user._id;
        const { productId, variantId, quantity = 1 } = req.body;

        // 2. Validate Input
        if (!productId || !variantId) {
            return res.status(400).json({
                success: false,
                message: "Product ID and Variant ID are required."
            });
        }

        const qty = parseInt(quantity as string);
        if (isNaN(qty) || qty < 1) {
            return res.status(400).json({
                success: false,
                message: "Quantity must be a valid positive number."
            });
        }

        // 3. Fetch Product and Variant (Validate existence and active status)
        const product = await Product.findOne({ 
            _id: productId, 
            isActive: true, 
            isDeleted: false 
        });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found or unavailable."
            });
        }

        const variant = await Variant.findOne({ 
            _id: variantId, 
            productId: productId, 
            isActive: true 
        });

        if (!variant) {
            return res.status(404).json({
                success: false,
                message: "Variant not found or unavailable."
            });
        }

        // 4. Check Stock
        if (variant.stock < qty) {
            return res.status(400).json({
                success: false,
                message: `Insufficient stock. Only ${variant.stock} units available.`
            });
        }

        // 5. Find or Create Cart
        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ 
                userId, 
                items: [],
                subTotal: 0,
                discount: 0,
                total: 0
            });
        }

        // 6. Check if item exists in cart
        const existingItemIndex = cart.items.findIndex(
            (item) => item.productId.toString() === productId && item.variantId.toString() === variantId
        );

        if (existingItemIndex > -1) {
            // Item exists: Increase quantity
            const currentQty = cart.items[existingItemIndex].quantity;
            const newQty = currentQty + qty;

            // Re-check stock for total quantity
            if (variant.stock < newQty) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot add. Total quantity in cart would exceed stock (${variant.stock}).`
                });
            }

            cart.items[existingItemIndex].quantity = newQty;
            
            // Update price snapshot to current price
            cart.items[existingItemIndex].priceSnapshot = variant.price;
        } else {
            // Item does not exist: Add new item
            cart.items.push({
                productId: new mongoose.Types.ObjectId(productId),
                variantId: new mongoose.Types.ObjectId(variantId),
                quantity: qty,
                attributes: variant.attributes, // Snapshot of attributes
                priceSnapshot: variant.price,   // Snapshot of price
                addedAt: new Date()
            } as any);
        }

        // 7. Recalculate Cart Totals
        let subTotal = 0;
        cart.items.forEach((item) => {
            subTotal += item.priceSnapshot * item.quantity;
        });

        cart.subTotal = subTotal;
        cart.total = Math.max(0, cart.subTotal - cart.discount);

        await cart.save();

        return res.status(200).json({
            success: true,
            message: "Product added to cart successfully.",
            data: cart
        });

    } catch (error: any) {
        console.error("Add to Cart Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

const getCart = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. User not found."
            });
        }
        const userId = req.user._id;

        const cart = await Cart.findOne({ userId })
            .populate("items.productId", "name category images");

        if (!cart) {
            return res.status(200).json({
                success: true,
                message: "Cart is empty",
                data: { items: [], subTotal: 0, total: 0 }
            });
        }

        return res.status(200).json({
            success: true,
            message: "Cart fetched successfully",
            data: cart
        });
    } catch (error: any) {
        console.error("Get Cart Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

export {
    addToCart,
    getCart
};