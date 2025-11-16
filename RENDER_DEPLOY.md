# Render Deployment Guide for PayPal Payout API

## Step 1: Create a Render Account

1. Go to https://render.com
2. Sign up for a free account (GitHub sign-in recommended)

## Step 2: Create a New Web Service

1. Click **"New +"** in the Render dashboard
2. Select **"Web Service"**
3. Connect your GitHub repository: `jhamir-web/voyago-web`

## Step 3: Configure the Service

Use these settings:

- **Name**: `voyago-paypal-payout`
- **Environment**: `Node`
- **Region**: Choose closest to you (e.g., `Oregon (US West)`)
- **Branch**: `main`
- **Root Directory**: Leave empty (or `./` if required)
- **Build Command**: `npm install`
- **Start Command**: `npm start`

## Step 4: Set Environment Variables

Click **"Advanced"** → **"Environment Variables"** and add:

```
PAYOUT_API_KEY=voyago-secret-api-key-2024
PAYPAL_CLIENT_ID=ASEGKmY1EZ2TiV4AJdCqlBsoKQVcKBYBPsloT6k7P1LdpKKrLcV3qQtXMrKySCWPnh7TxU10mW8HUh84
PAYPAL_SECRET=your-paypal-secret-here
PAYPAL_MODE=sandbox
PORT=3000
NODE_ENV=production
```

**Important**: 
- Replace `your-paypal-secret-here` with your actual PayPal Secret
- Keep `PAYPAL_MODE=sandbox` for testing, change to `live` for production

## Step 5: Deploy

1. Click **"Create Web Service"**
2. Render will start deploying automatically
3. Wait for deployment to complete (usually 2-3 minutes)

## Step 6: Get Your Render URL

Once deployed, you'll get a URL like:
```
https://voyago-paypal-payout.onrender.com
```

Copy this URL - you'll need it for the next step.

## Step 7: Update Your Client Code

1. Open `src/firebase.js`
2. Find the `PAYOUT_SERVER_URL` constant
3. Replace it with your Render URL:

```javascript
const PAYOUT_SERVER_URL = "https://voyago-paypal-payout.onrender.com";
```

4. Save and commit the changes

## Step 8: Test

1. Go to your admin dashboard
2. Try marking a withdrawal as "Completed"
3. Check the browser console - CORS errors should be gone!
4. Check Render logs to see `[CORS]` and `[PAYPAL SUCCESS]` messages

## Troubleshooting

### Service keeps sleeping (free plan)
- Free Render services sleep after 15 minutes of inactivity
- First request after sleep may take ~30 seconds (cold start)
- Consider upgrading to paid plan for always-on service

### CORS errors persist
- Make sure your Render URL is correct in `src/firebase.js`
- Check Render logs to see if requests are reaching the server
- Verify `cors` middleware is working in `server.js`

### PayPal errors
- Check that `PAYPAL_SECRET` is set correctly in Render
- Verify PayPal credentials are correct
- Check Render logs for detailed error messages

## Monitoring

- View logs: Render Dashboard → Your Service → "Logs" tab
- Monitor uptime: Render Dashboard → Your Service → "Metrics" tab

## Next Steps

After testing successfully:
1. Keep using sandbox for development
2. When ready for production:
   - Set `PAYPAL_MODE=live` in Render
   - Use production PayPal Client ID and Secret
   - Update `PAYOUT_API_KEY` to a stronger value

