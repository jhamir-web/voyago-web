import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, enableNetwork } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

// Your Firebase configuration
// Please replace these with your actual Firebase config values
const firebaseConfig = {
  apiKey: "AIzaSyB4skUhZknmJehKiZw-WKU54pw61G8xl6M",
  authDomain: "voyago-a19e6.firebaseapp.com",
  projectId: "voyago-a19e6",
  storageBucket: "voyago-a19e6.firebasestorage.app",
  messagingSenderId: "1075684348189",
  appId: "1:1075684348189:web:dd452a705ea491c26091f4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

// Helper function to call PayPal Payout Server (Vercel)
// Your deployed Vercel URL
const PAYOUT_SERVER_URL = process.env.REACT_APP_PAYOUT_SERVER_URL || "https://voyago-f6zi89axw-jhamirs-projects-78cbce86.vercel.app";
const PAYOUT_API_KEY = process.env.REACT_APP_PAYOUT_API_KEY || "voyago-secret-api-key-2024";

export const processPayPalPayout = async (data, auth) => {
  // Verify user is authenticated (still check Firebase auth)
  if (!auth.currentUser) {
    throw new Error("User must be authenticated");
  }

  // Call the Vercel serverless function
  const url = `${PAYOUT_SERVER_URL}/api/payout`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": PAYOUT_API_KEY
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "PayPal payout failed");
  }

  return response.json();
};
export const storage = getStorage(app);

// Enable Firestore network (fixes offline errors)
enableNetwork(db).catch((error) => {
  console.warn("Could not enable Firestore network:", error);
});

// Configure Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account",
});
// Fix COOP errors by using redirect instead of popup for better compatibility
googleProvider.addScope("email");
googleProvider.addScope("profile");

