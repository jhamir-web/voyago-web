import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, enableNetwork } from "firebase/firestore";
import { getStorage } from "firebase/storage";

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

