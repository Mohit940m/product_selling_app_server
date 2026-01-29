import { Response } from "express";
import { AuthRequest } from "../../auth/auth.middleware.js";
import Offer from "../../models/productModels/offer.model.js";
import Product from "../../models/productModels/product.model.js";
import Variant from "../../models/productModels/variant.model.js";

const createOffer = async (req: AuthRequest, res: Response) => {
    try {
        // Ensure seller is authenticated
        if (!req.seller) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Seller not found."
            });
        }

        const {
            name,
            type,
            appliesTo,
            config,
            minCartValue,
            maxDiscountAmount,
            validFrom,
            validTill,
            usageLimit,
            perUserLimit,
            isStackable
        } = req.body;

        // 1. Basic Validation
        const missingFields: string[] = [];
        if (!name) missingFields.push("name");
        if (!type) missingFields.push("type");
        if (!config) missingFields.push("config");
        if (!validFrom) missingFields.push("validFrom");
        if (!validTill) missingFields.push("validTill");
        if (!appliesTo?.productIds || appliesTo.productIds.length === 0) missingFields.push("appliesTo.productIds");

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missingFields.join(", ")}`
            });
        }

        // 2. Security Check: Ensure products belong to this seller
        if (appliesTo?.productIds && appliesTo.productIds.length > 0) {
            const count = await Product.countDocuments({
                _id: { $in: appliesTo.productIds },
                sellerId: req.seller._id
            });

            if (count !== appliesTo.productIds.length) {
                return res.status(403).json({
                    success: false,
                    message: "You can only create offers for products that belong to you."
                });
            }
        }

        // 3. Auto-populate variants if not provided (Apply to all variants of the selected products)
        if (!appliesTo.variantIds || appliesTo.variantIds.length === 0) {
            const variants = await Variant.find({ productId: { $in: appliesTo.productIds } }).select('_id');
            req.body.appliesTo.variantIds = variants.map(v => v._id);
        }

        // 4. Create Offer
        const newOffer = await Offer.create(req.body);

        return res.status(201).json({
            success: true,
            message: "Offer created successfully",
            data: newOffer
        });

    } catch (error: any) {
        console.error("Create Offer Error:", error);
        // Handle Mongoose Validation Errors specifically
        if (error.name === "ValidationError") {
            return res.status(400).json({ success: false, message: error.message });
        }
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

export { createOffer };
export {};