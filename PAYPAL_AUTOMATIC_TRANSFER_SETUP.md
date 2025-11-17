# PayPal Automatic Transfer Setup Guide

## 🔍 The Problem

Currently, when you mark a withdrawal as "completed" in the admin dashboard, it only updates the database. **It does NOT automatically transfer money from Business Account 1 to Business Account 2 via PayPal.**

## ✅ The Solution

We need to implement **PayPal Payouts API** using **Firebase Cloud Functions** to automatically transfer money when admin marks withdrawal as completed.

---

## 📋 Step 1: Set Up Firebase Cloud Functions

1. **Install Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

3. **Initialize Cloud Functions**:
   ```bash
   cd your-project-root
   firebase init functions
   ```
   - Select your Firebase project
   - Choose JavaScript or TypeScript (we'll use JavaScript)
   - Install dependencies? Yes

---

## 📋 Step 2: Get PayPal Secret Key

1. Go to https://developer.paypal.com/dashboard/applications/sandbox
2. Make sure **"Sandbox"** toggle is ON (blue)
3. Find your app with Client ID: `ASEGKmY1EZ2TiV4AJdCqlBsoKQVcKBYBPsloT6k7P1LdpKKrLcV3qQtXMrKySCWPnh7TxU10mW8HUh84`
4. Click on the app
5. Click **"Show"** next to **Secret** to reveal it
6. **Copy the Secret** - you'll need this for the Cloud Function

---

## 📋 Step 3: Add PayPal Secret to Firebase Environment

In your Firebase Functions directory, set the secret:

```bash
firebase functions:config:set paypal.client_id="YOUR_CLIENT_ID" paypal.secret="YOUR_SECRET" paypal.mode="sandbox"
```

Replace:
- `YOUR_CLIENT_ID` with: `ASEGKmY1EZ2TiV4AJdCqlBsoKQVcKBYBPsloT6k7P1LdpKKrLcV3qQtXMrKySCWPnh7TxU10mW8HUh84`
- `YOUR_SECRET` with your actual PayPal Secret from Step 2
- Use `"sandbox"` for testing, `"live"` for production

---

## 📋 Step 4: Install PayPal SDK in Functions

In your `functions` directory:

```bash
cd functions
npm install @paypal/payouts-sdk
```

---

## 📋 Step 5: Deploy the Cloud Function

The Cloud Function code is provided in `functions/index.js`. After setting it up, deploy:

```bash
firebase deploy --only functions
```

---

## ✅ How It Works

1. Admin marks withdrawal as "completed" in the dashboard
2. Frontend calls the Cloud Function with withdrawal details
3. Cloud Function authenticates with PayPal using Client ID and Secret
4. Cloud Function calls PayPal Payouts API to send money
5. Money is automatically transferred from Business Account 1 → Business Account 2
6. Cloud Function updates Firestore with transfer status

---

## ⚠️ Important Notes

- **Sandbox Mode**: Test in sandbox first! Use sandbox PayPal accounts
- **Production**: Change `paypal.mode` to `"live"` when ready
- **Security**: Never expose your PayPal Secret in frontend code - always use Cloud Functions
- **Fees**: PayPal charges fees for payouts (check PayPal pricing)

---

## 🧪 Testing

1. Create a test withdrawal request
2. Mark it as "completed" in admin dashboard
3. Check PayPal dashboard to verify money was transferred
4. Check Cloud Functions logs: `firebase functions:log`

---

## 🆘 Troubleshooting

If transfers fail:
1. Check Cloud Functions logs: `firebase functions:log`
2. Verify PayPal Secret is correct
3. Ensure Business Account 1 has sufficient balance
4. Verify host's Business Account 2 email is correct
5. Check PayPal Developer Dashboard for error messages
