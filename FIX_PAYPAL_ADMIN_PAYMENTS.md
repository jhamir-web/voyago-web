# Fix: PayPal Payments Going to Host Instead of Admin

## 🔍 The Problem

Payments are going to the host's PayPal account instead of the admin's account. This happens because the **PayPal Client ID** in your code is linked to the **host's Business account** in the PayPal Developer Dashboard.

## ✅ The Solution

You need to link your PayPal Client ID to the **admin's Business account** instead.

---

## 📋 Step-by-Step Fix

### Step 1: Check Current Setup

1. Go to: https://developer.paypal.com/dashboard/applications/sandbox
2. Make sure **"Sandbox"** toggle is ON (blue) at the top
3. Find your app with Client ID: `ASEGKmY1EZ2TiV4AJdCqlBsoKQVcKBYBPsloT6k7P1LdpKKrLcV3qQtXMrKySCWPnh7TxU10mW8HUh84`
4. Look at the **"Business Account"** column - this is where payments are currently going

### Step 2: Create Admin Business Account (If Needed)

If you don't have an admin Business account yet:

1. In PayPal Developer Dashboard, go to **"Accounts"** → **"Sandbox"**
2. Click **"Create Account"**
3. Select **"Business (Merchant Account)"**
4. Fill in:
   - **Email:** Your admin PayPal email (e.g., `admin@voyago.com`)
   - **Password:** Create a password
   - **Country:** Your country
   - **Balance:** `10000.00` (for testing)
5. Click **"Create Account"**
6. ✅ **Note the email** - you'll need it for Step 3

### Step 3: Link Client ID to Admin Account

**Option A: Update Existing App (Easiest)**

1. In PayPal Developer Dashboard → **"Applications"** → **"Sandbox"**
2. Find your app (the one with your Client ID)
3. Click on it to **edit**
4. Find the **"Sandbox Business Account"** dropdown
5. **Change it** to your **admin's Business account** (the one you created in Step 2)
6. Click **"Save"** or **"Update"**
7. ✅ **Done!** The Client ID stays the same, but payments will now go to admin

**Option B: Create New App for Admin**

1. Click **"Create App"**
2. Fill in:
   - **App Name:** `Voyago Admin Payments`
   - **Sandbox Business Account:** Select your **ADMIN's Business account**
   - **Features:** Accept Payments, Capture Payments
3. Click **"Create App"**
4. **Copy the new Client ID**
5. Update `src/config/paypal.js` with the new Client ID:
   ```javascript
   export const PAYPAL_CLIENT_ID = "YOUR_NEW_ADMIN_CLIENT_ID_HERE";
   ```

---

## ✅ Verify It's Fixed

1. Make a test booking payment
2. Check your PayPal Sandbox accounts:
   - Go to **"Accounts"** → **"Sandbox"**
   - Click on your **admin Business account**
   - Check the **"Transactions"** tab
3. The payment should appear in the **admin's account**, not the host's

---

## 🔍 How to Check Which Account Your Client ID is Linked To

1. Go to: https://developer.paypal.com/dashboard/applications/sandbox
2. Find your app
3. Look at the **"Business Account"** column
4. That email is where payments are going!

---

## 📝 Important Notes

- ✅ **The Client ID determines where money goes** - not the code
- ✅ **All guest payments** go to the Business account linked to the Client ID
- ✅ **The admin PayPal email** in Admin Dashboard is just for reference
- ✅ **The actual payments** go to the Business account linked to the PayPal Client ID
- ⚠️ **After changing the Business account**, you may need to clear browser cache and test again

---

## 🆘 Still Not Working?

If payments are still going to the wrong account:

1. **Double-check** which Business account your Client ID is linked to
2. **Verify** you're using the correct Client ID in `src/config/paypal.js`
3. **Clear browser cache** and test again
4. **Check PayPal transaction logs** to see which account received the payment
5. **Make sure** you're testing in Sandbox mode (not Production)

---

## 💡 Quick Reference

**Current Client ID:** `ASEGKmY1EZ2TiV4AJdCqlBsoKQVcKBYBPsloT6k7P1LdpKKrLcV3qQtXMrKySCWPnh7TxU10mW8HUh84`

**File to update (if creating new app):** `src/config/paypal.js`

**What to change:** The Business account linked to your Client ID in PayPal Developer Dashboard

