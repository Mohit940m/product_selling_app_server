import { Request, Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from '../../auth/auth.middleware.js';
import Product from "../../models/productModels/product.model.js";
import { v2 as cloudinary } from 'cloudinary';
import Variant from "../../models/productModels/variant.model.js";
import { IVariantDocument } from "../../models/productModels/variant.model.js";

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

        let { name, description, category, variantTypes, variants } = req.body;

        // Validation
        const missingFields = [];
        if (!name) missingFields.push("name");
        if (!description) missingFields.push("description");
        if (!category) missingFields.push("category");
        if (!variantTypes) missingFields.push("variantTypes");
        if (!variants) missingFields.push("variants");

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Please provide all required fields: ${missingFields.join(", ")}.`
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

        // Parse JSON strings if coming from form-data
        try {
            if (typeof variantTypes === 'string') variantTypes = JSON.parse(variantTypes);
            if (typeof variants === 'string') variants = JSON.parse(variants);
        } catch (err) {
            return res.status(400).json({
                success: false,
                message: "Invalid JSON format for variantTypes or variants."
            });
        }

        const newProduct = await Product.create({
            name,
            description,
            category,
            variantTypes,
            images,
            sellerId
        });

        // Create Variants
        if (Array.isArray(variants)) {
            const variantsData = variants.map((v: any) => ({
                ...v,
                productId: newProduct._id
            }));
            
            // Create sequentially to ensure SKU random code consistency (via model hook)
            const createdVariants: IVariantDocument[] = [];
            for (const vData of variantsData) {
                // Ensure this line has balanced parentheses
                createdVariants.push((await Variant.create(vData)) as unknown as IVariantDocument);
            }

            // Update the product with the created variant IDs
            newProduct.variants = createdVariants.map((variant) => variant._id as mongoose.Types.ObjectId);
            await newProduct.save();
        }

        return res.status(201).json({
            success: true,
            message: "Product created successfully",
            data: newProduct,
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

        const { name, description, category, imagesToDelete } = req.body;

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
        if (category) product.category = category;
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


// increase stock of any product

const increaseStock = async (req: AuthRequest, res: Response) => {
    try {
        // Ensure seller is authenticated
        if (!req.seller) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Seller not found."
            });
        }

        const { productId } = req.params;
        const { addedStock, variantId } = req.body;

        if (!variantId) {
            return res.status(400).json({
                success: false,
                message: "Variant ID is required to increase stock."
            });
        }

        // Verify product ownership first
        const product = await Product.findOne({ _id: productId, sellerId: req.seller._id });
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found or unauthorized." });
        }

        // Update the variant stock using atomic update 
        const variant = await Variant.findOneAndUpdate(
            { _id: variantId, productId },
            { $inc: { stock: addedStock } },
            { new: true }
        );

        if (!variant) {
            return res.status(404).json({ success: false, message: "Variant not found." });
        }

        return res.status(200).json({
            success: true,
            message: `Stock increased successfully`,
            data: { product: productId, variantId: variant._id, stock: variant.stock, productName: product.name }
        });
    } catch (error: any) {
        console.error("Increase Stock Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// edit price of any product variant
const editVariantPrice = async (req: AuthRequest, res: Response) => {
    try {
        // Ensure seller is authenticated
        if (!req.seller) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Seller not found."
            });
        }

        const { productId } = req.params;
        const { price, variantId } = req.body;

        if (!variantId || price === undefined) {
            return res.status(400).json({
                success: false,
                message: "Variant ID and price are required."
            });
        }

        // Verify product ownership first
        const product = await Product.findOne({ _id: productId, sellerId: req.seller._id });
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found or unauthorized." });
        }

        // Update the variant price
        const variant = await Variant.findOneAndUpdate(
            { _id: variantId, productId },
            { $set: { price: price } },
            { new: true }
        );

        if (!variant) {
            return res.status(404).json({ success: false, message: "Variant not found." });
        }

        const variantInfo = Object.entries(variant.attributes)
                    .map(([key, value]) => `${key} ${value}`)
                    .join(', ');

        return res.status(200).json({
            success: true,
            message: `Price updated successfully`,
            data: { 
                product: productId,
                variantId: variant._id,
                price: variant.price,
                productName: product.name,
                variant: variantInfo,
            }
        });
    } catch (error: any) {
        console.error("Edit Variant Price Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// get all products of a seller with pagination, filtering and search
const getAllProducts = async (req: AuthRequest, res: Response) => {
    try {
        // Ensure seller is authenticated
        if (!req.seller) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Seller not found."
            });
        }
        const { page = 1, limit = 10, category, search } = req.query;

        let query: any = { isDeleted: false };

        if (category) {
            query.category = category;
        }
        if (search) {
            query.name = { $regex: new RegExp(search as string, 'i') };
        }

        // Fetch products with populated variants
        const products = await Product.find(query)
            .skip((+page - 1) * +limit)
            .limit(+limit)
            .select("name category isActive images isFeatured") // Select product fields
            .populate({
                path: "variants",
                model: Variant, // Ensure the correct model is used for population
                select: "sku price", // Select the required fields from the Variant model
            })
            .exec();

        const total = await Product.countDocuments(query);

        // Restructure the data to include only one variant's sku and price at the product level
        const formattedProducts = products.map((product) => {
            const firstVariant = (product.variants[0] as unknown as IVariantDocument) || {}; // Cast the first variant to the Variant type or use an empty object
            return {
                _id: product._id,
                name: product.name,
                category: product.category,
                isActive: product.isActive,
                images: product.images,
                isFeatured: product.isFeatured,
                sku: firstVariant.sku || null, // Include the first variant's sku
                price: firstVariant.price || null // Include the first variant's price
            };
        });

        return res.status(200).json({
            success: true,
            message: "Products fetched successfully",
            data: { products: formattedProducts, total, page: +page, limit: +limit }
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

// get product by id

const getProductById = async (req: AuthRequest, res: Response) => {
    try {
        // Ensure seller is authenticated
        if (!req.seller) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Seller not found."
            });
        }
        const { productId } = req.params;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        const variants = await Variant.find({ productId });

        return res.status(200).json({
            success: true,
            message: "Product fetched successfully",
            data: { ...product.toObject(), variants }
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

// Add a new variant to an existing product
const addVariant = async (req: AuthRequest, res: Response) => {
    try {
        // Ensure seller is authenticated
        if (!req.seller) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Seller not found."
            });
        }
        const { productId } = req.params;
        const { attributes, price, stock } = req.body;

        const product = await Product.findOne({ _id: productId, sellerId: req.seller._id });
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found or unauthorized."
            });
        }

        const newVariant = await Variant.create({
            productId,
            attributes,
            price,
            stock
        });

        product.variants.push(newVariant._id);
        await product.save();

        return res.status(201).json({ success: true, message: "Variant added successfully", data: newVariant });
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Soft delete a product
const deleteProduct = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.seller) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Seller not found."
            });
        }
        const { productId } = req.params;

        const product = await Product.findOne({ _id: productId, sellerId: req.seller._id });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found or unauthorized."
            });
        }

        product.isDeleted = true;
        product.isActive = false;
        await product.save();

        return res.status(200).json({
            success: true,
            message: "Product soft deleted successfully"
        });
    } catch (error: any) {
        console.error("Soft Delete Product Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Hard delete a product (permanent delete with variants and images)
const deleteProductPermanent = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.seller) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Seller not found."
            });
        }
        const { productId } = req.params;

        const product = await Product.findOne({ _id: productId, sellerId: req.seller._id });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found or unauthorized."
            });
        }

        // 1. Delete Images from Cloudinary
        if (product.images && product.images.length > 0) {
            const deletePromises = product.images.map(async (url) => {
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

        // 2. Delete all associated variants
        await Variant.deleteMany({ productId: product._id });

        // 3. Delete the product document
        await Product.deleteOne({ _id: product._id });

        return res.status(200).json({
            success: true,
            message: "Product, variants, and images permanently deleted."
        });
    } catch (error: any) {
        console.error("Hard Delete Product Error:", error);
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
    increaseStock,
    editVariantPrice,
    getAllProducts,
    getProductById,
    addVariant,
    deleteProduct,
    deleteProductPermanent,
};