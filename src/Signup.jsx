import React, { useState } from "react";
import { createUserWithEmailAndPassword, signInWithPopup, sendEmailVerification, signOut } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";
import { useNavigate, Link } from "react-router-dom";

const Signup = () => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Configure email verification with custom redirect
      const actionCodeSettings = {
        url: `${window.location.origin}/verify-email`,
        handleCodeInApp: true,
      };

      await sendEmailVerification(user, actionCodeSettings);
      console.log("Verification email sent to:", email);
      
      await setDoc(doc(db, "users", user.uid), {
        email: email,
        firstName: firstName,
        lastName: lastName,
        name: `${firstName} ${lastName}`.trim() || email.split("@")[0],
        role: "guest", // Keep for backward compatibility
        roles: ["guest"], // New roles array format
        createdAt: new Date().toISOString(),
        provider: "email",
        emailVerified: user.emailVerified,
        points: 0,
        walletBalance: 0,
        pointsHistory: [],
        transactions: [],
      });
      
      console.log("✓ User document created in Firestore");

      // Store email for redirect message
      const userEmail = email;
      
      await signOut(auth);
      
      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");

      setSuccess(`Account created successfully! A verification email has been sent to ${userEmail}. Please check your inbox (and spam folder) and click the verification link before signing in.`);
      setError("");
      
      // Redirect to login page after a brief delay to show success message
      setTimeout(() => {
        navigate("/login", {
          state: { 
            message: `Verification email sent to ${userEmail}. Please check your inbox and click the verification link before signing in.`
          }
        });
      }, 1500);
    } catch (err) {
      console.error("Signup error:", err);
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered. Please sign in instead.");
      } else if (err.code === "auth/weak-password") {
        setError("Password is too weak. Please choose a stronger password.");
      } else {
        setError("Failed to create account. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError("");
    setGoogleLoading(true);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      console.log("Google sign-up - emailVerified status:", user.emailVerified);

      try {
        console.log("Google signup - Checking Firestore for user:", user.uid);
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) {
          console.log("User document doesn't exist, creating with default guest role");
          // Split displayName into firstName and lastName
          const displayName = user.displayName || user.email?.split("@")[0] || "User";
          const nameParts = displayName.split(" ");
          const firstName = nameParts[0] || "";
          const lastName = nameParts.slice(1).join(" ") || "";
          
          await setDoc(doc(db, "users", user.uid), {
            email: user.email,
            firstName: firstName,
            lastName: lastName,
            name: displayName,
            role: "guest", // Keep for backward compatibility
            roles: ["guest"], // New roles array format
            createdAt: new Date().toISOString(),
            provider: "google",
            emailVerified: user.emailVerified,
            points: 0,
            walletBalance: 0,
            pointsHistory: [],
            transactions: [],
          });
          console.log("✓ User document created with default guest role");
        } else {
          const existingRole = userDoc.data().role;
          console.log("User document already exists");
          await setDoc(doc(db, "users", user.uid), {
            emailVerified: user.emailVerified,
          }, { merge: true });
          console.log("Updated user document (kept existing role:", existingRole, ")");
        }
      } catch (firestoreError) {
        console.error("Firestore operation failed:", firestoreError);
        await signOut(auth);
        if (firestoreError.code === "permission-denied") {
          setError("❌ Permission denied. Please check Firestore security rules.");
        } else {
          setError("❌ Failed to create account. Please try again.");
        }
        setGoogleLoading(false);
        return;
      }

      setGoogleLoading(false);
      console.log("✓ Google account verified and registered. Navigating to home...");
      
      // Wait a moment for AuthContext to update, then navigate
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 100);
    } catch (err) {
      console.error("Google sign-up error:", err);
      
      if (err.code === "auth/popup-closed-by-user") {
        setError("Sign-up was cancelled.");
      } else if (err.code === "auth/popup-blocked") {
        setError("Popup was blocked. Please allow popups and try again.");
      } else if (err.code === "auth/operation-not-allowed") {
        setError("Google authentication is not enabled.");
      } else if (err.code === "auth/unauthorized-domain") {
        setError("This domain is not authorized.");
      } else {
        setError(`Failed to sign up with Google: ${err.message || err.code || "Unknown error"}`);
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
              to="/login"
              className="text-sm sm:text-base font-medium text-white/90 hover:text-white transition-colors"
            >
              Sign in
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#1C1C1E] mb-3 sm:mb-4 tracking-tight">
                Create your account
              </h1>
              <p className="text-base sm:text-lg text-[#8E8E93] font-light">
                Join Voyago and start your journey
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSignup} className="space-y-5">
              {/* First Name and Last Name Side by Side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider">
                    First Name
                  </label>
                  <input
                    type="text"
                    className="w-full px-3.5 py-2.5 sm:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/10 bg-[#F5F5F7] text-[#1C1C1E] font-light transition-all duration-300 hover:border-gray-300"
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider">
                    Last Name
                  </label>
                  <input
                    type="text"
                    className="w-full px-3.5 py-2.5 sm:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/10 bg-[#F5F5F7] text-[#1C1C1E] font-light transition-all duration-300 hover:border-gray-300"
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input
                    type="email"
                    className="w-full pl-10 sm:pl-12 pr-3.5 sm:pr-4 py-2.5 sm:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/10 bg-[#F5F5F7] text-[#1C1C1E] font-light transition-all duration-300 hover:border-gray-300"
                    placeholder="Enter your email"
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
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type="password"
                    className="w-full pl-10 sm:pl-12 pr-3.5 sm:pr-4 py-2.5 sm:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/10 bg-[#F5F5F7] text-[#1C1C1E] font-light transition-all duration-300 hover:border-gray-300"
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type="password"
                    className="w-full pl-10 sm:pl-12 pr-3.5 sm:pr-4 py-2.5 sm:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/10 bg-[#F5F5F7] text-[#1C1C1E] font-light transition-all duration-300 hover:border-gray-300"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 sm:p-4 bg-red-50 text-red-600 rounded-xl text-xs sm:text-sm font-light border-2 border-red-100 animate-fadeIn">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 sm:p-4 bg-green-50 text-green-700 rounded-xl text-xs sm:text-sm font-light border-2 border-green-200 animate-fadeIn">
                  <div className="font-medium mb-1 sm:mb-2 text-xs sm:text-sm">✓ Success!</div>
                  <div className="text-xs sm:text-sm">{success}</div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !firstName || !lastName || !email || !password || !confirmPassword}
                className="w-full bg-[#0071E3] text-white py-3 sm:py-3.5 rounded-xl text-sm sm:text-base font-semibold hover:bg-[#0051D0] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#0071E3]/20 hover:shadow-xl hover:shadow-[#0071E3]/30 hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating account...
                  </span>
                ) : (
                  "Create Account"
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
              onClick={handleGoogleSignUp}
              disabled={loading || googleLoading}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 text-[#1C1C1E] py-3 sm:py-3.5 rounded-xl text-sm sm:text-base font-medium hover:bg-[#F5F5F7] hover:border-gray-300 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] mb-3"
            >
              {googleLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-[#1C1C1E]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Signing up...</span>
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

            {/* Sign in link */}
            <div className="mt-6 sm:mt-8 text-center">
              <p className="text-xs sm:text-sm text-[#8E8E93] font-light">
                Already have an account?{" "}
                <Link to="/login" className="text-[#0071E3] font-medium hover:text-[#0051D0] transition-colors">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
