import { Request, Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from '../../auth/auth.middleware.js';
import Product from "../../models/productModels/product.model.js";
import { v2 as cloudinary } from 'cloudinary';
import Variant from "../../models/productModels/variant.model.js";
import { IVariantDocument } from "../../models/productModels/variant.model.js";
import { escapeRegex } from "../../utils/regex.util.js";

const createCloudinaryUploadSignature = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.seller) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Seller not found."
            });
        }

        const timestamp = Math.round(Date.now() / 1000);
        const folder = "e-commerce/products";
        const signature = cloudinary.utils.api_sign_request(
            { timestamp, folder },
            process.env.CLOUDINARY_API_SECRET as string
        );

        return res.status(200).json({
            success: true,
            message: "Cloudinary upload signature generated successfully.",
            data: {
                cloudName: process.env.CLOUDINARY_CLOUD_NAME,
                apiKey: process.env.CLOUDINARY_API_KEY,
                timestamp,
                folder,
                signature,
            }
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Failed to create Cloudinary upload signature.",
            error: error.message
        });
    }
};

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

        let { name, description, category, variantTypes, variants, productImagesURL } = req.body;

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

        // Handle Images: Prefer uploaded files, fallback to URLs
        const files = (req as any).files as Express.Multer.File[];
        let images: string[] = [];

        if (files && files.length > 0) {
            images = files.map((file) => file.path);
        } else if (productImagesURL) {
            // Parse JSON stringified array if provided as a string, or use directly if array
            if (typeof productImagesURL === 'string') {
                if (productImagesURL.trim().startsWith('[') && productImagesURL.trim().endsWith(']')) {
                    try {
                        images = JSON.parse(productImagesURL);
                    } catch (err) {
                        images = [productImagesURL];
                    }
                } else {
                    images = [productImagesURL];
                }
            } else if (Array.isArray(productImagesURL)) {
                images = productImagesURL;
            }
        }

        if (images.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one product image is required (file upload or URL)."
            });
        }

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

        // Validate every variant BEFORE creating anything. The loop below
        // creates the Product, then each Variant one at a time with no
        // transaction and no rollback on failure — if variant N is invalid,
        // the Product and variants 1..N-1 are already persisted, orphaned
        // (newProduct.variants only gets updated with the created ids after
        // the whole loop finishes), while the client just sees a 500
        // suggesting nothing was created. Catching bad input here, before
        // any write happens, prevents the single most likely trigger for
        // that partial-creation state — the same validation addVariant
        // gained earlier this session, applied per-element. It doesn't
        // cover a genuine mid-loop DB failure (a dropped connection, a sku
        // collision on one variant); a real fix for that needs a
        // transaction, which isn't added here since it'd need verifying
        // this deployment's MongoDB actually runs as a replica set
        // (transactions fail outright on a standalone instance) — not
        // something to assume blind.
        if (Array.isArray(variants)) {
            for (let i = 0; i < variants.length; i++) {
                const v = variants[i];
                const attrs = v?.attributes;
                if (!attrs || typeof attrs !== "object" || Array.isArray(attrs) || Object.keys(attrs).length === 0) {
                    return res.status(400).json({
                        success: false,
                        message: `Variant ${i + 1}: at least one attribute is required.`
                    });
                }
                if (typeof v?.price !== "number" || !Number.isFinite(v.price) || v.price <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: `Variant ${i + 1}: price must be a positive number.`
                    });
                }
                if (v?.stock !== undefined && (typeof v.stock !== "number" || !Number.isFinite(v.stock) || v.stock < 0)) {
                    return res.status(400).json({
                        success: false,
                        message: `Variant ${i + 1}: stock cannot be negative.`
                    });
                }
            }
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

        const { name, description, category, imagesToDelete, productImagesURL } = req.body;

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

        // 2. Handle New Image Uploads: prefer uploaded files, fallback to
        // client-uploaded Cloudinary URLs — mirrors createProduct's
        // handling. The seller admin app uploads new images directly to
        // Cloudinary and sends the resulting URLs as `productImagesURL`
        // rather than raw files, so without this fallback every new image
        // added during an edit was silently dropped (req.files was always
        // empty for that flow, and the URLs were never read).
        const files = (req as any).files as Express.Multer.File[];
        let newImages: string[] = [];
        if (files && files.length > 0) {
            newImages = files.map((file) => file.path);
        } else if (productImagesURL) {
            if (typeof productImagesURL === 'string') {
                if (productImagesURL.trim().startsWith('[') && productImagesURL.trim().endsWith(']')) {
                    try {
                        newImages = JSON.parse(productImagesURL);
                    } catch (err) {
                        newImages = [productImagesURL];
                    }
                } else {
                    newImages = [productImagesURL];
                }
            } else if (Array.isArray(productImagesURL)) {
                newImages = productImagesURL;
            }
        }

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
        const { status } = req.body;
        const { productId } = req.params;

        // Scoped by sellerId, matching every other product-write function
        // in this file. This previously used a bare findById with no
        // ownership check at all, letting any authenticated seller
        // activate/deactivate any other seller's product.
        const product = await Product.findOne({ _id: productId, sellerId: req.seller._id });
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found or unauthorized."
            });
        }

        // Update the product status
        product.isActive = status;
        const updatedProduct = await product.save();

        return res.status(200).json({
            success: true,
            message: `Product status updated successfully: ${status ? "activated" : "deactivated"}`,
            data: { product: productId, isActive: updatedProduct.isActive, productName: updatedProduct.name }
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
        // Nothing previously checked addedStock's type or sign — a negative
        // value would pass straight through to $inc below and silently
        // decrement stock instead of increasing it, despite this endpoint's
        // name and the frontend's own addedStock > 0 assumption.
        if (typeof addedStock !== "number" || !Number.isFinite(addedStock) || addedStock <= 0) {
            return res.status(400).json({
                success: false,
                message: "addedStock must be a positive number."
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
        if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
            return res.status(400).json({
                success: false,
                message: "Price must be a positive number."
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

const editVariantStatus = async (req: AuthRequest, res: Response) => {
    try {
        // Ensure seller is authenticated
        if (!req.seller) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Seller not found."
            });
        }
        const { status, variantId } = req.body;
        const { productId } = req.params;

        // Scoped by sellerId, matching every other product-write function
        // in this file. This previously used a bare findById with no
        // ownership check at all, letting any authenticated seller
        // activate/deactivate any other seller's variant.
        const product = await Product.findOne({ _id: productId, sellerId: req.seller._id });
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found or unauthorized."
            });
        }

        // findById takes a single id value, not a filter object — passing
        // { _id: variantId, productId } here nested the whole object
        // *as* the _id condition instead of matching on two separate
        // fields, so this could never match a real document (confirmed
        // empirically: the cast query came out as
        // {"_id":{"_id":...,"productId":...}}). This endpoint 404'd
        // unconditionally regardless of whether the variant existed.
        const variant = await Variant.findOne({ _id: variantId, productId });
        if (!variant) {
            return res.status(404).json({
                success: false,
                message: "Variant not found"
            });
        }

        // Update the variant status
        variant.isActive = status;
        const updatedVariant = await variant.save();

        return res.status(200).json({
            success: true,
            message: `Variant status updated successfully: ${status ? "activated" : "deactivated"}`,
            data: { product: productId, isActive: updatedVariant.isActive, productName: product.name }
        });
    } catch (error: any) {
        console.error("Edit Product Variant Status Error:", error);
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

        // Was missing entirely: without this, every seller's product list
        // returned every OTHER seller's products too — a cross-tenant data
        // leak on the primary landing page of the seller's product
        // management flow, not a narrow/guess-an-id case like the other
        // authorization gaps fixed earlier this session. Every mutation
        // endpoint (editProductStatus, deleteProduct, etc.) already scopes
        // correctly by sellerId, so this specifically affected what a
        // seller could *see* in their own product list, not what they
        // could successfully edit/delete.
        let query: any = { isDeleted: false, sellerId: req.seller._id };

        if (category) {
            query.category = category;
        }
        if (search) {
            query.name = { $regex: new RegExp(escapeRegex(search as string), 'i') };
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

        // Scoped by sellerId, matching every other function in this file
        // (editProduct, addVariant, editVariantPrice, deleteProduct, ...).
        // This previously used a bare findById with no ownership check at
        // all, letting any authenticated seller view any other seller's
        // product details, stock, and pricing just by guessing an ID.
        const product = await Product.findOne({ _id: productId, sellerId: req.seller._id });
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found or unauthorized."
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

        // Without this, a missing/invalid field just reached Variant.create()
        // unguarded and relied on the model's own min bounds to reject it —
        // which they do, but as a raw Mongoose ValidationError caught by
        // this function's generic catch block and reported as a 500,
        // the wrong status for a client input error. Same reasoning as
        // editVariantPrice/increaseStock's explicit guards above.
        if (!attributes || typeof attributes !== "object" || Array.isArray(attributes) || Object.keys(attributes).length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one variant attribute is required."
            });
        }
        if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
            return res.status(400).json({
                success: false,
                message: "Price must be a positive number."
            });
        }
        if (stock !== undefined && (typeof stock !== "number" || !Number.isFinite(stock) || stock < 0)) {
            return res.status(400).json({
                success: false,
                message: "Stock cannot be negative."
            });
        }

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
    createCloudinaryUploadSignature,
    createProduct,
    editProduct,
    editProductStatus,
    increaseStock,
    editVariantPrice,
    editVariantStatus,
    getAllProducts,
    getProductById,
    addVariant,
    deleteProduct,
    deleteProductPermanent,
};
