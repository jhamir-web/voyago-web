# 🎯 Deploy ONLY PayPal API to Vercel (Not Your Whole App)

**Good news!** You can deploy **ONLY** the PayPal payout API to Vercel, and keep your main app on Firebase Hosting!

---

## ✅ What Gets Deployed

**ONLY these files:**
- `api/payout.js` - The PayPal payout function
- `vercel.json` - Configuration (tells Vercel to only deploy the API)

**NOT deployed:**
- Your React app (stays on Firebase)
- Your frontend code
- Everything else

---

## 🚀 How to Deploy (API Only)

### Option 1: Deploy from Root Directory (Recommended)

1. **Go to Vercel**: https://vercel.com
2. **Sign up** with GitHub
3. **Click "Add New..." → "Project"**
4. **Select**: `jhamir-web/voyago-web`
5. **Configure**:
   - **Root Directory**: Leave empty (or set to `.`)
   - **Framework Preset**: "Other" (since we're only deploying API)
   - **Build Command**: Leave empty (no build needed for API)
   - **Output Directory**: Leave empty
6. **Click "Deploy"**

Vercel will automatically detect the `api/` folder and deploy it as serverless functions!

---

### Option 2: Create Separate Repository (Even Cleaner)

If you want to keep it completely separate:

1. Create a new GitHub repo: `voyago-paypal-api`
2. Copy only these files:
   - `api/payout.js`
   - `vercel.json`
   - `package.json` (we'll create a minimal one)
3. Deploy that repo to Vercel

But **Option 1 is easier** - Vercel is smart enough to only deploy what's needed!

---

## ✅ After Deployment

1. **Vercel gives you a URL** like: `https://voyago-web.vercel.app`
2. **Your API will be at**: `https://voyago-web.vercel.app/api/payout`
3. **Your main app stays on Firebase**: No changes needed!

---

## 🔧 Update Frontend

After you get your Vercel URL, update `src/firebase.js`:

```javascript
const PAYOUT_SERVER_URL = "https://your-vercel-url.vercel.app";
```

That's it! Your Firebase app will call the Vercel API function.

---

## 📝 Summary

- ✅ **Vercel**: Only PayPal API function
- ✅ **Firebase**: Your entire React app (unchanged)
- ✅ **Result**: Best of both worlds!

---

## 🆘 Need Help?

If Vercel tries to deploy your whole app, we can:
1. Create a separate repo for just the API
2. Or configure Vercel to ignore everything except `api/`

Let me know if you need help!
