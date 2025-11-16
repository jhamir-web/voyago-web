# ✅ Deploy ONLY PayPal API to Vercel

**Answer: Vercel will deploy ONLY the PayPal API, NOT your entire app!**

---

## 🎯 What Happens

- ✅ **Vercel deploys**: Only `api/payout.js` (the PayPal function)
- ✅ **Your React app**: Stays on Firebase Hosting (unchanged)
- ✅ **Result**: Your Firebase app calls the Vercel API

---

## 🚀 Deploy Steps

### Step 1: Go to Vercel
1. Visit: **https://vercel.com**
2. **Sign up** with GitHub

### Step 2: Import Project
1. Click **"Add New..."** → **"Project"**
2. Find: **`jhamir-web/voyago-web`**
3. Click **"Import"**

### Step 3: Configure (IMPORTANT!)
When configuring, set:
- **Framework Preset**: **"Other"** (this tells Vercel not to build your React app)
- **Root Directory**: Leave empty
- **Build Command**: Leave empty (or `echo 'API only'`)
- **Output Directory**: Leave empty

**This ensures Vercel only deploys the API functions!**

### Step 4: Add Environment Variables
After deployment, go to **Settings** → **Environment Variables** and add:

```
PAYPAL_CLIENT_ID = ASEGKmY1EZ2TiV4AJdCqlBsoKQVcKBYBPsloT6k7P1LdpKKrLcV3qQtXMrKySCWPnh7TxU10mW8HUh84
PAYPAL_SECRET = EI1dd97b5nt7sVhAOfLpICJd5iRKh9xARnGN0y58mBT1i8V3jZfsR7Ojtbqkz0kW7d_z-ITb-YhWdzAO
PAYPAL_MODE = sandbox
PAYOUT_API_KEY = voyago-secret-api-key-2024
```

### Step 5: Deploy!
Click **"Deploy"** - Vercel will only deploy the `api/` folder!

---

## ✅ After Deployment

1. **Vercel URL**: `https://voyago-web.vercel.app`
2. **API Endpoint**: `https://voyago-web.vercel.app/api/payout`
3. **Your React app**: Still on Firebase (no changes!)

---

## 🔧 Update Frontend

Update `src/firebase.js` with your Vercel URL:

```javascript
const PAYOUT_SERVER_URL = "https://voyago-web.vercel.app";
```

---

## 📝 Summary

- **Vercel**: PayPal API only (serverless function)
- **Firebase**: Your entire React app (unchanged)
- **No conflicts**: They work together perfectly!

---

## 🆘 If Vercel Tries to Deploy Everything

If Vercel tries to build your React app:
1. In project settings, set **Framework Preset** to **"Other"**
2. Leave **Build Command** empty
3. Redeploy

This tells Vercel: "Only deploy the API functions, don't build the frontend!"
