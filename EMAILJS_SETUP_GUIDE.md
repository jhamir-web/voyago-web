# EmailJS Setup Guide for Voyago

This guide will help you set up EmailJS for custom email verification emails.

## Step 1: Create EmailJS Account

1. Go to [https://www.emailjs.com/](https://www.emailjs.com/)
2. Sign up for a free account (allows 200 emails/month)
3. Verify your email address

## Step 2: Add Email Service

1. In EmailJS dashboard, go to **Email Services**
2. Click **Add New Service**
3. Choose your email provider (Gmail, Outlook, etc.)
4. Follow the setup instructions for your provider
5. Note your **Service ID** (e.g., `service_xxxxxxx`)

## Step 3: Create Email Template

1. Go to **Email Templates** in EmailJS dashboard
2. Click **Create New Template**
3. Choose **Blank Template**
4. Copy the HTML from `EMAILJS_TEMPLATE.html` and paste it into the template editor
5. Set the template name: `voyago_verification`
6. Note your **Template ID** (e.g., `template_xxxxxxx`)

### Template Variables Used:
- `{{to_name}}` - User's first name
- `{{to_email}}` - User's email address
- `{{verification_link}}` - Verification URL with token
- `{{company_name}}` - Company name (Voyago)

## Step 4: Get Public Key

1. Go to **Account** → **General**
2. Find your **Public Key** (e.g., `xxxxxxxxxxxxx`)
3. Copy it

## Step 5: Configure the App

1. Open `src/config/emailjs.js`
2. Replace the placeholder values:
   ```javascript
   export const EMAILJS_SERVICE_ID = "YOUR_SERVICE_ID"; // From Step 2
   export const EMAILJS_TEMPLATE_ID = "YOUR_TEMPLATE_ID"; // From Step 3
   export const EMAILJS_PUBLIC_KEY = "YOUR_PUBLIC_KEY"; // From Step 4
   ```

## Step 6: Update Firestore Security Rules

Add this rule to allow email verification document creation:

```javascript
match /emailVerifications/{userId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow create: if request.auth != null && request.auth.uid == userId;
  allow update: if request.auth != null && request.auth.uid == userId;
}
```

## Step 7: Test the Setup

1. Start your development server: `npm run dev`
2. Try signing up with a new email
3. Check your inbox for the verification email
4. Click the verification link to verify it works

## Email Template Features

- **Modern Design**: Clean, minimalist Apple-inspired design
- **Company Logo**: Black background with white "V" letter
- **Responsive**: Works on desktop and mobile email clients
- **Professional**: Polished typography and spacing
- **Brand Colors**: Uses Voyago's color scheme (#0071E3 blue, #1C1C1E dark, #8E8E93 gray)

## Troubleshooting

### Emails not sending?
- Check EmailJS dashboard for error logs
- Verify your email service is connected
- Check that template variables match exactly

### Verification link not working?
- Check that the token is being generated correctly
- Verify Firestore security rules allow document creation
- Check browser console for errors

### Template not rendering correctly?
- Make sure all template variables are set in EmailJS
- Check that HTML is properly formatted
- Test with EmailJS's preview feature

## Notes

- Free tier: 200 emails/month
- Paid plans available for higher volume
- EmailJS handles email delivery, no need for SMTP setup
- Templates can be edited directly in EmailJS dashboard


