# Quick Setup Guide - PayPal Cloud Function

## 🔑 Step 1: Get Your PayPal Secret

1. **Open PayPal Developer Dashboard**: https://developer.paypal.com/dashboard/applications/sandbox
2. **Make sure Sandbox is ON** (blue toggle at top)
3. **Find your app** with Client ID: `ASEGKmY1EZ2TiV4AJdCqlBsoKQVcKBYBPsloT6k7P1LdpKKrLcV3qQtXMrKySCWPnh7TxU10mW8HUh84`
4. **Click on the app**
5. **Click "Show" next to Secret** to reveal it
6. **Copy the Secret** (it looks like: `EK1234567890abcdef...`)

---

## ⚙️ Step 2: Set PayPal Credentials

**Run this command** (replace `YOUR_SECRET_HERE` with the secret you copied):

```bash
firebase functions:config:set paypal.client_id="ASEGKmY1EZ2TiV4AJdCqlBsoKQVcKBYBPsloT6k7P1LdpKKrLcV3qQtXMrKySCWPnh7TxU10mW8HUh84" paypal.secret="YOUR_SECRET_HERE" paypal.mode="sandbox"
```

---

## 🚀 Step 3: Deploy the Function

```bash
firebase deploy --only functions
```

---

## ✅ Step 4: Test

1. Go to Admin Dashboard → Cash-out Approvals
2. Click "Mark as Completed" on a withdrawal
3. Money should transfer automatically! 💰

---

## ❓ Need Help?

If you get an error, share it with me and I'll help fix it!
