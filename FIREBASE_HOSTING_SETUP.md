# Firebase Hosting Setup Guide

## Step 1: Enable Firebase Hosting in Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **voyago-a19e6**
3. In the left sidebar, click on **"Hosting"**
4. If you see "Get started" button, click it to enable Hosting
5. This will create the default hosting site for your project

## Step 2: Login to Firebase CLI

Run in your terminal:
```powershell
firebase login
```

When prompted:
- Type `n` for Gemini features (optional)
- Sign in with your Google account in the browser
- Click "Allow" to grant permissions

## Step 3: Deploy

After Hosting is enabled and you're logged in, run:
```powershell
npm run deploy
```

Or manually:
```powershell
npm run build
firebase deploy --only hosting
```

## Your Site URLs

After deployment, your app will be available at:
- `https://voyago-a19e6.web.app`
- `https://voyago-a19e6.firebaseapp.com`

## Troubleshooting

If you still get "site not found":
1. Make sure you're logged in: `firebase login`
2. Verify the project: `firebase use voyago-a19e6`
3. Check hosting is enabled in Firebase Console
4. Try initializing hosting: `firebase init hosting` (select existing project)


