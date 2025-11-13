# How to Upload Hero Video to Cloudinary

This guide will help you upload your hero video to Cloudinary so it's available for all users when you deploy your site.

## Step 1: Prepare Your Video

1. **Find or create your video:**
   - Should be a house interior b-roll or travel/accommodation video
   - Recommended format: MP4
   - Recommended resolution: 1920x1080 (Full HD) or higher
   - Keep file size reasonable (under 50MB for faster loading)

2. **Video requirements:**
   - Format: MP4, WebM, or MOV
   - Duration: 10-30 seconds (will loop)
   - Aspect ratio: 16:9 works best
   - No audio needed (will be muted)

## Step 2: Upload to Cloudinary

### Option A: Using Cloudinary Dashboard (Easiest)

1. **Go to Cloudinary Dashboard:**
   - Visit: https://cloudinary.com/console
   - Log in to your account

2. **Navigate to Media Library:**
   - Click "Media Library" in the left sidebar
   - Click "Upload" button (top right)

3. **Upload your video:**
   - Click "Upload" or drag and drop your video file
   - Wait for upload to complete

4. **Get the video URL:**
   - Once uploaded, click on the video in Media Library
   - You'll see the video details
   - **Copy the "Secure URL"** (starts with `https://res.cloudinary.com/...`)
   - It should look like: `https://res.cloudinary.com/dyrbmse6x/video/upload/v1234567890/your-video-name.mp4`

5. **Or get the Public ID:**
   - The "Public ID" is the identifier (e.g., `voyago/hero-video`)
   - You can use this with the helper function

### Option B: Using Cloudinary Upload Widget (Programmatic)

If you want to upload via code, you can use Cloudinary's upload widget, but for a one-time hero video, the dashboard is easier.

## Step 3: Update Your Code

1. **Open:** `src/config/cloudinary.js`

2. **Replace the video URL:**
   ```javascript
   // Option 1: Use full URL (easiest)
   export const HERO_VIDEO_URL = "https://res.cloudinary.com/dyrbmse6x/video/upload/v1234567890/your-video-name.mp4";
   
   // Option 2: Use Public ID (will use helper function)
   export const HERO_VIDEO_URL = "voyago/hero-video";
   ```

3. **Save the file**

## Step 4: Test

1. **Start your dev server:** `npm run dev`
2. **Check the home page** - the video should load from Cloudinary
3. **Test on different devices** to ensure it works

## Step 5: Optimize Video (Optional but Recommended)

Cloudinary can automatically optimize videos. You can add transformations to the URL:

**Example optimized URL:**
```
https://res.cloudinary.com/dyrbmse6x/video/upload/f_auto,q_auto:best/v1234567890/voyago/hero-video.mp4
```

**Transformations:**
- `f_auto` - Auto format (serves best format for browser)
- `q_auto:best` - Auto quality (best quality)
- `w_1920` - Set width (e.g., 1920px)
- `h_1080` - Set height (e.g., 1080px)

## Troubleshooting

### Video not loading?
- Check the URL is correct in `cloudinary.js`
- Make sure the video is set to "Public" in Cloudinary
- Check browser console for errors
- Try the full URL instead of Public ID

### Video too large/slow?
- Use Cloudinary transformations to reduce size
- Add `q_auto:good` for lower quality but faster loading
- Add `w_1920` to limit width

### Video format issues?
- Convert to MP4 if needed
- Use Cloudinary's auto-format: add `f_auto` to URL

## Quick Reference

**Cloudinary Video URL Format:**
```
https://res.cloudinary.com/{cloudName}/video/upload/{transformations}/{publicId}.{format}
```

**Your current cloud name:** `dyrbmse6x`

**Example:**
```
https://res.cloudinary.com/dyrbmse6x/video/upload/f_auto,q_auto:best/voyago/hero-video.mp4
```

## Need Help?

- Cloudinary Docs: https://cloudinary.com/documentation/video_upload
- Cloudinary Dashboard: https://cloudinary.com/console
- Check your Media Library for uploaded videos

