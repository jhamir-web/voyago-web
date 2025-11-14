# How to Enable Firebase Hosting - Step by Step

## Method 1: Via Firebase Console (Recommended)

1. **Open Firebase Console**
   - Go to: https://console.firebase.google.com/
   - Sign in with your Google account

2. **Select Your Project**
   - Click on **"voyago-a19e6"** from the project list
   - Or if you're already in a project, verify the project name at the top

3. **Navigate to Hosting**
   - Look at the **left sidebar menu**
   - Find **"Hosting"** (it might be under "Build" section)
   - Click on **"Hosting"**

4. **Enable Hosting**
   - You should see a **"Get started"** button
   - Click **"Get started"**
   - Follow the setup wizard (you can skip the initial setup steps)
   - Hosting will be enabled for your project

## Method 2: Via Firebase CLI (Alternative)

If you can't access the console, you can try:

```powershell
# First, login
firebase login

# Then initialize hosting
firebase init hosting
```

When running `firebase init hosting`:
- Select "Use an existing project"
- Choose "voyago-a19e6"
- Public directory: `dist`
- Configure as single-page app: `Yes`
- Set up automatic builds: `No` (unless you want it)
- Overwrite index.html: `No`

## Visual Guide

The Firebase Console sidebar typically looks like this:
```
📊 Overview
🔐 Authentication
💾 Firestore Database
📦 Storage
☁️ Hosting  ← Click here!
🔧 Functions
📈 Analytics
```

If you don't see Hosting:
- It might be under "Build" or "Release & Monitor" section
- Click the expand arrow (>) to see more options
- Make sure you're in the correct project (voyago-a19e6)



