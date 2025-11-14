# Deployment Guide for Voyago

## Setting Up Production URL for Email Verification

When deploying your app, you need to set the production URL so email verification links work correctly.

### Step 1: Create Environment File

Create a `.env` file in the root of your project (same folder as `package.json`):

```bash
# .env
VITE_APP_URL=https://your-deployed-url.web.app
```

**For Firebase Hosting:**
```bash
VITE_APP_URL=https://your-project-id.web.app
```

**For Custom Domain:**
```bash
VITE_APP_URL=https://yourdomain.com
```

### Step 2: Update Before Building

1. Set `VITE_APP_URL` in your `.env` file to your production URL
2. Build your app: `npm run build`
3. Deploy: `npm run deploy` or `firebase deploy`

### Step 3: Verify It Works

After deployment:
1. Sign up with a test account
2. Check the verification email
3. The verification link should point to your production URL, not localhost

## Environment Variables

The app uses these environment variables:

- `VITE_APP_URL` - Your production URL (optional, defaults to current origin)

## Important Notes

- **Development**: If `VITE_APP_URL` is not set, it will use `window.location.origin` (works for localhost)
- **Production**: Always set `VITE_APP_URL` to your deployed URL
- **Firebase Hosting**: Your URL will be `https://your-project-id.web.app` or your custom domain
- The `.env` file is gitignored, so you'll need to set it on your deployment platform

## Setting Environment Variables in Firebase Hosting

If using Firebase Hosting, you can also set environment variables in `firebase.json` or use Firebase Functions environment config.

For static hosting, the easiest way is to:
1. Create `.env.production` file
2. Set `VITE_APP_URL` there
3. Build with `npm run build`
4. Deploy the `dist` folder

## Example .env.production

```bash
VITE_APP_URL=https://voyago-12345.web.app
```


