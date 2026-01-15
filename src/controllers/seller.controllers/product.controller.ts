import { Request, Response } from "express";
import { AuthRequest } from '../../auth/auth.middleware.js';
import Product from "../../models/productModels/product.model.js";
import { v2 as cloudinary } from 'cloudinary';

const createProduct = async (req: AuthRequest, res: Response) => {
    // Use the middleware to handle file upload before processing the body
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
};

const editProduct = async (req: AuthRequest, res: Response) => {
    try {
        // Ensure seller is authenticated
        if (!req.seller) {
            return res.status(401).json({ 
                success: false, 
                message: "Unauthorized. Seller not found." 
            });
        }
        const sellerId = req.seller._id;
        const { productId } = req.params;

        const { name, description, price, category, stock, imagesToDelete } = req.body;

        const product = await Product.findOne({ _id: productId, sellerId });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found or you are not authorized to edit this product."
            });
        }

        // 1. Handle Image Deletion
        let updatedImages = [...product.images];
        
        let imagesToDeleteArray: string[] = [];
        if (imagesToDelete) {
            if (Array.isArray(imagesToDelete)) {
                imagesToDeleteArray = imagesToDelete as string[];
            } else if (typeof imagesToDelete === 'string') {
                // Check if it's a JSON stringified array
                if (imagesToDelete.trim().startsWith('[') && imagesToDelete.trim().endsWith(']')) {
                    try {
                        imagesToDeleteArray = JSON.parse(imagesToDelete);
                    } catch (err) {
                        imagesToDeleteArray = [imagesToDelete];
                    }
                } else {
                    imagesToDeleteArray = [imagesToDelete];
                }
            }
        }

        if (imagesToDeleteArray.length > 0) {
            // Filter out images to delete from the product array
            updatedImages = updatedImages.filter(img => !imagesToDeleteArray.includes(img));

            // Delete from Cloudinary
            const deletePromises = imagesToDeleteArray.map(async (url) => {
                if (typeof url !== 'string') return;
                try {
                    const regex = /\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/;
                    const match = url.match(regex);
                    if (match && match[1]) {
                        await cloudinary.uploader.destroy(match[1]);
                    }
                } catch (err) {
                    console.error(`Failed to delete image ${url} from Cloudinary:`, err);
                }
            });
            await Promise.all(deletePromises);
        }

        // 2. Handle New Image Uploads
        const files = (req as any).files as Express.Multer.File[];
        const newImages = files ? files.map((file) => file.path) : [];

        // 3. Check Image Count Limit (Max 5)
        if (updatedImages.length + newImages.length > 5) {
            // Cleanup newly uploaded files since the operation failed
            const cleanupPromises = newImages.map(async (url) => {
                const regex = /\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/;
                const match = url.match(regex);
                if (match && match[1]) await cloudinary.uploader.destroy(match[1]);
            });
            await Promise.all(cleanupPromises);
            return res.status(400).json({
                success: false,
                message: "Image limit exceeded. A product can have at most 5 images."
            });
        }

        // Merge existing (kept) images with new images
        updatedImages = [...updatedImages, ...newImages];

        // 4. Update Fields
        if (name) product.name = name;
        if (description) product.description = description;
        if (price) product.price = price;
        if (category) product.category = category;
        if (stock !== undefined) product.stock = stock;
        product.images = updatedImages;

        await product.save();

        return res.status(200).json({
            success: true,
            message: "Product updated successfully",
            data: product
        });

    } catch (error: any) {
        console.error("Edit Product Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

const editProductStatus = async (req: AuthRequest, res: Response) => {
    try {
        // Ensure seller is authenticated
        if (!req.seller) {
            return res.status(401).json({ 
                success: false, 
                message: "Unauthorized. Seller not found." 
            });
        }
        // const sellerId = req.seller._id;
        const { status } = req.body;
        const { productId } = req.params;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        // Update the product status
        product.isActive = status;
        await product.save();

        return res.status(200).json({
            success: true,
            message: `Product status updated successfully: ${status ? "activated" : "deactivated"}`,
            data: { product: productId, isActive: product.isActive, productName: product.name }
        });
    } catch (error: any) {
        console.error("Edit Product Status Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

export { 
    createProduct,
    editProduct,
    editProductStatus,
};