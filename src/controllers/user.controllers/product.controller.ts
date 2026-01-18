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
        const { page = 1, limit = 10, category, search } = req.query;

        let query: any = { isDeleted: false};


        if (category) {
            query.category = category;
        }
        if (search) {
            query.name = { $regex: new RegExp(search as string, 'i') };
        }

        const products = await Product.find(query)
            .skip((+page - 1) * +limit)
            .limit(+limit)
            .select("name price category isActive images[0] isFeatured");
        const total = await Product.countDocuments(query);

        return res.status(200).json({
            success: true,
            message: "Products fetched successfully",
            data: { products, total, page: +page, limit: +limit }
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

export {
    getAllProducts,
};
