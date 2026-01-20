import { Response } from "express";
import { AuthRequest } from "../../auth/auth.middleware.js";
import SellerShipping from "../../models/sellerModels/sellerShipping.model.js";

/**
 * Create Shipping Configuration
 * - Allows seller to set up their origin and rates for the first time.
 */
export const createShippingConfig = async (req: AuthRequest, res: Response) => {
    try {
        // Ensure seller is authenticated
        if (!req.seller) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Seller not found."
            });
        }
        const sellerId = req.seller._id;
        const { origin, shippingRates } = req.body;

        // 1. Basic Validation
        if (!origin || !origin.city || !origin.state) {
            return res.status(400).json({
                success: false,
                message: "Origin city and state are required."
            });
        }
        if (!shippingRates) {
            return res.status(400).json({
                success: false,
                message: "Shipping rates are required."
            });
        }

        // 2. Check if configuration already exists
        const existingConfig = await SellerShipping.findOne({ sellerId });
        if (existingConfig) {
            return res.status(409).json({
                success: false,
                message: "Shipping configuration already exists. Please use the edit option."
            });
        }

        // 3. Create Configuration
        // Note: The pre-save hook in the model will automatically calculate the 'region' based on the state.
        const newConfig = await SellerShipping.create({
            sellerId,
            origin,
            shippingRates
        });

        return res.status(201).json({
            success: true,
            message: "Shipping configuration created successfully.",
            data: newConfig
        });

    } catch (error: any) {
        console.error("Create Shipping Config Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * Get Shipping Configuration
 * - Fetches the current settings for the logged-in seller.
 */
export const getShippingConfig = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.seller) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Seller not found."
            });
        }
        const sellerId = req.seller._id;

        const config = await SellerShipping.findOne({ sellerId });
        
        if (!config) {
            return res.status(404).json({
                success: false,
                message: "Shipping configuration not found. Please add shipping details."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Shipping configuration fetched successfully.",
            data: config
        });

    } catch (error: any) {
        console.error("Get Shipping Config Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * Update Shipping Configuration
 * - Allows partial updates to origin or specific shipping rates.
 */
export const updateShippingConfig = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.seller) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Seller not found."
            });
        }
        const sellerId = req.seller._id;
        const { origin, shippingRates } = req.body;

        const config = await SellerShipping.findOne({ sellerId });
        if (!config) {
            return res.status(404).json({
                success: false,
                message: "Shipping configuration not found."
            });
        }

        // 1. Update Origin
        if (origin) {
            if (origin.city) config.origin.city = origin.city;
            if (origin.state) {
                config.origin.state = origin.state;
                // Important: Reset region to undefined so the pre-save hook recalculates it
                // based on the new state.
                config.origin.region = undefined; 
            }
        }

        // 2. Update Rates (Deep Merge)
        // This allows updating just "sameCity" without sending the whole "shippingRates" object.
        if (shippingRates) {
            if (shippingRates.sameCity) config.shippingRates.sameCity = { ...config.shippingRates.sameCity, ...shippingRates.sameCity };
            if (shippingRates.sameState) config.shippingRates.sameState = { ...config.shippingRates.sameState, ...shippingRates.sameState };
            if (shippingRates.sameRegion) config.shippingRates.sameRegion = { ...config.shippingRates.sameRegion, ...shippingRates.sameRegion };
            if (shippingRates.restOfIndia) config.shippingRates.restOfIndia = { ...config.shippingRates.restOfIndia, ...shippingRates.restOfIndia };
            if (shippingRates.remote) config.shippingRates.remote = { ...config.shippingRates.remote, ...shippingRates.remote };
        }

        await config.save();

        return res.status(200).json({
            success: true,
            message: "Shipping configuration updated successfully.",
            data: config
        });

    } catch (error: any) {
        console.error("Update Shipping Config Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * Calculate Shipping Cost (Preview)
 * - Helper endpoint to test the calculation logic based on a destination.
 */
export const calculateShippingCost = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.seller) {
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }
        const sellerId = req.seller._id;
        const { destinationCity, destinationState } = req.body;

        if (!destinationCity || !destinationState) {
             return res.status(400).json({ 
                 success: false, 
                 message: "Destination city and state are required to calculate cost." 
             });
        }

        const config = await SellerShipping.findOne({ sellerId });
        if (!config) {
            return res.status(404).json({ success: false, message: "Shipping configuration not found." });
        }

        // Use the smart method defined in the model
        const result = config.calculateShipping({ 
            city: destinationCity, 
            state: destinationState 
        });

        return res.status(200).json({
            success: true,
            message: "Shipping calculated successfully.",
            data: result
        });

    } catch (error: any) {
         return res.status(500).json({ success: false, message: error.message });
    }
};