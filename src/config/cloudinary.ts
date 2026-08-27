import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import dotenv from 'dotenv';
dotenv.config();
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
}); 

export const upload = (folderName: string) => {
  const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: `e-commerce/${folderName}`,
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp' ],
      transformation: [{ width: 500, height: 500, crop: 'limit' }],
    } as any,
  });
  // No fileSize limit existed before this — an authenticated user could
  // upload an arbitrarily large file as their profile image (or product
  // image, on the server-side multer path) with nothing to stop it,
  // consuming unbounded bandwidth and Cloudinary storage per request. A
  // generous 10MB ceiling costs no legitimate photo upload anything —
  // this is a safety guard rail, not a meaningful product constraint.
  // multer's LIMIT_FILE_SIZE error is already handled by both callers in
  // imageUploadHandler.ts's existing MulterError branch, so this needs
  // no other code change to take effect cleanly.
  return multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });
};
export {};