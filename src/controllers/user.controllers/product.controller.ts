import { Request, Response } from "express";
import { AuthRequest } from '../../auth/auth.middleware.js';
import Product from "../../models/productModels/product.model.js";

// get all products of a seller with pagination, filtering and search
const getAllProducts = async (req: AuthRequest, res: Response) => {
    try {
        // Ensure seller is authenticated
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Seller not found."
            });
        }
        
        // Extract standard params, treat the rest as attribute filters
        const { page = 1, limit = 10, category, search, ...filters } = req.query;
        const pageNum = parseInt(page as string) || 1;
        const limitNum = parseInt(limit as string) || 10;

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
                price: { $min: "$filteredVariants.price" }
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
        
        const products = result[0].data;
        const total = result[0].metadata[0] ? result[0].metadata[0].total : 0;

        return res.status(200).json({
            success: true,
            message: "Products fetched successfully",
            data: { products, total, page: pageNum, limit: limitNum }
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
        // Ensure seller is authenticated
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Seller not found."
            });
        }
        const {productId}  = req.params;

        const product = await Product.findById({ _id: productId, isDeleted: false, isActive: true })
            .select("name description price category images isFeatured");
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Product fetched successfully",
            data: product
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
