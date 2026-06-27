import { Request, Response } from "express";
import { AuthRequest } from '../../auth/auth.middleware.js';
import Product from "../../models/productModels/product.model.js";
import Variant from "../../models/productModels/variant.model.js";
import { findApplicableOffers } from "../../utils/offer.util.js";
import redisClient from "../../config/redis.js"

// get all products with pagination, filtering and search (public)
const getAllProducts = async (req: AuthRequest, res: Response) => {
    try {
        // Extract standard params, treat the rest as attribute filters
        const { page = 1, limit = 10, category, search, ...filters } = req.query;
        const pageNum = parseInt(page as string) || 1;
        const limitNum = parseInt(limit as string) || 10;

        // Redis Cache Key Generation
        // Format: products:category:<val>:search:<val>:page:<val>:limit:<val>:filters:<val>
        const filterKey = Object.keys(filters).length ? `:filters:${JSON.stringify(filters)}` : '';
        const cacheKey = `products:category:${category || 'all'}:search:${search || ''}:page:${pageNum}:limit:${limitNum}${filterKey}`;

        // Check Cache
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            return res.status(200).json({
                success: true,
                message: "Products fetched successfully",
                data: JSON.parse(cachedData)
            });
        }

        const pipeline: any[] = [];

        // 1. Match Product Fields (Active, Not Deleted, Category, Search)
        const matchStage: any = { isDeleted: false, isActive: true };

        if (category) {
            matchStage.category = category;
        }
        if (search) {
            matchStage.name = { $regex: new RegExp(search as string, 'i') };
        }

        pipeline.push({ $match: matchStage });

        // 2. Lookup Variants
        pipeline.push({
            $lookup: {
                from: "variants",
                localField: "_id",
                foreignField: "productId",
                as: "variants"
            }
        });

        // 3. Filter Variants (Active + Attribute Matching)
        // We construct a filter condition for the variants array
        const variantConditions: any[] = [{ $eq: ["$$variant.isActive", true] }];

        // Iterate over dynamic attribute filters (e.g., size=M)
        Object.keys(filters).forEach((key) => {
            const val = filters[key];
            if (val) {
                variantConditions.push({
                    $regexMatch: {
                        // Convert attribute value to string and handle missing keys safely
                        input: { $toString: { $ifNull: [`$$variant.attributes.${key}`, ""] } },
                        // Exact match, case-insensitive (e.g., "m" matches "M")
                        regex: new RegExp(`^${String(val)}$`, "i")
                    }
                });
            }
        });

        pipeline.push({
            $addFields: {
                filteredVariants: {
                    $filter: {
                        input: "$variants",
                        as: "variant",
                        cond: { $and: variantConditions }
                    }
                }
            }
        });

        // 4. Exclude products with no matching variants
        pipeline.push({
            $match: {
                $expr: { $gt: [{ $size: "$filteredVariants" }, 0] }
            }
        });

        // 5. Project fields and calculate price (min price of matching variants)
        pipeline.push({
            $project: {
                name: 1,
                description: 1,
                category: 1,
                images: 1,
                isFeatured: 1,
                isActive: 1,
                price: { $min: "$filteredVariants.price" },
                filteredVariants: { _id: 1, price: 1 } // Keep variants to identify which one is the min price
            }
        });

        // 6. Pagination and Count
        pipeline.push({
            $facet: {
                metadata: [{ $count: "total" }],
                data: [
                    { $skip: (pageNum - 1) * limitNum },
                    { $limit: limitNum }
                ]
            }
        });

        const result = await Product.aggregate(pipeline);
        let products = result[0].data;
        const total = result[0].metadata[0] ? result[0].metadata[0].total : 0;

        // 7. Apply Offers
        // We need to find offers for the specific variant that is being displayed (the one with min price)
        const itemsToCheck = products.map((p: any) => {
            // Find the variant that matches the projected min price
            // (Simple sort to find the cheapest one if multiple have same price)
            const displayVariant = p.filteredVariants?.sort((a: any, b: any) => a.price - b.price)[0];
            
            return {
                productId: p._id,
                variantId: displayVariant?._id,
                price: p.price
            };
        });

        const productsWithOffers = await findApplicableOffers(itemsToCheck);

        // Merge offer data back into products and clean up
        products = products.map((p: any, index: number) => {
            const offerData = productsWithOffers[index];
            const { filteredVariants, ...rest } = p; // Remove filteredVariants from final response

            let activeOffer = null;
            if (offerData.offers && offerData.offers.length > 0) {
                const offer = offerData.offers[0];
                activeOffer = {
                    _id: offer._id,
                    name: offer.name,
                    type: offer.type,
                    config: offer.config,
                    minCartValue: offer.minCartValue,
                    maxDiscountAmount: offer.maxDiscountAmount,
                    isStackable: offer.isStackable
                };
            }

            return {
                ...rest,
                discountedPrice: offerData.discountedPrice,
                activeOffer
            };
        });

        const responseData = { products, total, page: pageNum, limit: limitNum };

        // Set Cache with 5 minutes expiration (300 seconds)
        await redisClient.setEx(cacheKey, 300, JSON.stringify(responseData));

        return res.status(200).json({
            success: true,
            message: "Products fetched successfully",
            data: responseData
        });
    } catch (error: any) {
        console.error("Get All Products Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

const getProductById = async (req: AuthRequest, res: Response) => {
    try {
        const { productId } = req.params;
        const variantId = req.headers['variant-id'] as string;

        const cacheKey = `products:details:${productId}:variant:${variantId || 'default'}`;
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            return res.status(200).json({
                success: true,
                message: "Product fetched successfully",
                data: JSON.parse(cachedData)
            });
        }

        // 1. Fetch Product
        const product = await Product.findOne({ _id: productId, isDeleted: false, isActive: true })
            .select("name description category images isFeatured variantTypes sellerId");

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        // 2. Fetch Variants
        const variants = await Variant.find({ productId: product._id, isActive: true });

        if (!variants || variants.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No active variants found for this product"
            });
        }

        // 3. Determine Selected Variant (Default to first if not provided or not found)
        let selectedVariant = variants[0];
        if (variantId) {
            const found = variants.find(v => v._id.toString() === variantId);
            if (found) selectedVariant = found;
        }

        // 4. Calculate Offer for Selected Variant
        const itemToCheck = {
            productId: product._id,
            variantId: selectedVariant._id,
            price: selectedVariant.price
        };

        const [offerResult] = await findApplicableOffers([itemToCheck]);

        let activeOffer = null;
        if (offerResult.offers && offerResult.offers.length > 0) {
            const offer = offerResult.offers[0];
            activeOffer = {
                _id: offer._id,
                name: offer.name,
                type: offer.type,
                config: offer.config,
                minCartValue: offer.minCartValue,
                maxDiscountAmount: offer.maxDiscountAmount,
                isStackable: offer.isStackable
            };
        }

        // 5. Construct Response
        const responseData = {
            product,
            selectedVariant: {
                ...selectedVariant.toObject(),
                discountedPrice: offerResult.discountedPrice,
                activeOffer
            },
            variants: variants.map(v => ({
                _id: v._id,
                sku: v.sku,
                attributes: v.attributes,
                price: v.price,
                stock: v.stock
            }))
        };

        await redisClient.setEx(cacheKey, 300, JSON.stringify(responseData));

        return res.status(200).json({
            success: true,
            message: "Product fetched successfully",
            data: responseData
        });
    } catch (error: any) {
        console.error("Get Product By ID Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

export {
    getAllProducts,
    getProductById,
};
