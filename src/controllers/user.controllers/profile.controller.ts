import { Request, Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import User from '../../models/userModels/user.model.js';
import Address from '../../models/userModels/address.model.js';
import { AuthRequest } from '../../auth/auth.middleware.js';

// Controller to handle user profile related operations
// Get User Profile
// Retrieves the profile of the authenticated user
const getUserProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required.'
      });
    }

    const userId = req.user._id;

    // Assuming req.user is populated by the authentication middleware
    const user = await User.findById(userId)
    .select(" name email phone profileImage dob gender  isActive isDeleted  isPhoneVerified isEmailVerified defaultAddress")
    .populate("defaultAddress", "fullName phone addressLine1 addressLine2 city state pincode country isDefault");

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found.' 
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ 
        success: false,
        message: 'Your account is inactive. Please contact support.' 
      });
    }

    if (user.isDeleted) {
      return res.status(403).json({ 
        success: false,
        message: 'Your account has been deleted.' 
      });
    }

    return res.status(200).json({ 
      success: true,
      data: user
    });
  } catch (error: any) {
    return res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

const editUserProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required.'
      });
    }

    const { name, email, phone, dob, gender } = req.body;

    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    if (email && email !== user.email) {
      const existingEmailUser = await User.findOne({ email, _id: { $ne: userId } });
      if (existingEmailUser) {
        return res.status(400).json({ 
          success: false,
          message: 'Email is already in use by another account.' 
        });
      }
      user.email = email;
    }

    if (phone && phone !== user.phone) {
      const existingPhoneUser = await User.findOne({ phone, _id: { $ne: userId } });
      if (existingPhoneUser) {
        return res.status(400).json({
          success: false,
          message: 'Phone number is already in use by another account.'
        });
      }
      user.phone = phone;
    }

    if (name) user.name = name;
    if (dob) user.dob = dob;
    if (gender) user.gender = gender;

    if (req.file) {
      const defaultImage = "https://cdn.pixabay.com/photo/2023/02/18/11/00/icon-7797704_640.png";
      if (user.profileImage && user.profileImage !== defaultImage) {
        const splitUrl = user.profileImage.split('/upload/');
        if (splitUrl.length === 2) {
          const afterUpload = splitUrl[1];
          const versionRemoved = afterUpload.replace(/^v\d+\//, '');
          const publicId = versionRemoved.substring(0, versionRemoved.lastIndexOf('.'));
          await cloudinary.uploader.destroy(publicId);
        }
      }
      user.profileImage = req.file.path;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: user
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// add shipping address controller 
const addShippingAddress = async (req: AuthRequest, res: Response) => {
  try {    
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required.'
      });
    }
    const { fullName, phone, addressLine1, addressLine2, city, state, pincode, country, isDefault } = req.body;
    const userId = req.user._id;
    
    // Check if this is the first address for the user
    const addressCount = await Address.countDocuments({ user: userId });

    let makeDefault = isDefault === true;

    // If it's the first address, force it to be default
    if (addressCount === 0) {
      makeDefault = true;
    }

    // If this address is set to be default, unset any existing default address
    if (makeDefault) {
      await Address.updateMany(
        { user: userId, isDefault: true },
        { isDefault: false }
      );
    }

    const newAddress = new Address({
      user: userId,
      fullName,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
      country,
      isDefault: makeDefault
    });

    await newAddress.save();

    // Update User model if default
    if (makeDefault) {
      await User.findByIdAndUpdate(userId, { defaultAddress: newAddress._id });
    }

    return res.status(201).json({
      success: true,
      message: 'Address added successfully.',
      data: newAddress
    });

  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};



  const editShippingAddress = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }
    const userId = req.user._id;
    const { addressId } = req.params;
    const { fullName, phone, addressLine1, addressLine2, city, state, pincode, country, isDefault } = req.body;

    const address = await Address.findOne({ _id: addressId, user: userId });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found.'
      });
    }

    if (fullName) address.fullName = fullName;
    if (phone) address.phone = phone;
    if (addressLine1) address.addressLine1 = addressLine1;
    if (addressLine2 !== undefined) address.addressLine2 = addressLine2;
    if (city) address.city = city;
    if (state) address.state = state;
    if (pincode) address.pincode = pincode;
    if (country) address.country = country;

    if (isDefault !== undefined) {
      if (isDefault === true) {
        await Address.updateMany(
          { user: userId, _id: { $ne: addressId } },
          { isDefault: false }
        );
        address.isDefault = true;
        await User.findByIdAndUpdate(userId, { defaultAddress: address._id });
      } else {
        if (address.isDefault) {
          await User.findOneAndUpdate({ _id: userId, defaultAddress: addressId }, { $unset: { defaultAddress: 1 } });
        }
        address.isDefault = false;
      }
    }

    await address.save();

    const formatatedAddress = {
      _id: address._id,
      fullName: address.fullName,
      phone: address.phone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      country: address.country,
      isDefault: address.isDefault
    };


    return res.status(200).json({
      success: true,
      message: 'Address updated successfully.',
      data: formatatedAddress
    });

  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export { 
  getUserProfile, 
  editUserProfile,
  addShippingAddress,
  editShippingAddress,
};
export {};
