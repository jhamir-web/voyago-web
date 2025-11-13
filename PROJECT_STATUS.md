# Voyago Project Status

## Project Overview
Voyago is an Airbnb-like booking platform with a modern, Apple-inspired design. Built with React, Firebase (Auth & Firestore), and PayPal Sandbox for payments.

## Current Features Implemented

### ✅ Authentication
- Email/password signup and login
- Google authentication (popup method)
- Email verification required for access
- User roles: `guest` and `host` (stored in Firestore)
- Protected routes based on authentication and role

### ✅ Host Features
- Create listings with:
  - Title, category (resort/hotel/transient), description, location, price
  - Image upload via Cloudinary
  - Experiences and services (multiple items)
  - Maximum guest capacity
- Host Dashboard:
  - View all listings with stats (total, active)
  - Activate/deactivate listings
  - Delete listings
  - View bookings with filters (all/pending/confirmed)
  - Approve/decline bookings
  - Chat with guests (with unread indicators)
  - Revenue tracking
  - **Important**: Only paid bookings appear on host dashboard

### ✅ Guest Features
- Browse listings on Home page:
  - Search by title, location, description
  - Filter by category
  - Price range filters (min/max)
  - Sort options (newest, price low/high)
  - Responsive grid layout with location-based carousels
- Listing details page:
  - Full listing information
  - Booking form (check-in/check-out dates, guests)
  - Date conflict detection (prevents booking already booked dates)
  - Maximum guest validation
  - Price calculation (nights × price per night)
- Guest Dashboard:
  - View bookings with filters (all/upcoming/past/pending)
  - Pay for pending bookings via PayPal
  - Chat with hosts (with unread indicators)

### ✅ Booking System
- Booking creation with validation:
  - Date range validation
  - Guest capacity validation
  - Conflict detection (prevents overlapping bookings)
- Booking statuses: `pending`, `confirmed`, `cancelled`, `completed`
- Payment statuses: `paid`, `pending`
- Total price calculation based on nights

### ✅ Payment Integration (PayPal Sandbox)
- PayPal buttons integrated in:
  - `ListingDetails.jsx` (new bookings)
  - `GuestDashboard.jsx` (pending bookings)
- Payment flow:
  1. Guest creates booking → status: `pending`
  2. Guest pays via PayPal → status: `confirmed`, `paymentStatus: "paid"`
  3. Only paid bookings appear on host dashboard
  4. Host can approve/decline paid bookings
- **Current Configuration**:
  - Currency: `USD` (listings priced in USD)
  - PayPal Sandbox account can have PHP balance (PayPal auto-converts)
  - Client ID stored in `src/config/paypal.js`
  - `PayPalScriptProvider` wraps buttons directly in components (not in `main.jsx`)

### ✅ Chat System
- Real-time messaging between guests and hosts
- Linked to specific bookings
- Features:
  - Unread message indicators (badge count)
  - Typing indicators
  - Read receipts ("seen" status)
  - Auto-scroll to latest message
  - iMessage-style UI (responsive)
  - Fixed input at bottom

### ✅ UI/UX Design
- Apple-inspired minimalist aesthetic:
  - Large white space
  - Thin typography (Inter, Poppins)
  - Soft shadows, rounded corners (16px)
  - High-quality images
  - Micro-animations
- Hero section:
  - Full-screen video background (Cloudinary)
  - Fade-up animations on load/scroll
  - Centered search bar
- Responsive design (mobile-first with Tailwind breakpoints)
- Footer displays horizontally on all screen sizes

## File Structure

