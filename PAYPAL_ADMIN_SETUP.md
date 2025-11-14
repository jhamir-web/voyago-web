# PayPal Admin Account Setup Guide

## ⚠️ IMPORTANT: Payments Go to the Business Account Linked to Your Client ID

When a guest pays via PayPal, the money goes to **whichever PayPal Business account is linked to your PayPal Client ID**. This is configured in the PayPal Developer Dashboard, not in the code.

---

## 🔧 How to Fix: Link Payments to Admin's PayPal Account

### Step 1: Check Current Setup

1. Go to https://developer.paypal.com/dashboard/applications/sandbox
2. Make sure **"Sandbox"** toggle is ON (blue)
3. Find your current app (the one with Client ID: `ASEGKmY1EZ2TiV4AJdCqlBsoKQVcKBYBPsloT6k7P1LdpKKrLcV3qQtXMrKySCWPnh7TxU10mW8HUh84`)
4. Check which **Business Account** it's linked to
   - If it's linked to the **host's account** → You need to change it
   - If it's linked to the **admin's account** → You're good!

### Step 2: Create New PayPal App for Admin (Recommended)

**Option A: Create a New App with Admin's Business Account**

1. In PayPal Developer Dashboard, click **"Create App"**
2. Fill in:
   - **App Name:** `Voyago Admin Payments`
   - **Sandbox Business Account:** Select your **ADMIN's Business account** (the one that should receive all payments)
   - **Features:** Accept Payments, Capture Payments
3. Click **"Create App"**
4. **Copy the new Client ID**
5. Update `src/config/paypal.js` with the new Client ID

**Option B: Update Existing App**

1. Find your current app in the dashboard
2. Click on it to edit
3. Change the **Sandbox Business Account** to your **ADMIN's Business account**
4. Save changes
5. The Client ID stays the same, but payments will now go to the admin's account

---

## 📝 Update Your Code

After getting the correct Client ID (linked to admin's account), update:

**File:** `src/config/paypal.js`

```javascript
export const PAYPAL_CLIENT_ID = "YOUR_ADMIN_CLIENT_ID_HERE";
```

---

## ✅ Verify It's Working

1. Make a test booking payment
2. Check your PayPal Business account (the one linked to the Client ID)
3. The payment should appear in the **admin's** PayPal account, not the host's

---

## 🔍 How to Check Which Account Your Client ID is Linked To

1. Go to https://developer.paypal.com/dashboard/applications/sandbox
2. Find your app
3. Look at the **"Business Account"** column
4. That's where payments are going!

---

## 💡 Important Notes

- **The Client ID determines where money goes** - not the code
- **All guest payments** go to the Business account linked to the Client ID
- **The admin's PayPal email** in the Admin Dashboard is just for reference/tracking
- **The actual payments** go to the Business account linked to the PayPal Client ID

---

## 🆘 Still Having Issues?

If payments are still going to the wrong account:

1. Double-check which Business account your Client ID is linked to
2. Make sure you're using the correct Client ID in `src/config/paypal.js`
3. Clear browser cache and test again
4. Check PayPal transaction logs to see which account received the payment


