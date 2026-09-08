import { Response } from "express";
import mongoose from "mongoose";
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


        // 1.1 Date Validation : Past dates are not allowed, validFrom and validTill must be in today or the future
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize 'today' to midnight

        if (validFrom && new Date(validFrom) < today) {
            return res.status(400).json({
                success: false,
                message: "Invalid validFrom date: must be in the future."
            });
        }
        if (validTill && new Date(validTill) < today) {
            return res.status(400).json({
                success: false,
                message: "Invalid validTill date: must be in the future."
            });
        }
        if (validFrom && validTill && new Date(validTill) <= new Date(validFrom)) {
            return res.status(400).json({
                success: false,
                message: "Invalid date range: validTill must be after validFrom."
            });
        }

        // 1.2 If no specific variant IDs are provided, then applyToAllVariants is true
        if (!appliesTo.variantIds || appliesTo.variantIds.length === 0) {
            appliesTo.applyToAllVariants = true;
        }

        // 1.3 If specific variant IDs are provided, ensure they belong to the specified products
        if (appliesTo.variantIds && appliesTo.variantIds.length > 0) {
            const count = await Variant.countDocuments({
                _id: { $in: appliesTo.variantIds },
                productId: { $in: appliesTo.productIds }
            });

            if (count !== appliesTo.variantIds.length) {
                return res.status(400).json({
                    success: false,
                    message: "Some variant IDs do not belong to the specified products."
                });
            }
        }

        // 1.4 If specific variant IDs are provided, ensure they are active 
        if (appliesTo.variantIds && appliesTo.variantIds.length > 0) {
            const count = await Variant.countDocuments({
                _id: { $in: appliesTo.variantIds },
                isActive: true
            });

            if (count !== appliesTo.variantIds.length) {
                return res.status(400).json({
                    success: false,
                    message: "Some variant IDs are not active or have been deleted."
                });
            }
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

        // 2.1 Ensure similar type of offer like discount does not already exist for the same products and variants in the given time frame
        const overlapQuery: any = {
            sellerId: req.seller._id,
            type: type,
            "appliesTo.productIds": { $in: appliesTo.productIds }, // Must share at least one product
            $and: [
                { validFrom: { $lt: new Date(validTill) } },
                { validTill: { $gt: new Date(validFrom) } }
            ]
        };

        // If the new offer is NOT for all variants, we need to check specific variant overlaps.
        // (If it IS for all variants, the query above is sufficient because it clashes with ANY offer on these products).
        if (!appliesTo.applyToAllVariants) {
            overlapQuery.$or = [
                { "appliesTo.applyToAllVariants": true }, // Clashes if existing offer covers ALL variants
                { "appliesTo.variantIds": { $in: appliesTo.variantIds } } // Clashes if existing offer covers overlapping variants
            ];
        }

        const existingOffer = await Offer.findOne(overlapQuery);

        if (existingOffer) {
            return res.status(409).json({
                success: false,
                message: "An overlapping offer already exists for the selected products or variants."
            });
        }

        // 3. Create Offer
        const newOffer = await Offer.create({
            ...req.body,
            sellerId: req.seller._id
        });

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

const getSellerOffers = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.seller) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Seller not found."
            });
        }

        // Seller-scoped, same discipline as every other seller-side list
        // query in this codebase (see product.controller.ts's getAllProducts
        // fix) — an unscoped find() here would leak every seller's offers.
        const offers = await Offer.find({ sellerId: req.seller._id })
            .sort({ createdAt: -1 })
            .populate('appliesTo.productIds', 'name images')
            .populate('appliesTo.variantIds', 'sku attributes');

        return res.status(200).json({
            success: true,
            message: "Offers fetched successfully",
            data: offers
        });
    } catch (error: any) {
        console.error("Get Seller Offers Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

const editOfferStatus = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.seller) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Seller not found."
            });
        }

        const { offerId } = req.params;
        const { isActive } = req.body;

        if (!mongoose.isValidObjectId(offerId)) {
            return res.status(400).json({
                success: false,
                message: "A valid offerId is required."
            });
        }
        if (typeof isActive !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "isActive must be a boolean."
            });
        }

        // Scoped by sellerId, matching every other seller-write function in
        // this codebase — an unscoped findByIdAndUpdate here would let any
        // authenticated seller enable/disable another seller's offer.
        const offer = await Offer.findOneAndUpdate(
            { _id: offerId, sellerId: req.seller._id },
            { isActive },
            { new: true }
        );

        if (!offer) {
            return res.status(404).json({
                success: false,
                message: "Offer not found or unauthorized."
            });
        }

        return res.status(200).json({
            success: true,
            message: `Offer ${isActive ? "enabled" : "disabled"} successfully.`,
            data: offer
        });
    } catch (error: any) {
        console.error("Edit Offer Status Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

const deleteOffer = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.seller) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Seller not found."
            });
        }

        const { offerId } = req.params;

        if (!mongoose.isValidObjectId(offerId)) {
            return res.status(400).json({
                success: false,
                message: "A valid offerId is required."
            });
        }

        // Real delete, not a soft one — unlike Product, Offer has no
        // isDeleted field, and (per the usageLimit dormancy note on the
        // model) no Order/OrderItem currently records which offer, if any,
        // was applied to a line item, so nothing else references an Offer
        // document by id. Safe to remove outright.
        const offer = await Offer.findOneAndDelete({ _id: offerId, sellerId: req.seller._id });
        if (!offer) {
            return res.status(404).json({
                success: false,
                message: "Offer not found or unauthorized."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Offer deleted successfully."
        });
    } catch (error: any) {
        console.error("Delete Offer Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

export { createOffer, getSellerOffers, editOfferStatus, deleteOffer };
export {};