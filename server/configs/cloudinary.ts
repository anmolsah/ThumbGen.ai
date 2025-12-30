import { v2 as cloudinary } from "cloudinary";

// Cloudinary auto-configures from CLOUDINARY_URL env variable
// This file ensures it's initialized before use

if (!process.env.CLOUDINARY_URL) {
  console.warn("Warning: CLOUDINARY_URL not set");
}

export default cloudinary;
