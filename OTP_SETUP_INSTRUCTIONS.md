# OTP Email Verification Setup Instructions

## What Changed

The email verification system now uses a **6-digit OTP (One-Time Password)** instead of verification links.

## Steps to Update EmailJS Template

### 1. Update Your EmailJS Template

1. Go to [EmailJS Dashboard](https://dashboard.emailjs.com/admin/template)
2. Open your template (`template_eyg7gzp`)
3. Go to the **Content** tab
4. **Replace the entire HTML content** with the content from `EMAILJS_OTP_TEMPLATE.html`

### 2. Update Template Variables

Make sure your EmailJS template uses these variables:
- `{{to_name}}` - User's first name
- `{{to_email}}` - User's email address (for the "To Email" field)
- `{{otp_code}}` - The 6-digit verification code

### 3. Update "To Email" Field

In the EmailJS template settings (right sidebar):
- Change "To Email" from `{{email}}` to `{{to_email}}`

### 4. Save the Template

Click the **Save** button in EmailJS.

## How It Works Now

1. **User Signs Up** → Account is created
2. **OTP Email Sent** → 6-digit code sent via EmailJS
3. **User Redirected** → To `/verify-otp?userId=xxx` page
4. **User Enters OTP** → 6 individual input fields
5. **Verification** → Code is verified against Firestore
6. **Success** → Redirected to login page

## Features

- ✅ 6-digit OTP code (expires in 10 minutes)
- ✅ Auto-focus between input fields
- ✅ Paste support (paste 6 digits at once)
- ✅ Resend code with 60-second cooldown
- ✅ Max 5 failed attempts before requiring new code
- ✅ Beautiful OTP input UI with Apple-inspired design

## Testing

1. Sign up with a new account
2. Check your email for the 6-digit code
3. Enter the code on the verification page
4. You should be redirected to login

## Troubleshooting

### OTP not received?
- Check EmailJS dashboard for errors
- Verify template variables match exactly
- Check spam folder

### Code expired?
- Click "Resend code" button
- New code will be sent (60-second cooldown)

### Too many failed attempts?
- Wait for the error message
- Click "Resend code" to get a new code
- Attempts counter resets with new code


