# PayPal Payment Troubleshooting Guide

## Common Issues and Solutions

### 1. "PayPal Balance Unavailable" in Sandbox

**What you see:** PayPal balance shows "Unavailable at this time" with a warning icon.

**Why this happens:**
- PayPal Sandbox balance can be unreliable
- Sandbox accounts sometimes have balance issues
- This is a known PayPal Sandbox limitation

**Solution - Use Credit/Debit Card Instead:**
✅ **This is perfectly fine for testing!** You can use the credit/debit card options shown:
- Click on "Credit Union 1 (AK)" or "Visa" option
- Complete the payment with the card
- This works exactly the same as PayPal balance for testing

**To Fix PayPal Balance (Optional):**
1. Go to PayPal Sandbox: https://www.sandbox.paypal.com
2. Log in with your Personal (Buyer) account
3. Go to "Wallet" → "Add money"
4. Try adding funds (though this may not always work in Sandbox)
5. If it doesn't work, just use the card option - it's fine!

**Important:** For testing purposes, using a credit/debit card in Sandbox is completely normal and works the same way. You don't need PayPal balance to test payments.

### 2. "Window closed before response" Error

**What it means:** The PayPal popup window was closed before the payment could be verified.

**Solutions:**
- **Don't close the PayPal window manually** - Let it close automatically after payment
- **Wait for the payment to complete** - The window will close on its own
- **Check your PayPal account** - If payment went through, your booking will be marked as "pending_verification"
- **Try again** - If payment didn't complete, you can retry the payment

**What we've implemented:**
- ✅ Order ID is saved immediately when payment is approved
- ✅ Fallback verification using `order.get()` if capture fails
- ✅ Booking is marked as "pending_verification" if verification fails (you can manually verify)
- ✅ Better error messages to guide you

### 2. "PayPal unavailable at this time" Error

**Possible causes:**
- PayPal Sandbox is experiencing issues (temporary)
- Your Sandbox account needs time to activate (wait 5-10 minutes after setup)
- Network connectivity issues

**Solutions:**
- **Wait 5-10 minutes** after creating your Sandbox accounts
- **Check PayPal Developer Dashboard** - Make sure your accounts are "Active"
- **Try again later** - PayPal Sandbox can sometimes be unstable
- **Check your internet connection**
- **Try a different browser** or incognito mode

### 3. Payment Shows as "Pending Verification"

**What it means:** Payment was approved but we couldn't verify it automatically.

**What to do:**
1. **Check your PayPal Sandbox account:**
   - Go to: https://www.sandbox.paypal.com
   - Log in with your Personal (Buyer) account
   - Check "Activity" tab for the transaction
   - If you see the payment, it was successful

2. **If payment was successful:**
   - The booking has the `paypalOrderId` stored
   - You can manually update the booking status in Firestore
   - Or contact support to verify the payment

3. **If payment was NOT successful:**
   - Try the payment again
   - Make sure your Sandbox account has sufficient balance

### 4. Sandbox Balance Not Deducting

**This means the payment didn't complete successfully.**

**Check:**
- Did you see a success message in PayPal?
- Did you complete all steps in the PayPal popup?
- Is your Sandbox account active?

**If payment didn't go through:**
- The booking will remain as "pending"
- You can try the payment again
- Check console logs for error messages

### 5. PayPal Buttons Not Loading

**Possible causes:**
- Invalid Client ID in `src/config/paypal.js`
- PayPal SDK failed to load
- Network issues

**Solutions:**
- **Verify Client ID:** Check `src/config/paypal.js` has your correct Client ID
- **Check browser console** for specific error messages
- **Reload the page** - Sometimes the SDK needs to reload
- **Check PayPal Developer Dashboard** - Make sure your app is active

## Best Practices

1. **Don't close the PayPal window** - Let it close automatically
2. **Wait for confirmation** - Don't refresh the page during payment
3. **Use Sandbox accounts** - Make sure you're using your Sandbox Personal account for testing
4. **Check console logs** - They provide detailed information about what's happening
5. **Wait after setup** - Give PayPal 5-10 minutes to activate new Sandbox accounts

## Testing Checklist

Before reporting issues, check:
- [ ] PayPal Sandbox accounts are "Active" in Developer Dashboard
- [ ] Client ID is correct in `src/config/paypal.js`
- [ ] You're using Sandbox Personal account (not Business) for payments
- [ ] Sandbox account has sufficient balance (e.g., $5000)
- [ ] Browser allows popups for localhost
- [ ] No ad blockers or extensions interfering
- [ ] Waited 5-10 minutes after creating Sandbox accounts

## Still Having Issues?

1. **Check browser console** - Look for specific error messages
2. **Check PayPal Developer Dashboard** - Verify account and app status
3. **Try incognito mode** - Rules out browser extension issues
4. **Try a different browser** - Rules out browser-specific issues
5. **Wait and retry** - PayPal Sandbox can be temporarily unavailable

## Contact Information

If you continue to have issues:
- Check PayPal Developer Documentation: https://developer.paypal.com/docs/
- PayPal Sandbox Status: Check for service outages
- Review your setup using `PAYPAL_SETUP_GUIDE.md`

