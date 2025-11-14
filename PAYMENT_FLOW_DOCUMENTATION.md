# Payment Flow Documentation

## ✅ Current Implementation Status

Your payment system **IS correctly implemented** according to your requirements! Here's the complete flow:

---

## 🔄 Complete Payment Flow

### 1. **Guest Books & Pays via PayPal**
   - Guest selects a listing and proceeds to payment
   - Guest pays through PayPal (using PayPal buttons)
   - **Real money goes to:** Admin's PayPal account (configured via PayPal Client ID in `src/config/paypal.js`)
   - Booking is created with status: `"pending"` (waiting for host approval)
   - Payment is recorded in the booking document

### 2. **Host Accepts Booking**
   - Host reviews the booking request
   - Host clicks "Accept" button
   - **What happens:**
     - Booking status changes to `"confirmed"`
     - Host's `pendingBalance` increases by booking amount ✅ (Virtual/Preview)
     - Transaction is recorded as `"booking_pending"` type
     - Payment is recorded in `adminPayments` collection (tracks that admin received the money)
   - **Important:** Host's `walletBalance` does NOT increase - only `pendingBalance` (virtual/preview)

### 3. **Host Views Wallet**
   - Host can see:
     - **Available Balance** (`walletBalance`) - Virtual/preview only
     - **Pending Balance** (`pendingBalance`) - Virtual/preview only, shows money waiting for withdrawal
   - All balances are **virtual/preview** - real money is in admin's PayPal account

### 4. **Host Requests Withdrawal**
   - Host clicks "Request Withdrawal" button
   - Host enters:
     - Amount to withdraw (cannot exceed `pendingBalance`)
     - PayPal email address
   - **What happens:**
     - Withdrawal request is created in `withdrawalRequests` collection
     - Host's `pendingBalance` is **deducted** (moved from pending to "requested")
     - Transaction is recorded as `"withdrawal_request"` type
   - **Status:** `"pending"` (waiting for admin approval)

### 5. **Admin Processes Withdrawal**
   - Admin goes to **Cash-out Approvals** section
   - Admin sees withdrawal request with:
     - Host name and email
     - Host's PayPal email
     - Amount requested
   - Admin can:
     - **Approve** - Changes status to `"approved"` (ready for payment)
     - **Reject** - Returns amount to host's `pendingBalance`
     - **Mark as Completed** - After admin manually sends PayPal transfer

### 6. **Admin Marks Withdrawal as Completed**
   - Admin manually sends PayPal transfer from admin's PayPal to host's PayPal (outside the system)
   - Admin clicks "Mark as Completed" in the dashboard
   - **What happens:**
     - Withdrawal status changes to `"completed"`
     - Transaction is recorded as `"withdrawal_completed"` type
     - **Important:** Host's `walletBalance` does NOT increase ✅
     - All balances remain virtual/preview only
     - Admin payment record is linked to this withdrawal
   - **Alert shown:** "Please ensure you have sent $X.XX from your PayPal account to [host's email]"

---

## 💰 Balance Types Explained

### `pendingBalance` (Hosts Only)
- **Type:** Virtual/Preview
- **Purpose:** Shows money from accepted bookings waiting for withdrawal
- **Increases when:** Host accepts a booking
- **Decreases when:** Host requests withdrawal
- **Real money location:** Admin's PayPal account

### `walletBalance` (All Users)
- **Type:** Virtual/Preview
- **Purpose:** General wallet balance (for guests: cash-in, rewards, etc.)
- **For hosts:** Remains virtual - does NOT increase from withdrawals
- **Real money location:** For guests: their own PayPal/e-wallet. For hosts: admin's PayPal until withdrawal.

---

## 🔐 Real Money Flow

```
Guest PayPal Payment
        ↓
Admin's PayPal Account (Real Money)
        ↓
[Host accepts booking]
        ↓
Host's pendingBalance (Virtual/Preview)
        ↓
[Host requests withdrawal]
        ↓
[Admin manually sends PayPal transfer]
        ↓
Host's PayPal Account (Real Money)
```

---

## ✅ Key Points Confirmed

1. ✅ **Guest pays → Admin's PayPal receives real money**
2. ✅ **Host accepts → Host's `pendingBalance` increases (virtual/preview)**
3. ✅ **Host requests withdrawal → Creates withdrawal request**
4. ✅ **Admin processes → Manually sends PayPal transfer (outside system)**
5. ✅ **Admin marks completed → Records transaction, does NOT add to walletBalance**
6. ✅ **All wallet balances are virtual/preview only**
7. ✅ **Real funds are stored in admin's PayPal account**

---

## 📝 Admin Responsibilities

When processing withdrawals:

1. **Review withdrawal request** in Cash-out Approvals
2. **Approve** the request (optional step)
3. **Manually send PayPal transfer** from your PayPal account to host's PayPal email
4. **Mark as Completed** in the dashboard
5. The system will record the transaction and link it to the admin payment

---

## 🛠️ Configuration

### Admin PayPal Account
- **Location:** Admin Dashboard → Policy & Compliance → Admin PayPal Account
- **Purpose:** Reference/tracking of which PayPal account receives payments
- **Note:** Actual PayPal payments go to the Business account linked to your PayPal Client ID

### PayPal Client ID
- **Location:** `src/config/paypal.js`
- **Purpose:** Links your app to a PayPal Business account
- **Important:** The Business account linked here is where payments actually go

---

## ✅ System Status

**Your payment system is correctly implemented!** All balances are virtual/preview, and real money flows through admin's PayPal account as designed.


