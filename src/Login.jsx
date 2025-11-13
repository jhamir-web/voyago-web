import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword, signInWithPopup, sendEmailVerification, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, googleProvider, db } from "./firebase";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.message) {
      setInfo(location.state.message);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    if (!email || !password) {
      setError("Please enter both email and password.");
      setLoading(false);
      return;
    }

    try {
      console.log("Attempting to sign in with email:", email);
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      console.log("✓ Login successful for user:", user.email);
      
      let userDoc;
      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Firestore check timed out")), 10000)
        );
        
        userDoc = await Promise.race([
          getDoc(doc(db, "users", user.uid)),
          timeoutPromise
        ]);
        
        if (!userDoc.exists()) {
          console.error("⚠ SECURITY: User exists in Auth but NOT in Firestore!");
          await signOut(auth);
          setError("❌ Account not found. Please sign up first.");
          setLoading(false);
          return;
        }
      } catch (firestoreError) {
        console.error("⚠ SECURITY: Cannot verify account in Firestore:", firestoreError);
        await signOut(auth);
        if (firestoreError.message?.includes("timed out")) {
          setError("❌ Verification timed out. Please check your internet connection and try again.");
        } else {
          setError("❌ Cannot verify account. Please check your internet connection and try again.");
        }
        setLoading(false);
        return;
      }
      
      const userData = userDoc.data();
      console.log("✓ User found in Firestore:", userData);
      
      if (!userData.provider || (userData.provider !== "email" && userData.provider !== "google")) {
        console.warn("⚠ User account missing provider information");
        await signOut(auth);
        setError("❌ Account not properly registered. Please sign up first.");
        setLoading(false);
        return;
      }
      
      if (!user.emailVerified) {
        console.warn("Email not verified for user:", user.email);
        await signOut(auth);
        setError("❌ Please verify your email before signing in. Check your inbox (and spam folder) for the verification email and click the verification link.");
        setInfo("");
        setLoading(false);
        return;
      }
      
      console.log("✓ All security checks passed. Email verified. Navigating...");
      const returnTo = location.state?.returnTo || "/";
      setLoading(false);
      
      // Small delay to ensure state is updated before navigation
      setTimeout(() => {
        navigate(returnTo, { replace: true });
      }, 50);
    } catch (err) {
      console.error("✗ Login FAILED");
      console.error("Error code:", err.code);
      console.error("Error message:", err.message);
      
      // Ensure we're signed out on error
      try {
        await signOut(auth);
      } catch (signOutError) {
        console.warn("Error signing out:", signOutError);
      }
      
      // Set appropriate error message
      if (err.code === "auth/user-not-found") {
        setError("❌ No account found with this email. Please sign up first.");
      } else if (err.code === "auth/invalid-credential") {
        setError("❌ Invalid email or password. If you don't have an account, please sign up first.");
      } else if (err.code === "auth/wrong-password") {
        setError("❌ Incorrect password. Please try again.");
      } else if (err.code === "auth/invalid-email") {
        setError("❌ Invalid email address. Please check and try again.");
      } else if (err.code === "auth/too-many-requests") {
        setError("❌ Too many failed login attempts. Please try again later.");
      } else if (err.code === "auth/network-request-failed") {
        setError("❌ Network error. Please check your connection and try again.");
      } else {
        setError(`❌ Failed to sign in: ${err.message || err.code || "Unknown error"}`);
      }
      
      setInfo(""); // Clear any info messages
      setLoading(false);
      
      // Don't redirect on error - stay on login page to show error
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }

    setResending(true);
    setError("");
    setInfo("");

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      if (user.emailVerified) {
        setInfo("Your email is already verified. You can sign in now.");
        const returnTo = location.state?.returnTo || "/";
        navigate(returnTo);
        return;
      }

      // Configure email verification with custom redirect
      const actionCodeSettings = {
        url: `${window.location.origin}/verify-email`,
        handleCodeInApp: true,
      };

      await sendEmailVerification(user, actionCodeSettings);
      await signOut(auth);
      setInfo("Verification email sent! Please check your inbox.");
    } catch (err) {
      console.error("Resend verification error:", err);
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        setError("Invalid email or password. Please check your credentials.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many requests. Please wait a few minutes before requesting another email.");
      } else {
        setError("Failed to send verification email. Please try again.");
      }
    } finally {
      setResending(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setGoogleLoading(true);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      console.log("Google sign-in - emailVerified status:", user.emailVerified);

      let userDoc;
      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Firestore check timed out")), 10000)
        );
        
        userDoc = await Promise.race([
          getDoc(doc(db, "users", user.uid)),
          timeoutPromise
        ]);
      } catch (firestoreError) {
        console.error("⚠ SECURITY: Cannot verify account in Firestore:", firestoreError);
        await signOut(auth);
        if (firestoreError.message?.includes("timed out")) {
          setError("❌ Verification timed out. Please check your internet connection and try again.");
        } else {
          setError("❌ Cannot verify account. Please sign up first.");
        }
        setGoogleLoading(false);
        return;
      }

      if (!userDoc.exists()) {
        console.error("⚠ SECURITY: User exists in Auth but NOT in Firestore!");
        await signOut(auth);
        setError("❌ This account is not registered. Please sign up first.");
        setGoogleLoading(false);
        return;
      }

      const userData = userDoc.data();
      console.log("✓ User found in Firestore:", userData);

      if (!userData.provider || userData.provider !== "google") {
        console.warn("⚠ User account provider mismatch");
        await signOut(auth);
        setError("❌ Account not properly registered. Please sign up first.");
        setGoogleLoading(false);
        return;
      }

      if (!user.emailVerified) {
        console.warn("⚠ Google account shows as unverified (unusual). Proceeding anyway.");
      }

      console.log("✓ Google account verified and registered. Allowing access...");
      
      try {
        await setDoc(doc(db, "users", user.uid), {
          emailVerified: user.emailVerified,
        }, { merge: true });
        console.log("✓ Firestore updated successfully");
      } catch (updateError) {
        console.warn("Could not update emailVerified status:", updateError);
      }
      
      console.log("✓ Google account verified and registered. Navigating...");
      
      // Clear loading state first
      setGoogleLoading(false);
      
      // Navigate to homepage using React Router
      const returnTo = location.state?.returnTo || "/";
      navigate(returnTo, { replace: true });
    } catch (err) {
      console.error("Google sign-in error:", err);
      
      if (err.code === "auth/popup-closed-by-user") {
        setError("Sign-in was cancelled.");
      } else if (err.code === "auth/popup-blocked") {
        setError("Popup was blocked. Please allow popups and try again.");
      } else if (err.code === "auth/operation-not-allowed") {
        setError("Google authentication is not enabled.");
      } else if (err.code === "auth/unauthorized-domain") {
        setError("This domain is not authorized.");
      } else {
        setError(`Failed to sign in with Google: ${err.message || err.code || "Unknown error"}`);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F5F7] via-white to-[#F5F5F7] flex flex-col">
      {/* Header */}
      <header className="bg-black/90 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          <div className="flex justify-between items-center">
            <Link to="/" className="text-xl sm:text-2xl font-semibold text-white tracking-tight hover:opacity-80 transition-opacity">
              Voyago
            </Link>
            <Link
              to="/signup"
              className="text-sm sm:text-base font-medium text-white/90 hover:text-white transition-colors"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12 lg:py-16">
        <div className="w-full max-w-md animate-fadeInUp">
          {/* Entire Card Container */}
          <div className="login-signup-card bg-white rounded-3xl shadow-2xl shadow-black/10 border border-gray-200/50 p-8 sm:p-10 lg:p-12 backdrop-blur-sm">
            {/* Logo/Icon Section */}
            <div className="text-center mb-8 sm:mb-10">
              <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-[#0071E3] to-[#0051D0] rounded-3xl mb-6 sm:mb-8 shadow-lg shadow-[#0071E3]/20 animate-scaleIn">
                <svg className="w-10 h-10 sm:w-12 sm:h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#1C1C1E] mb-3 sm:mb-4 tracking-tight">
                Welcome back
              </h1>
              <p className="text-base sm:text-lg text-[#8E8E93] font-light">
                Sign in to continue your journey
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider">
                  Email Address
                </label>
                <div className="relative group">
                  <input
                    type="email"
                    className="w-full px-3.5 py-2.5 sm:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/10 bg-[#F5F5F7] text-[#1C1C1E] font-light transition-all duration-300 group-hover:border-gray-300"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider">
                  Password
                </label>
                <div className="relative group">
                  <input
                    type="password"
                    className="w-full px-3.5 py-2.5 sm:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/10 bg-[#F5F5F7] text-[#1C1C1E] font-light transition-all duration-300 group-hover:border-gray-300"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 sm:p-4 bg-red-50 text-red-600 rounded-xl text-xs sm:text-sm font-light border-2 border-red-100 animate-fadeIn">
                  <div className="text-xs sm:text-sm">{error}</div>
                  {error.includes("verify your email") && (
                    <div className="mt-2 sm:mt-3">
                      <button
                        onClick={handleResendVerification}
                        disabled={resending || !email || !password}
                        className="text-red-600 hover:text-red-800 underline text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        {resending ? "Sending..." : "Resend verification email"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {info && (
                <div className="p-3 sm:p-4 bg-blue-50 text-blue-600 rounded-xl text-xs sm:text-sm font-light border-2 border-blue-100 animate-fadeIn">
                  <div className="text-xs sm:text-sm">{info}</div>
                  {info.includes("verify your email") && (
                    <div className="mt-2 sm:mt-3">
                      <button
                        onClick={handleResendVerification}
                        disabled={resending || !email || !password}
                        className="text-blue-600 hover:text-blue-800 underline text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {resending ? "Sending..." : "Resend verification email"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full bg-[#0071E3] text-white py-3 sm:py-3.5 rounded-xl text-sm sm:text-base font-semibold hover:bg-[#0051D0] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#0071E3]/20 hover:shadow-xl hover:shadow-[#0071E3]/30 hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-6 sm:my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="px-4 bg-white text-[#8E8E93] text-xs sm:text-sm font-light">or</span>
              </div>
            </div>

            {/* Google Button */}
            <button
              onClick={handleGoogleSignIn}
              disabled={loading || googleLoading}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 text-[#1C1C1E] py-3 sm:py-3.5 rounded-xl text-sm sm:text-base font-medium hover:bg-[#F5F5F7] hover:border-gray-300 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
            >
              {googleLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-[#1C1C1E]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            {/* Sign up link */}
            <div className="mt-6 sm:mt-8 text-center">
              <p className="text-xs sm:text-sm text-[#8E8E93] font-light">
                Don't have an account?{" "}
                <Link to="/signup" className="text-[#0071E3] font-medium hover:text-[#0051D0] transition-colors">
                  Sign up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
