# Chat & Message Storage Structure

## Overview
Messages are stored in Firestore in the `messages` collection. Conversations are identified by **user IDs** (not booking IDs), allowing multiple bookings between the same users to share one conversation thread.

---

## Firestore Collections

### 1. `messages` Collection
**Location:** `messages/{messageId}`

Each message document contains:

```javascript
{
  // Message Content
  message: string,              // The actual message text
  createdAt: string,            // ISO timestamp (e.g., "2025-01-15T10:30:00.000Z")
  
  // User Identification (PRIMARY - identifies conversation)
  conversationId: string,       // Normalized format: "userId1_userId2" (sorted alphabetically)
  senderId: string,            // Firebase Auth UID of sender
  receiverId: string,          // Firebase Auth UID of receiver
  senderName: string,          // Display name of sender
  senderEmail: string,         // Email of sender
  receiverEmail: string,       // Email of receiver
  
  // Booking/Listing Context (OPTIONAL - for reference)
  bookingId: string | null,    // Booking ID if message is related to a booking
  listingId: string | null,    // Listing ID if message started from listing page
  
  // Read Status
  read: boolean,               // Whether receiver has read the message
  readAt: string | null,      // ISO timestamp when message was read
  
  // System Messages (optional)
  isSystem: boolean,           // true for system-generated messages
  systemType: string,          // e.g., "booking_accepted", "booking_cancelled"
}
```

**Example Message:**
```javascript
{
  message: "Hi, I'm interested in booking your place!",
  createdAt: "2025-01-15T10:30:00.000Z",
  conversationId: "abc123_xyz789",  // Normalized: always sorted user IDs
  senderId: "abc123",              // Guest's UID
  receiverId: "xyz789",             // Host's UID
  senderName: "John Doe",
  senderEmail: "john@example.com",
  receiverEmail: "host@example.com",
  bookingId: "booking123",         // Optional: if related to booking
  listingId: "listing456",          // Optional: if started from listing
  read: false,
  readAt: null
}
```

---

### 2. `typing` Collection
**Location:** `typing/{conversationId}_{userId}`

Stores typing indicators:

```javascript
{
  isTyping: boolean,            // true when user is typing
  userId: string,              // Firebase Auth UID of typing user
  updatedAt: Timestamp,       // Firestore server timestamp
}
```

**Document ID Format:**
- Primary: `${normalizedConvId}_${userId}` (e.g., `"abc123_xyz789_abc123"`)
- Fallback: `${bookingId}_${userId}` (for backward compatibility)

---

## How Conversations Work

### Conversation Identification
Conversations are identified by **user IDs**, not booking IDs:

1. **Normalized Conversation ID:**
   ```javascript
   // Helper function always sorts user IDs alphabetically
   getConversationId(userId1, userId2)
   // Returns: userId1 < userId2 ? "userId1_userId2" : "userId2_userId1"
   ```

2. **Example:**
   - Guest ID: `"guest123"`
   - Host ID: `"host456"`
   - Conversation ID: `"guest123_host456"` (always sorted)

### Why This Matters
- **Multiple bookings** with the same host = **one conversation**
- Messages from all bookings appear in the same thread
- Easy to find existing conversations when clicking "Contact Host"

---

## How Host Stores Chat

### 1. **Fetching Conversations**
Host queries bookings where they are the host:
```javascript
query(
  collection(db, "bookings"),
  where("hostId", "==", currentUser.uid)
)
```

Then groups bookings by `guestId` to create conversations:
```javascript
// All bookings with same guest = one conversation
conversationsByUser.set(guestId, {
  otherUserId: guestId,        // Guest's UID
  bookings: [...],              // All bookings with this guest
  userData: {...},             // Guest's profile data
  lastMessage: {...},          // Most recent message
  unreadCount: 0,              // Unread message count
  lastActivityTime: timestamp
})
```

### 2. **Fetching Messages**
Host listens for messages where:
- `receiverId == hostId` (messages received)
- `senderId == hostId` (messages sent)
- `conversationId == normalizedConvId` OR `bookingId IN [bookingIds]`

**Query Structure:**
```javascript
// Messages with bookings
query(
  collection(db, "messages"),
  where("bookingId", "==", bookingId),
  orderBy("createdAt", "asc")
)

// Messages without bookings (pre-booking contact)
query(
  collection(db, "messages"),
  where("conversationId", "==", normalizedConvId),
  orderBy("createdAt", "asc")
)
```

### 3. **Sending Messages**
When host sends a message:
```javascript
const messageData = {
  conversationId: "guest123_host456",  // Normalized user IDs
  senderId: "host456",                 // Host's UID
  receiverId: "guest123",              // Guest's UID
  bookingId: "booking123" || null,    // If related to booking
  message: "Hello!",
  createdAt: new Date().toISOString(),
  read: false
}

await addDoc(collection(db, "messages"), messageData);
```

---

## Data Flow

### Guest Sends Message:
1. Guest types message → stored in `messages` collection
2. Message has `conversationId: "guest123_host456"`
3. Host's real-time listener detects new message
4. Message appears in host's chat interface

### Host Sends Message:
1. Host types message → stored in `messages` collection
2. Message has same `conversationId: "guest123_host456"`
3. Guest's real-time listener detects new message
4. Message appears in guest's chat interface

### Finding Existing Conversations:
1. Check loaded conversations by `otherUserId`
2. If not found, query messages by `conversationId`
3. If messages exist → open existing conversation
4. If no messages → create new conversation

---

## Key Points

✅ **Conversations are identified by USER IDs** (normalized format)  
✅ **Multiple bookings = one conversation** (grouped by user)  
✅ **Messages always include `conversationId`** (for user-based grouping)  
✅ **Messages may include `bookingId`** (for booking context)  
✅ **Real-time updates** via Firestore `onSnapshot` listeners  
✅ **Typing indicators** stored in separate `typing` collection  

---

## Firestore Indexes Required

For optimal performance, create these composite indexes:

1. **Messages by bookingId:**
   - Collection: `messages`
   - Fields: `bookingId` (Ascending), `createdAt` (Ascending)

2. **Messages by conversationId:**
   - Collection: `messages`
   - Fields: `conversationId` (Ascending), `createdAt` (Ascending)

3. **Unread messages:**
   - Collection: `messages`
   - Fields: `bookingId` (Ascending), `receiverId` (Ascending), `read` (Ascending)
   - AND
   - Collection: `messages`
   - Fields: `conversationId` (Ascending), `receiverId` (Ascending), `read` (Ascending)

4. **Messages by sender/receiver:**
   - Collection: `messages`
   - Fields: `senderId` (Ascending), `receiverId` (Ascending)

