# Admin Dashboard Access Setup

## How to Access the Admin Dashboard

1. **URL**: Navigate to `/admin` or `/admin/dashboard` in your browser
   - Development: `http://localhost:5173/admin`
   - Production: `https://your-domain.com/admin`

2. **Login**: You must be logged in with an account that has admin privileges

## Setting Up an Admin User

To make a user an admin, you need to add the "admin" role to their Firestore user document:

### Option 1: Using Firebase Console

1. Go to Firebase Console → Firestore Database
2. Navigate to the `users` collection
3. Find the user document (by their user ID)
4. Edit the document and add:
   - Field: `roles` (type: array)
   - Value: `["admin", "guest"]` (or just `["admin"]`)

   OR if using the old format:
   - Field: `role` (type: string)
   - Value: `"admin"`

### Option 2: Using Firebase CLI

```bash
# Update a user document to have admin role
firebase firestore:set users/{USER_ID} '{"roles": ["admin", "guest"]}'
```

### Option 3: Programmatically (One-time setup script)

You can create a script to set yourself as admin. Create a file `setup-admin.js`:

```javascript
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from './src/firebase'; // Your firebase config

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function setupAdmin() {
  // Login as the user you want to make admin
  const userCredential = await signInWithEmailAndPassword(
    auth, 
    'your-admin-email@example.com', 
    'your-password'
  );
  
  const userId = userCredential.user.uid;
  
  // Add admin role
  await updateDoc(doc(db, 'users', userId), {
    roles: ['admin', 'guest']
  });
  
  console.log('Admin role added successfully!');
}

setupAdmin();
```

## Admin Dashboard Features

Once you have admin access, you can:

1. **Dashboard Overview** - View platform statistics
2. **Listings Management** - Manage all listings
3. **Users Management** - Manage hosts and guests
4. **Bookings Management** - View and manage all bookings
5. **Messages** - View platform messages
6. **Calendar** - View booking calendar
7. **Withdrawals** - Manage host withdrawal requests (NEW!)
   - Approve/reject withdrawal requests
   - Process payments from admin's PayPal to host's PayPal
   - Track all withdrawal transactions

## Important Notes

- The admin has a **separate PayPal account** from hosts and guests
- All booking payments go to the **admin's PayPal account**
- Hosts see "pending balance" until they request withdrawal
- Admin processes withdrawals and sends money from admin PayPal to host PayPal
- Only users with `roles: ["admin"]` or `role: "admin"` can access `/admin`

## Security

- The admin dashboard checks for admin role on every access
- Non-admin users are automatically redirected to home page
- Make sure to keep your admin credentials secure!