```
src/
├── App.jsx                    # Main routing
├── main.jsx                    # Entry point (no PayPal provider here)
├── firebase.js                 # Firebase config
├── index.css                   # Global styles, animations
├── contexts/
│   └── AuthContext.jsx        # Authentication state management
├── pages/
│   ├── Home.jsx               # Landing page with listings
│   ├── Login.jsx              # Login page
│   ├── Signup.jsx             # Signup page
│   ├── guest/
│   │   ├── GuestDashboard.jsx # Guest bookings & payments
│   │   └── ListingDetails.jsx # Listing view & booking
│   └── host/
│       ├── HostDashboard.jsx  # Host listings & bookings
│       └── CreateListing.jsx  # Create listing form
├── components/
│   └── ErrorBoundary.jsx      # Error handling
└── config/
    ├── cloudinary.js          # Cloudinary config (images/video)
    └── paypal.js              # PayPal Client ID
```

## Firebase Collections

### `users`
- Document ID: `userId`
- Fields: `email`, `role` (guest/host), `createdAt`

### `listings`
- Fields: `title`, `category`, `description`, `location`, `price`, `imageUrl`, `hostId`, `hostEmail`, `experiences[]`, `services[]`, `maxGuests`, `status` (active/inactive), `createdAt`

### `bookings`
- Fields: `listingId`, `listingTitle`, `listingLocation`, `listingImageUrl`, `hostId`, `hostEmail`, `guestId`, `guestEmail`, `checkIn`, `checkOut`, `guests`, `pricePerNight`, `totalPrice`, `status`, `paymentStatus`, `paymentMethod`, `paymentId`, `paypalOrderId`, `createdAt`

### `messages`
- Fields: `bookingId`, `senderId`, `receiverId`, `senderEmail`, `receiverEmail`, `message`, `read`, `readAt`, `createdAt`

### `typing`
- Fields: `bookingId`, `userId`, `isTyping`, `timestamp`

## Important Configuration Files

### `src/config/paypal.js`
```javascript
export const PAYPAL_CLIENT_ID = "YOUR_SANDBOX_CLIENT_ID";
```

### `src/config/cloudinary.js`
- Contains Cloudinary config for image uploads
- `HERO_VIDEO_URL` for hero section video

### Firestore Security Rules
- See `firestore-security-rules.txt` for complete rules
- Key points:
  - Users can read/write their own user document
  - Any authenticated user can read listings
  - Hosts can create/update their own listings
  - Guests can create bookings
  - Users can read/write messages they're part of
  - Any authenticated user can read bookings (for conflict checking)

## Known Issues / Notes

1. **PayPal Currency**: Listings are in USD, but PayPal Sandbox account can have PHP balance. PayPal auto-converts during payment.

2. **Booking Conflict Prevention**: 
   - Guest side: Prevents booking dates that are already `pending` or `confirmed`
   - Host side: Prevents confirming bookings that conflict with existing `confirmed` bookings
   - Only paid bookings can be confirmed by host

3. **Payment Flow**: 
   - Booking created → `pending` status
   - Payment successful → `confirmed` + `paymentStatus: "paid"`
   - Only paid bookings show on host dashboard

4. **Google Authentication**: Uses popup method. Email verification is skipped for Google accounts.

## Dependencies

Key packages:
- `react`, `react-dom`
- `react-router-dom`
- `firebase` (auth, firestore)
- `@paypal/react-paypal-js`
- `tailwindcss`
- Cloudinary SDK (for image uploads)

## Next Steps / Future Features

- Admin panel (deferred)
- Role switching in user profile (deferred)
- Additional payment methods
- Reviews and ratings
- Advanced search filters
- Booking calendar view
- Email notifications

## Troubleshooting

### PayPal Issues
- See `PAYPAL_SETUP_GUIDE.md` and `PAYPAL_TROUBLESHOOTING.md`
- Common: "Window closed before response" → ensure popups enabled
- Balance unavailable → use credit/debit card option in Sandbox

### Video Issues
- See `CLOUDINARY_VIDEO_UPLOAD_GUIDE.md`
- Video must be uploaded to Cloudinary and URL updated in `cloudinary.js`

---

**Last Updated**: Current session
**Status**: Fully functional with PayPal Sandbox integration

