import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { upload } from '../config/cloudinary.js';

export const handleProfileImageUpload = (req: Request, res: Response, next: NextFunction) => {
    const uploadMiddleware = upload('users').single('profileImage');
    
    uploadMiddleware(req, res, (err: any) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ success: false, message: `Image upload error: ${err.message}. Expected field name: 'profileImage'` });
        } else if (err) {
            return res.status(500).json({ success: false, message: `Unknown error during upload: ${err.message}` });
        }
        next();
    });
};