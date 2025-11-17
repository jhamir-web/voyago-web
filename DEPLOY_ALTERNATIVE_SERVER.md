# 🚀 Alternative: Deploy PayPal Payout Server (No Billing Required!)

Since Firebase Cloud Functions require billing, we'll use a simple Express.js server on a free hosting platform.

---

## ✅ Option 1: Deploy to Render (Recommended - Easiest)

### Step 1: Create Render Account
1. Go to: https://render.com
2. Sign up for free (GitHub login works)

### Step 2: Deploy Server
1. In Render dashboard, click **"New +"** → **"Web Service"**
2. Connect your GitHub repository (or push the `server` folder to GitHub)
3. Configure:
   - **Name**: `voyago-paypal-payout`
   - **Environment**: `Node`
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && npm start`
   - **Root Directory**: Leave empty (or set to `server` if deploying from root)

### Step 3: Set Environment Variables
In Render dashboard, go to **"Environment"** tab and add:
```
PAYPAL_CLIENT_ID=ASEGKmY1EZ2TiV4AJdCqlBsoKQVcKBYBPsloT6k7P1LdpKKrLcV3qQtXMrKySCWPnh7TxU10mW8HUh84
PAYPAL_SECRET=EI1dd97b5nt7sVhAOfLpICJd5iRKh9xARnGN0y58mBT1i8V3jZfsR7Ojtbqkz0kW7d_z-ITb-YhWdzAO
PAYPAL_MODE=sandbox
API_KEY=voyago-secret-api-key-2024
PORT=10000
```

### Step 4: Deploy!
Click **"Create Web Service"** - it will deploy automatically!

### Step 5: Update Frontend
Once deployed, Render gives you a URL like: `https://voyago-paypal-payout.onrender.com`

Update `src/firebase.js`:
```javascript
const PAYOUT_SERVER_URL = "https://voyago-paypal-payout.onrender.com";
```

---

## ✅ Option 2: Deploy to Railway (Also Free)

1. Go to: https://railway.app
2. Sign up with GitHub
3. Click **"New Project"** → **"Deploy from GitHub repo"**
4. Select your repository
5. Set Root Directory to: `server`
6. Add environment variables (same as Render)
7. Deploy!

---

## ✅ Option 3: Run Locally (For Testing)

1. **Install dependencies**:
   ```bash
   cd server
   npm install
   ```

2. **Start server**:
   ```bash
   npm start
   ```

3. **Update frontend** (for local testing):
   In `src/firebase.js`, the URL is already set to `http://localhost:3000`

---

## 🔒 Security Note

**Important**: The API key in `.env` is for basic protection. In production:
- Use a strong, random API key
- Consider adding Firebase Auth token verification
- Use HTTPS only
- Never commit `.env` files to Git

---

## ✅ After Deployment

1. Get your server URL (e.g., `https://voyago-paypal-payout.onrender.com`)
2. Update `src/firebase.js` with the URL
3. Test by marking a withdrawal as "completed" in admin dashboard!

---

## 🆘 Troubleshooting

- **CORS errors**: Server already has CORS enabled
- **API key errors**: Make sure API_KEY matches in both server and frontend
- **Port errors**: Render uses PORT environment variable automatically

---

## 📝 What's Already Done

✅ Server code is ready (`server/server.js`)
✅ Dependencies are configured (`server/package.json`)
✅ Environment variables are set (`server/.env`)
✅ Frontend is updated to call the server
✅ CORS is configured

**All you need**: Deploy to Render or Railway!
