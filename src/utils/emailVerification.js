import emailjs from '@emailjs/browser';
import { EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY } from '../config/emailjs';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { auth } from '../firebase';

// Initialize EmailJS safely
let emailjsInitialized = false;
const initEmailJS = () => {
  if (!emailjsInitialized && EMAILJS_PUBLIC_KEY && EMAILJS_PUBLIC_KEY !== "YOUR_PUBLIC_KEY") {
    try {
      emailjs.init(EMAILJS_PUBLIC_KEY);
      emailjsInitialized = true;
    } catch (error) {
      console.error("Failed to initialize EmailJS:", error);
    }
  }
};

/**
 * Generate a secure verification token
 */
const generateVerificationToken = () => {
  // Generate a random token
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * Send verification email with link using EmailJS
 */
export const sendVerificationEmail = async (userEmail, userId, firstName = '') => {
  try {
    // Initialize EmailJS if not already initialized
    initEmailJS();
    
    // Generate verification token
    const token = generateVerificationToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Token expires in 24 hours

    // Get the app URL (for production, use environment variable)
    const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
    const verificationLink = `${appUrl}/verify-email?token=${token}&userId=${userId}`;

    // Store token in Firestore
    await setDoc(doc(db, 'emailVerifications', userId), {
      token: token,
      email: userEmail,
      userId: userId,
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
      verified: false,
    });

    // Prepare email template parameters
    // Make sure these match exactly with your EmailJS template variables
    const templateParams = {
      to_name: firstName || userEmail.split('@')[0],
      to_email: userEmail,
      verification_link: verificationLink,
    };

    // Send email via EmailJS
    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams
    );

    console.log('Verification email sent successfully', response);
    return { success: true };
  } catch (error) {
    console.error('Error sending verification email:', error);
    console.error('Error details:', {
      text: error.text,
      status: error.status,
    });
    
    // Provide more helpful error message
    if (error.status === 422) {
      throw new Error('EmailJS template configuration error. Please check that all template variables (to_name, to_email, verification_link) are set in your EmailJS template.');
    } else if (error.status === 400) {
      throw new Error('Invalid EmailJS configuration. Please check your Service ID, Template ID, and Public Key.');
    } else {
      throw new Error(`Failed to send verification email: ${error.text || error.message || 'Unknown error'}`);
    }
  }
};

/**
 * Verify email token
 */
export const verifyEmailToken = async (token, userId) => {
  try {
    const verificationDoc = await getDoc(doc(db, 'emailVerifications', userId));
    
    if (!verificationDoc.exists()) {
      throw new Error('Verification link not found. Please request a new verification email.');
    }

    const verificationData = verificationDoc.data();

    // Check if already verified
    if (verificationData.verified) {
      throw new Error('Email already verified');
    }

    // Check if token expired
    const expiresAt = new Date(verificationData.expiresAt);
    if (new Date() > expiresAt) {
      throw new Error('Verification link has expired. Please request a new verification email.');
    }

    // Check if token matches
    if (verificationData.token !== token) {
      throw new Error('Invalid verification link. Please request a new verification email.');
    }

    // Token is correct - mark email as verified
    await setDoc(doc(db, 'emailVerifications', userId), {
      ...verificationData,
      verified: true,
      verifiedAt: new Date().toISOString(),
    }, { merge: true });

    // Update user document
    await setDoc(doc(db, 'users', userId), {
      emailVerified: true,
    }, { merge: true });

    // If user is currently logged in, reload their auth state
    const user = auth.currentUser;
    if (user && user.uid === userId) {
      await user.reload();
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error verifying email token:', error);
    throw error;
  }
};
