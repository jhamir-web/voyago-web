# Fix: Google Login Connection Failure

## The Problem
You're seeing "connection failure" when trying to login with Google. This is usually a Firebase configuration issue.

## Quick Fixes to Try

### Fix 1: Check Firebase Authorized Domains

1. Go to: https://console.firebase.google.com/
2. Select your project: **voyago-a19e6**
3. Click the **gear icon** (⚙️) next to "Project Overview"
4. Click **"Project settings"**
5. Scroll down to **"Authorized domains"**
6. Make sure these domains are listed:
   - `localhost`
   - `voyago-a19e6.firebaseapp.com`
   - `voyago-a19e6.web.app`
7. If `localhost` is missing, click **"Add domain"** and add it
8. Save changes

### Fix 2: Enable Google Sign-In Method

1. In Firebase Console, go to: **Authentication** → **Sign-in method**
2. Find **"Google"** in the list
3. Click on it
4. Make sure it's **"Enabled"** (toggle should be ON)
5. **Project support email** should be set (use your email)
6. Click **"Save"**

### Fix 3: Check OAuth Consent Screen (if needed)

1. Go to: https://console.cloud.google.com/
2. Select your Firebase project: **voyago-a19e6**
3. Go to **"APIs & Services"** → **"OAuth consent screen"**
4. Make sure it's configured (can be "Testing" mode for development)
5. Add your email as a test user if in Testing mode

### Fix 4: Clear Browser Cache

1. Close all browser windows
2. Clear browser cache and cookies
3. Try again

### Fix 5: Check Network/Firewall

- Make sure you're not behind a VPN that blocks Firebase
- Check if your firewall is blocking the connection
- Try a different network (mobile hotspot)

## Most Common Cause

**Missing `localhost` in Authorized domains** - This is the #1 cause of connection failures.

## After Fixing

1. Wait 2-3 minutes for changes to propagate
2. Clear browser cache
3. Try Google login again

## Still Not Working?

If it still fails, try:
1. Use a different browser
2. Try incognito/private mode
3. Check browser console for specific error messages

