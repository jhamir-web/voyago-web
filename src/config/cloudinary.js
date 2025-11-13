// Cloudinary Configuration
// Get these values from your Cloudinary Dashboard: https://cloudinary.com/console

export const cloudinaryConfig = {
  cloudName: "dyrbmse6x", // Replace with your Cloudinary cloud name
  uploadPreset: "voyago-unsigned", // Replace with your upload preset name
  apiKey: "YOUR_API_KEY", // Optional: only needed if using signed uploads
};

// Cloudinary upload URL
export const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`;

// Cloudinary video URL helper
// Use this format: https://res.cloudinary.com/{cloudName}/video/upload/{videoId}.mp4
// Or use the full URL from Cloudinary Media Library
export const getCloudinaryVideoUrl = (videoId) => {
  return `https://res.cloudinary.com/${cloudinaryConfig.cloudName}/video/upload/${videoId}`;
};

// Hero video URL - Replace with your Cloudinary video public ID
// To get this: Upload video to Cloudinary, copy the "Public ID" or full URL
// IMPORTANT: Use MP4 format for best browser compatibility!
// If you have a .3gp or other format, Cloudinary will auto-convert it with transformations
export const HERO_VIDEO_URL = "https://res.cloudinary.com/dyrbmse6x/video/upload/v1762875408/Laowa_12mm_SECRETS_for_Breathtaking_Day_to_Night_Transitions_taroax.mp4";
// Example format: "https://res.cloudinary.com/dyrbmse6x/video/upload/v1234567890/voyago/hero-video.mp4"
// Or just the public ID: "voyago/hero-video" (will use getCloudinaryVideoUrl)
// 
// NOTE: The code will automatically convert .3gp to MP4 using Cloudinary transformations
// But it's better to re-upload as MP4 for best results

