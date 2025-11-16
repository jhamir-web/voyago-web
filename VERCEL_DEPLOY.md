# 🚀 Deploy to Vercel - EASIEST METHOD!

Vercel is **MUCH easier** than Render - it auto-deploys from GitHub with zero configuration!

---

## ✅ Step 1: Push Code to GitHub

The code is already pushed (we just did that! ✅)

---

## ✅ Step 2: Sign Up for Vercel

1. Go to: **https://vercel.com**
2. Click **"Sign Up"**
3. Choose **"Continue with GitHub"** (easiest option!)
4. Authorize Vercel to access your GitHub

---

## ✅ Step 3: Deploy Your Project

1. In Vercel dashboard, click **"Add New..."** → **"Project"**
2. Find your repository: **`jhamir-web/voyago-web`**
3. Click **"Import"**
4. **Vercel auto-detects everything!** Just click **"Deploy"**!

That's it! **No configuration needed!** 🎉

---

## ✅ Step 4: Add Environment Variables

After deployment (takes 1 minute), add PayPal credentials:

1. In Vercel, go to your project
2. Click **"Settings"** tab
3. Click **"Environment Variables"** on the left
4. Add these variables:

```
PAYPAL_CLIENT_ID = ASEGKmY1EZ2TiV4AJdCqlBsoKQVcKBYBPsloT6k7P1LdpKKrLcV3qQtXMrKySCWPnh7TxU10mW8HUh84
```

```
PAYPAL_SECRET = EI1dd97b5nt7sVhAOfLpICJd5iRKh9xARnGN0y58mBT1i8V3jZfsR7Ojtbqkz0kW7d_z-ITb-YhWdzAO
```

```
PAYPAL_MODE = sandbox
```

```
PAYOUT_API_KEY = voyago-secret-api-key-2024
```

5. Click **"Save"**
6. Click **"Redeploy"** to apply changes

---

## ✅ Step 5: Get Your URL

After deployment, Vercel gives you a URL like:
**`https://voyago-web.vercel.app`**

Copy this URL!

---

## ✅ Step 6: Update Frontend

Once you have your Vercel URL, update `src/firebase.js`:

Change this line:
```javascript
const PAYOUT_SERVER_URL = "https://voyago-web.vercel.app";
```

Replace `voyago-web.vercel.app` with your actual Vercel URL!

---

## 🎉 That's It!

**Vercel automatically:**
- ✅ Deploys when you push to GitHub
- ✅ Handles serverless functions (no server setup!)
- ✅ Free SSL/HTTPS
- ✅ Global CDN
- ✅ Free tier (generous)

**Much easier than Render!** No root directories, no build commands, no complex setup!

---

## 📝 What's Already Done

✅ Serverless function code (`api/payout.js`)
✅ Vercel configuration (`vercel.json`)
✅ Frontend updated to call Vercel
✅ Code pushed to GitHub

**All you need**: Deploy on Vercel and add environment variables!

---

## 🆘 Need Help?

If you get stuck, tell me which step you're on and I'll help!
