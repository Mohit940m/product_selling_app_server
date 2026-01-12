import { Request, Response } from "express";
import { AuthRequest } from '../../auth/auth.middleware.js';
import Product from "../../models/productModels/product.model.js";
import { handleProductImageUpload } from "../../middlewares/imageUploadHandler.js";

const createProduct = async (req: AuthRequest, res: Response) => {
    // Use the middleware to handle file upload before processing the body
    handleProductImageUpload(req, res, async () => {
        try {
            // Ensure seller is authenticated
            if (!req.seller) {
                return res.status(401).json({ 
                    success: false, 
                    message: "Unauthorized. Seller not found." 
                });
            }
            const sellerId = req.seller._id;

            const { name, description, price, category, stock } = req.body;

            // Validation
            if (!name || !description || !price || !category) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Please provide all required fields: name, description, price, category." 
                });
            }

            // Check for uploaded images
            const files = (req as any).files as Express.Multer.File[];
            if (!files || files.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: "At least one product image is required." 
                });
            }

            // Extract image URLs
            const images = files.map((file) => file.path);

            const newProduct = await Product.create({ 
                name, 
                description, 
                price, 
                category, 
                stock: stock || 0, 
                images, 
                sellerId 
            });

            return res.status(201).json({
                success: true,
                message: "Product created successfully",
                data: newProduct
            });
        } catch (error: any) {
            console.error("Create Product Error:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    });
};

export { createProduct };