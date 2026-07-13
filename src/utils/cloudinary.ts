import { env } from "../config/env";
import { ApiError } from "./apiError";
import { cloudinary } from "../config/cloudinary";

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
}

/**
 * Uploads a buffer (from memory storage) directly to Cloudinary.
 */
export function uploadBufferToCloudinary(
  buffer: Buffer,
  folder: string = "posts"
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
      return reject(ApiError.internal("Cloudinary is not configured on the server"));
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "auto",
      },
      (error, result) => {
        if (error) {
          return reject(ApiError.internal(`Cloudinary upload failed: ${error.message}`));
        }
        if (!result) {
          return reject(ApiError.internal("Cloudinary upload did not return a result"));
        }
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
      }
    );

    uploadStream.write(buffer);
    uploadStream.end();
  });
}
