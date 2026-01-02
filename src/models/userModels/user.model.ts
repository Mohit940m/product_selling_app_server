import mongoose, { Schema, Document } from "mongoose";
import validator from "validator";

export interface IUserDocument extends Document {
  name?: string;
  phone?: string;
  email?: string;
  profileImage?: string;
  dob?: Date;
  gender?: "male" | "female" | "other";
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  isActive: boolean;
  isDeleted?: boolean;
}

const userSchema = new Schema<IUserDocument>(
  {
    name: {
      type: String,
      trim: true,
    },

    phone: {
      type: String,
      unique: true,
      sparse: true, // IMPORTANT for optional unique fields
      index: true,
    },

    email: {
      type: String,
      lowercase: true,
      unique: [true, "Email already exists"],
      trim: true,
      // required: [true, "Email is required"], // making email optional for phone-based registration
      sparse: true,
      index: true,
      validate: [validator.default.isEmail, "Please provide a valid email"],
    },

    profileImage: {
      type: String,
      trim: true,
      default: "https://cdn.pixabay.com/photo/2023/02/18/11/00/icon-7797704_640.png",
    },

    dob: {
      type: Date,
      // required: [true, "Date of birth is required"],
    },

    gender: {
      type: String,
      enum: ["male", "female", "other"], // if app aims for inclusivity then expand this
      // required: [true, "Gender is required"],
    },


    isPhoneVerified: {
      type: Boolean,
      default: false,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model<IUserDocument>("User", userSchema);
 
export default User;
// module.exports = User;
export {};