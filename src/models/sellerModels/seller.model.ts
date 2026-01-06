import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";

export interface ISellerDocument extends Document {
  name: string;
  email: string;
  password: string;
  phone?: string;
  isEmailVerified: boolean;
  isActive: boolean;
  isDeleted: boolean;
  comparePassword(password: string): Promise<boolean>;
}

const sellerSchema = new Schema<ISellerDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },

    phone: {
      type: String,
      unique: true,
      sparse: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
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
  { timestamps: true }
);

/* Hash password */
sellerSchema.pre('save', async function(next: any) {
  if (!this.isModified('password')) {
    return next();
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

/* Compare password */
sellerSchema.methods.comparePassword = async function (
  password: string
) {
  return bcrypt.compare(password, this.password);
};

export default mongoose.model<ISellerDocument>("Seller", sellerSchema);
