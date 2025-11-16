# PayPal Payout Server

Simple Express.js server for processing PayPal payouts without requiring Firebase billing.

## 🚀 Quick Start

### Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start server**:
   ```bash
   npm start
   ```

Server runs on: http://localhost:3000

### Environment Variables

Create a `.env` file (already created with your credentials):

```
PAYPAL_CLIENT_ID=ASEGKmY1EZ2TiV4AJdCqlBsoKQVcKBYBPsloT6k7P1LdpKKrLcV3qQtXMrKySCWPnh7TxU10mW8HUh84
PAYPAL_SECRET=EI1dd97b5nt7sVhAOfLpICJd5iRKh9xARnGN0y58mBT1i8V3jZfsR7Ojtbqkz0kW7d_z-ITb-YhWdzAO
PAYPAL_MODE=sandbox
API_KEY=voyago-secret-api-key-2024
PORT=3000
```

## 📦 Deploy to Render (Recommended)

1. Go to https://render.com and sign up
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `voyago-paypal-payout`
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Add environment variables (same as .env file)
6. Deploy!

## 📦 Deploy to Railway

1. Go to https://railway.app
2. Click "New Project" → "Deploy from GitHub repo"
3. Set Root Directory to: `server`
4. Add environment variables
5. Deploy!

## ✅ Testing

After deployment, update `src/firebase.js` with your server URL:

```javascript
const PAYOUT_SERVER_URL = "https://your-app.onrender.com";
```
