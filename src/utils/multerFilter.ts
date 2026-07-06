import { Request } from "express";
import multer from "multer";
import path from "path";

/**
 * Standard file filter for Multer uploads to restrict files to allowed image formats only.
 */
export const multerFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const mimeType = allowedTypes.test(file.mimetype);
  const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());

  if (mimeType && extName) {
    return cb(null, true);
  }
  cb(new Error("Only images (jpeg, jpg, png, gif, webp) are allowed"));
};
