# 🚀 Quick Deploy Guide - PayPal Automatic Transfer

## What We're Doing

Setting up automatic PayPal transfers so when you click "Mark as Completed" on a withdrawal, the money automatically sends from Business Account 1 to Business Account 2!

---

## Step 1: Get PayPal Secret (REQUIRED)

1. **Go to**: https://developer.paypal.com/dashboard/applications/sandbox
2. **Make sure "Sandbox" is ON** (blue toggle)
3. **Find your app** - Look for Client ID: `ASEGKmY1EZ2TiV4AJdCql...`
4. **Click the app** to open it
5. **Click "Show" or "Reveal"** next to "Secret"
6. **Copy the Secret** (it's a long string like: `EK1234567890abcdef...`)

**⚠️ IMPORTANT**: Keep this secret safe! Don't share it publicly.

---

## Step 2: Set PayPal Secret in Firebase

**After you get the Secret**, run this command in your terminal:

```bash
firebase functions:config:set paypal.client_id="ASEGKmY1EZ2TiV4AJdCqlBsoKQVcKBYBPsloT6k7P1LdpKKrLcV3qQtXMrKySCWPnh7TxU10mW8HUh84" paypal.secret="PASTE_YOUR_SECRET_HERE" paypal.mode="sandbox"
```

**Replace `PASTE_YOUR_SECRET_HERE`** with the actual secret you copied!

---

## Step 3: Deploy the Cloud Function

After setting the secret, deploy:

```bash
firebase deploy --only functions
```

This will take 1-2 minutes. Wait for it to finish!

---

## Step 4: Test It! 🎉

1. Go to your Admin Dashboard
2. Go to "Cash-out Approvals"
3. Find an approved withdrawal
4. Click "Mark as Completed"
5. The money should transfer automatically! 💰

---

## Need Help?

If you get stuck or see an error, let me know and I'll help!

---

## 📝 What's Already Done

✅ Cloud Function code is ready  
✅ Frontend is updated to call the function  
✅ CORS is configured  
✅ Dependencies are installed  

**All you need to do**: Get the PayPal Secret and deploy!
