# Booking Emails Setup Guide

This guide will help you set up EmailJS for booking confirmation and cancellation emails using your second EmailJS account.

## Overview

The system uses **your existing EmailJS accounts**:
1. **Account 1** (existing) - Used for email verification
2. **Account 2** (new) - Used for both booking confirmation AND cancellation emails (free tier allows 2 templates per account)

## Step 1: Create Second EmailJS Account

### Account 2: Booking Emails (Confirmation + Cancellation)
1. Go to [https://www.emailjs.com/](https://www.emailjs.com/)
2. Sign up for a free account with a different email address (allows 200 emails/month)
3. Verify your email address
4. Note your **Public Key** from **Account** → **General**

## Step 2: Set Up Email Service (Account 2)

1. In your **Account 2** EmailJS dashboard, go to **Email Services**
2. Click **Add New Service**
3. Choose your email provider (Gmail, Outlook, etc.)
4. Follow the setup instructions for your provider
5. Note your **Service ID** (e.g., `service_xxxxxxx`)

## Step 3: Create Email Templates (Account 2)

### Booking Confirmation Template

1. Go to **Email Templates** in your **Account 2** EmailJS dashboard
2. Click **Create New Template**
3. Choose **Blank Template**
4. Copy the HTML from `BOOKING_CONFIRMATION_TEMPLATE.html` and paste it into the template editor
5. Set the template name: `booking_confirmation`
6. Note your **Template ID** (e.g., `template_xxxxxxx`)

#### Template Variables Used:
- `{{to_name}}` - Guest's name
- `{{to_email}}` - Guest's email address
- `{{listing_name}}` - Listing title
- `{{location}}` - Listing location
- `{{check_in_date}}` - Check-in date (formatted)
- `{{check_out_date}}` - Check-out date (formatted)
- `{{guests}}` - Number of guests (e.g., "1 guest" or "2 guests")
- `{{booking_id}}` - Booking ID
- `{{total_amount}}` - Total amount paid (e.g., "₱2609.57")
- `{{view_trip_url}}` - Link to view trip in dashboard

### Booking Cancellation Template

1. Go to **Email Templates** in your **Account 2** EmailJS dashboard (same account)
2. Click **Create New Template**
3. Choose **Blank Template**
4. Copy the HTML from `BOOKING_CANCELLATION_TEMPLATE.html` and paste it into the template editor
5. Set the template name: `booking_cancellation`
6. Note your **Template ID** (e.g., `template_xxxxxxx`)

#### Template Variables Used:
- `{{to_name}}` - Guest's name
- `{{to_email}}` - Guest's email address
- `{{listing_name}}` - Listing title
- `{{location}}` - Listing location
- `{{check_in_date}}` - Check-in date (formatted)
- `{{check_out_date}}` - Check-out date (formatted)
- `{{guests}}` - Number of guests (e.g., "1 guest" or "2 guests")
- `{{booking_id}}` - Booking ID
- `{{original_amount}}` - Original booking amount (e.g., "₱2609.57")
- `{{refund_amount}}` - Refund amount (e.g., "₱2301.58")
- `{{service_fee}}` - Service fee retained (e.g., "₱308.00")
- `{{cancellation_status}}` - Status ("APPROVED" or "PROCESSED")
- `{{status_color}}` - Status color (#34C759 for approved, #8E8E93 for processed)
- `{{view_trips_url}}` - Link to view trips in dashboard

## Step 4: Configure Template Settings

### For Both Templates:

1. In the EmailJS template editor, set the **Subject** field:
   - Confirmation: `Booking Confirmed! - Voyago`
   - Cancellation: `Cancellation Update - Voyago`

2. Set the **To Email** field to: `{{to_email}}`

3. Click **Save**

## Step 5: Configure the App

1. Open `src/config/emailjs.js`
2. Replace the placeholder values with your actual EmailJS credentials from **Account 2**:

```javascript
// Booking Emails Account (Account 2 - used for both confirmation and cancellation)
export const EMAILJS_BOOKING_SERVICE_ID = "service_xxxxxxx"; // From Step 2 (Account 2)
export const EMAILJS_BOOKING_PUBLIC_KEY = "xxxxxxxxxxxxx"; // From Step 1 (Account 2)

// Booking Confirmation Template (in Account 2)
export const EMAILJS_CONFIRMATION_TEMPLATE_ID = "template_xxxxxxx"; // From Step 3 (Account 2)

// Booking Cancellation Template (in Account 2)
export const EMAILJS_CANCELLATION_TEMPLATE_ID = "template_xxxxxxx"; // From Step 3 (Account 2)
```

**Note:** Both templates use the same Service ID and Public Key since they're in the same account!

## Step 6: Test the Integration

### Test Booking Confirmation:
1. Have a host confirm a booking in the Host Dashboard
2. Check the guest's email inbox
3. Verify the confirmation email is received with all correct details

### Test Booking Cancellation:
1. Have a guest cancel a booking in the Guest Dashboard
2. Check the guest's email inbox
3. Verify the cancellation email is received with all correct details

## Troubleshooting

### Emails not sending?
- Check EmailJS dashboard (Account 2) for error logs
- Verify all template variables match exactly (case-sensitive)
- Check that the Public Key and Service ID are correct
- Ensure email service is properly connected in EmailJS (Account 2)

### Email template not displaying correctly?
- Make sure the HTML was copied completely from the template files
- Check that all template variables are set in EmailJS template settings
- Test the template using EmailJS's preview feature

### Email sent but wrong information?
- Check that booking data is being fetched correctly from Firestore
- Verify guest name is being retrieved from Firestore (displayName, firstName + lastName, or name)
- Ensure dates are being formatted correctly

## Features

- ✅ **Booking Confirmation Email** - Sent when host confirms booking
  - Blue gradient header
  - "CONFIRMED" badge
  - Booking details card
  - Total amount paid section
  - Refund policy information
  - "View My Trip" button

- ✅ **Booking Cancellation Email** - Sent when guest cancels booking
  - Green gradient header (for approved refunds)
  - Status badge ("APPROVED" or "PROCESSED")
  - Booking details card
  - Original amount and refund amount
  - Refund information
  - Cancellation policy reminder
  - "View My Trips" button

- ✅ **Automatic Email Sending**
  - Confirmation email sent automatically when host confirms booking
  - Cancellation email sent automatically when guest cancels booking
  - Email failures don't block booking operations

- ✅ **Professional Design**
  - Matches verification email design
  - Responsive layout
  - Apple-inspired styling
  - Clear information hierarchy

