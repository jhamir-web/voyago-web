# Step-by-Step: Deploy PayPal Payout Cloud Function

## ✅ Step 1: Get Your PayPal Secret (REQUIRED)

1. Go to: https://developer.paypal.com/dashboard/applications/sandbox
2. Make sure **"Sandbox"** toggle is ON (blue) at the top
3. Find your app with Client ID: `ASEGKmY1EZ2TiV4AJdCqlBsoKQVcKBYBPsloT6k7P1LdpKKrLcV3qQtXMrKySCWPnh7TxU10mW8HUh84`
4. Click on the app
5. Click **"Show"** next to **Secret** (or "Reveal")
6. **Copy the Secret** - you'll need this in the next step

---

## ✅ Step 2: Set PayPal Credentials in Firebase

Run this command (replace `YOUR_PAYPAL_SECRET_HERE` with the secret you copied):

```bash
firebase functions:config:set paypal.client_id="ASEGKmY1EZ2TiV4AJdCqlBsoKQVcKBYBPsloT6k7P1LdpKKrLcV3qQtXMrKySCWPnh7TxU10mW8HUh84" paypal.secret="YOUR_PAYPAL_SECRET_HERE" paypal.mode="sandbox"
```

**Example:**
```bash
firebase functions:config:set paypal.client_id="ASEGKmY1EZ2TiV4AJdCqlBsoKQVcKBYBPsloT6k7P1LdpKKrLcV3qQtXMrKySCWPnh7TxU10mW8HUh84" paypal.secret="EK1234567890abcdef" paypal.mode="sandbox"
```

---

## ✅ Step 3: Deploy the Cloud Function

Once credentials are set, deploy the function:

```bash
firebase deploy --only functions
```

This will:
- Upload your Cloud Function code
- Set it up on Firebase servers
- Make it accessible from your frontend

---

## ✅ Step 4: Test It

1. Go to your admin dashboard
2. Find a withdrawal request
3. Click "Mark as Completed"
4. The money should automatically transfer via PayPal!

---

## 🆘 Troubleshooting

If you get errors:
- **"PAYPAL_SECRET is empty"**: Make sure you set the secret in Step 2
- **CORS errors**: The function should handle CORS automatically
- **Authentication errors**: Make sure you're logged in as admin

---

## 📝 Notes

- **Sandbox Mode**: For testing, use `"sandbox"` mode
- **Production**: When ready, change `paypal.mode` to `"live"` and use production credentials
