# EmailJS Template Update Instructions

## Issues Fixed
1. ✅ **V Logo Alignment** - Changed from flexbox to table-based layout for perfect email client compatibility
2. ✅ **Subject Line** - Updated to professional subject line

## Steps to Update Your EmailJS Template

### 1. Update the HTML Content

1. Go to [EmailJS Dashboard](https://dashboard.emailjs.com/admin/template)
2. Open your template (`template_eyg7gzp`)
3. Go to the **Content** tab
4. **Replace the entire HTML content** with the content from `EMAILJS_TEMPLATE.html`
5. Click **Save**

### 2. Update the Subject Line

1. In the EmailJS template editor, look for the **Subject** field (usually in the right sidebar or top of the editor)
2. Change the subject from:
   ```
   OTP for your [Company Name] authentication
   ```
   To:
   ```
   Verify Your Email Address - Voyago
   ```
3. Click **Save**

### 3. Verify Template Variables

Make sure your EmailJS template has these variables configured:
- `{{to_name}}` - User's first name
- `{{to_email}}` - User's email address (for the "To Email" field)
- `{{verification_link}}` - Verification URL with token

### 4. Test the Email

1. Sign up with a new account
2. Check your email
3. Verify that:
   - The "V" logo is perfectly centered
   - The subject line is "Verify Your Email Address - Voyago"
   - The email looks professional and aligned

## What Changed

### Logo Alignment Fix
- **Before**: Used `display: flex` which doesn't work in email clients
- **After**: Uses nested tables with `align="center"` and `valign="middle"` for perfect centering

### Subject Line
- **Before**: "OTP for your [Company Name] authentication" (unprofessional)
- **After**: "Verify Your Email Address - Voyago" (professional and clear)

## Notes

- Email clients have limited CSS support, so we use table-based layouts
- The logo will now be perfectly centered in all email clients (Gmail, Outlook, Apple Mail, etc.)
- The subject line is now professional and clearly indicates the email's purpose


