import { Response } from "express";
import { AuthRequest } from "../../auth/auth.middleware.js";
import WishList from "../../models/userModels/wishList.model.js";

const addProductToWishList = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. User not found."
            });
        }

        const { productId } = req.body;
        const userId = req.user._id;

        // Check if the product is already in the wishlist
        const existingWish = await WishList.findOne({ userId, productId });
        if (existingWish) {
            return res.status(400).json({
                success: false,
                message: "Product is already in the wishlist."
            });
        }

        // Create a new wishlist entry
        const newWish = new WishList({ userId, productId });
        await newWish.save();

        return res.status(201).json({
            success: true,
            message: "Product added to wishlist successfully.",
            data: newWish
        });
    } catch (error: any) {
        console.error("Add to WishList Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};  

const getWishList = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. User not found."
            });
        }
        const userId = req.user._id;

        const wishList = await WishList.find({ userId })
            .select("userId productId addedAt")
            .populate('productId', 'name price category images isFeatured');

        return res.status(200).json({
            success: true,
            message: "Wishlist fetched successfully",
            data: wishList
        });
    } catch (error: any) {
        console.error("Get WishList Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

export {
    addProductToWishList,
    getWishList,
};