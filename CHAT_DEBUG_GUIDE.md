# Chat Debug Guide

## What I Fixed

### 1. **Real-time Conversations List**
- ✅ Single `onSnapshot` listener for bookings
- ✅ Automatically updates when new conversations appear
- ✅ Fetches message-only conversations (no bookings)
- ✅ Real-time unread counts

### 2. **Real-time Messages**
- ✅ Single query per conversation using `conversationId`
- ✅ Also queries by `bookingId` for backward compatibility
- ✅ Processes initial snapshot (all messages)
- ✅ Uses `docChanges()` for subsequent updates
- ✅ Auto-marks messages as read
- ✅ Auto-scrolls to new messages

### 3. **Debugging Added**
- ✅ Console logs for all major operations
- ✅ Logs when conversations are loaded
- ✅ Logs when messages are received
- ✅ Logs validation failures

## How to Debug

### Open Browser Console (F12)
Look for these logs:

1. **Conversations Loading:**
   ```
   [Chat] Setting up real-time conversations listener
   [Chat] Bookings snapshot received: X bookings
   [Chat] Processed X unique conversations from bookings
   [Chat] Setting X conversations
   ```

2. **Messages Loading:**
   ```
   [Chat] Setting up message listener for: conversationId
   [Chat] Messages snapshot received: X messages
   [Chat] Processing snapshot from conversationId query: X messages (initial: true)
   [Chat] Updated messages: X total messages
   ```

3. **If Messages Don't Show:**
   - Check if `conversationId` matches in logs
   - Check if messages have `conversationId` field set
   - Check validation logs (might be skipping messages)

## Common Issues

### Issue 1: "No conversations yet"
**Possible causes:**
- No bookings exist
- User role is incorrect
- Firestore permissions issue

**Check:**
- Console logs for "Bookings snapshot received"
- Firestore console for bookings collection
- User authentication status

### Issue 2: Messages not showing
**Possible causes:**
- Messages don't have `conversationId` field
- `conversationId` format doesn't match
- Firestore index missing

**Check:**
- Console logs for "Messages snapshot received"
- Check message documents in Firestore
- Verify `conversationId` format: `userId1_userId2` (sorted)

### Issue 3: "Contact Host" not working
**Possible causes:**
- `location.state` not passed correctly
- Host ID is invalid
- Conversation already exists but not found

**Check:**
- Console logs for "Contact Host" flow
- Check `location.state` in React DevTools
- Verify host ID in Firestore

## Firestore Indexes Required

Create these indexes in Firestore Console:

1. **Collection:** `messages`
   - Fields: `conversationId` (Ascending), `createdAt` (Ascending)

2. **Collection:** `messages`
   - Fields: `conversationId` (Ascending), `receiverId` (Ascending), `read` (Ascending)

3. **Collection:** `messages`
   - Fields: `bookingId` (Ascending), `createdAt` (Ascending)

4. **Collection:** `messages`
   - Fields: `senderId` (Ascending), `createdAt` (Descending)

5. **Collection:** `messages`
   - Fields: `receiverId` (Ascending), `createdAt` (Descending)

## Message Data Structure

Messages MUST have:
```javascript
{
  conversationId: "userId1_userId2", // Normalized (sorted)
  senderId: "userId",
  receiverId: "userId",
  message: "text",
  createdAt: timestamp,
  read: boolean,
  bookingId: "optional" // Optional
}
```

## Testing Steps

1. **Test Conversations List:**
   - Create a booking
   - Check if conversation appears
   - Check console logs

2. **Test Messages:**
   - Select a conversation
   - Send a message
   - Check if it appears
   - Check console logs

3. **Test "Contact Host":**
   - Click "Contact Host" on listing
   - Check if conversation opens
   - Check console logs

4. **Test Real-time:**
   - Open chat in two browsers
   - Send message from one
   - Check if it appears in other
   - Check console logs

## Next Steps if Still Broken

1. **Check Console Logs** - Look for error messages
2. **Check Firestore** - Verify data structure
3. **Check Indexes** - Make sure all indexes are created
4. **Check Permissions** - Verify Firestore rules allow read/write
5. **Share Console Output** - Send me the console logs so I can help debug

