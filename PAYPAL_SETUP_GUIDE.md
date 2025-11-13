# PayPal Sandbox Setup - Complete Beginner's Guide

This guide will walk you through setting up PayPal Sandbox for your Voyago project, step by step.

## What is PayPal Sandbox?

PayPal Sandbox is a testing environment where you can test payments **without using real money**. It's perfect for development and testing your booking website.

---

## Step 1: Create a PayPal Developer Account

1. **Go to:** https://developer.paypal.com/
2. **Click** "Sign Up" (top right corner)
3. **Use your regular PayPal account** to sign in, or create a new PayPal account if you don't have one
4. **Complete the registration** - you'll need to verify your email
5. Once logged in, you'll see the **PayPal Developer Dashboard**

**Note:** This is FREE - you don't need to pay anything!

---

## Step 2: Create a Sandbox Business Account (Merchant)

This account will **receive** payments (like a hotel receiving money from guests).

1. In the Developer Dashboard, look at the **left sidebar**
2. Click **"Accounts"** (under "Sandbox" section)
3. Make sure the **"Sandbox"** toggle is ON (blue) at the top
4. Click the **"Create Account"** button
5. Fill in the form:
   - **Account Type:** Select **"Business (Merchant Account)"** ⚠️ IMPORTANT!
   - **Email:** Enter any email (e.g., `voyago-business@test.com`)
     - This is fake - just for testing
   - **Password:** Create a password (remember it!)
   - **Country:** Select your country (e.g., United States)
   - **Balance:** Enter `10000.00` (this is fake money for testing)
6. Click **"Create Account"**
7. ✅ **Write down:** Email and Password (you'll need these later)

**You should see:** A new account appears in the list with "Business" type

---

## Step 3: Create a Sandbox Personal Account (Buyer)

This account will **make** payments (like a guest paying for a booking).

1. Still in **"Accounts"** → **"Sandbox"**
2. Click **"Create Account"** again
3. Fill in the form:
   - **Account Type:** Select **"Personal (Buyer Account)"** ⚠️ IMPORTANT!
   - **Email:** Enter a DIFFERENT email (e.g., `voyago-buyer@test.com`)
   - **Password:** Create a password (remember it!)
   - **Country:** Select your country
   - **Balance:** Enter `5000.00` (fake money for testing)
4. Click **"Create Account"**
5. ✅ **Write down:** Email and Password (for testing payments)

**You should see:** Two accounts now - one Business, one Personal

---

## Step 4: Create a Sandbox App

This links your Voyago website to PayPal.

1. In the Developer Dashboard, click **"Apps & Credentials"** in the left sidebar
2. Make sure **"Sandbox"** toggle is ON (blue) at the top
3. Under **"REST API apps"**, click **"Create App"**
4. Fill in the form:
   - **App Name:** Enter `Voyago Booking App` (or any name you like)
   - **Sandbox Business Account:** ⚠️ **IMPORTANT!** Select your **Business account** from the dropdown
     - This is the account you created in Step 2
     - It should show the email you used (e.g., `voyago-business@test.com`)
   - **Features:** Leave as default (Accept Payments, Capture Payments)
5. Click **"Create App"**
6. **You'll see a page with:**
   - **Client ID** (long string of letters/numbers)
   - **Secret** (you don't need this for now)
7. ✅ **Copy the Client ID** - you'll need this next!

**Example Client ID looks like:** `AeA1QIZXiflr1_-YOUR_ACTUAL_CLIENT_ID_HERE`

---

## Step 5: Add Client ID to Your Voyago Project

1. **Open your project** in your code editor
2. **Create a new file:** `src/config/paypal.js`
3. **Copy and paste this code:**

```javascript
// PayPal Sandbox Configuration
// Get your Client ID from: https://developer.paypal.com/dashboard/applications/sandbox

export const PAYPAL_CLIENT_ID = "PASTE_YOUR_CLIENT_ID_HERE";

// PayPal environment (sandbox or production)
export const PAYPAL_ENVIRONMENT = "sandbox";
```

4. **Replace** `PASTE_YOUR_CLIENT_ID_HERE` with the Client ID you copied in Step 4
5. **Save the file**

**Example:**
```javascript
export const PAYPAL_CLIENT_ID = "AeA1QIZXiflr1_-YOUR_ACTUAL_CLIENT_ID_HERE";
```

---

## Step 6: Install PayPal Package (if not already installed)

1. **Open terminal** in your project folder
2. **Run this command:**

```bash
npm install @paypal/react-paypal-js
```

3. **Wait for it to finish** (it will say "added 1 package" when done)

---

## Step 7: Update Your Main App File

1. **Open:** `src/main.jsx`
2. **Replace the entire file** with this:

```javascript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PayPalScriptProvider } from '@paypal/react-paypal-js'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext'
import { PAYPAL_CLIENT_ID } from './config/paypal'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PayPalScriptProvider 
      options={{ 
        clientId: PAYPAL_CLIENT_ID,
        currency: "USD",
        intent: "capture",
      }}
    >
      <AuthProvider>
        <App />
      </AuthProvider>
    </PayPalScriptProvider>
  </StrictMode>,
)
```

3. **Save the file**

---

## Step 8: Wait 5-10 Minutes

PayPal needs time to activate your accounts. **Wait 5-10 minutes** before testing.

---

## Step 9: Test Your Setup

1. **Start your app:** `npm run dev`
2. **Log in** as a guest
3. **Create a booking**
4. **Click the PayPal button** (we'll add this next)
5. **When PayPal popup appears:**
   - Use your **Personal account** email and password (from Step 3)
   - Complete the payment
   - Don't close the popup - let it close automatically

---

## Checklist - Before You Continue

Make sure you have:
- [ ] PayPal Developer account created
- [ ] Business account created (receives payments)
- [ ] Personal account created (makes payments)
- [ ] App created and linked to Business account
- [ ] Client ID copied
- [ ] `src/config/paypal.js` file created with your Client ID
- [ ] `@paypal/react-paypal-js` package installed
- [ ] `src/main.jsx` updated with PayPalScriptProvider
- [ ] Waited 5-10 minutes after setup

---

## Next Steps

Once you've completed all the steps above, let me know and I'll help you:
1. Add PayPal payment buttons to your booking pages
2. Handle payment completion
3. Update booking status after payment

**Ready to continue?** Tell me when you've completed Steps 1-8 and we'll add the payment buttons!

