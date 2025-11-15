import React, { useState, useEffect } from "react";
import { createUserWithEmailAndPassword, signInWithPopup, signOut } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { sendVerificationEmail } from "./utils/emailVerification";
import Toast from "./components/Toast";

const Signup = () => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();
  const { currentUser, loading: authLoading } = useAuth();

  // Redirect if already logged in AND email is verified
  useEffect(() => {
    if (!authLoading && currentUser && currentUser.emailVerified) {
      navigate("/", { replace: true });
    }
  }, [currentUser, authLoading, navigate]);

  const handleSignup = async (e) => {
    e.preventDefault();
    setToast(null);

    if (password !== confirmPassword) {
      setToast({ message: "Passwords do not match.", type: "error" });
      return;
    }

    if (password.length < 6) {
      setToast({ message: "Password must be at least 6 characters.", type: "error" });
      return;
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Create user document first
      await setDoc(doc(db, "users", user.uid), {
        email: email,
        firstName: firstName,
        lastName: lastName,
        name: `${firstName} ${lastName}`.trim() || email.split("@")[0],
        role: "guest",
        roles: ["guest"],
        createdAt: new Date().toISOString(),
        provider: "email",
        emailVerified: false, // Will be set to true after verification
        points: 0,
        walletBalance: 0,
        pointsHistory: [],
        transactions: [],
      });
      
      const userEmail = email;
      let emailSent = false;
      let emailError = null;
      
      // Try to send verification email using EmailJS
      try {
        await sendVerificationEmail(email, user.uid, firstName);
        emailSent = true;
      } catch (err) {
        emailError = err;
        console.error("Failed to send verification email:", err);
        // Account is created, but email failed - we'll show a warning
        // Don't throw - let the account creation succeed
      }
      
      // Sign out the user immediately
      await signOut(auth);
      
      // Clear form fields
      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");

      if (emailSent) {
        // Show success toast and redirect to login
        setToast({ 
          message: "Account created successfully! Please check your email (and spam folder) for the verification link.",
          type: "success"
        });
        setTimeout(() => {
          navigate("/login", { replace: true });
        }, 2000);
      } else {
        // Account created but email failed
        const errorMsg = emailError?.message || emailError?.text || 'Unknown error';
        setToast({ 
          message: `Account created, but verification email failed to send. Error: ${errorMsg}. Please check your EmailJS template configuration or try resending the verification email from the login page.`,
          type: "warning"
        });
      }
    } catch (err) {
      console.error("Signup error:", err);
      if (err.code === "auth/email-already-in-use") {
        setToast({ message: "This email is already registered. Please sign in instead.", type: "error" });
      } else if (err.code === "auth/weak-password") {
        setToast({ message: "Password is too weak. Please choose a stronger password.", type: "error" });
      } else if (err.message?.includes("EmailJS")) {
        setToast({ message: err.message, type: "error" });
      } else {
        setToast({ message: `Failed to create account: ${err.message || "Please try again."}`, type: "error" });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setToast(null);
    setGoogleLoading(true);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const userDoc = await getDoc(doc(db, "users", user.uid));
      
      if (!userDoc.exists()) {
        const displayName = user.displayName || user.email?.split("@")[0] || "User";
        const nameParts = displayName.split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";
        
        await setDoc(doc(db, "users", user.uid), {
          email: user.email,
          firstName: firstName,
          lastName: lastName,
          name: displayName,
          role: "guest",
          roles: ["guest"],
          createdAt: new Date().toISOString(),
          provider: "google",
          emailVerified: user.emailVerified,
          points: 0,
          walletBalance: 0,
          pointsHistory: [],
          transactions: [],
        });
      } else {
        await setDoc(doc(db, "users", user.uid), {
          emailVerified: user.emailVerified,
        }, { merge: true });
      }

      setGoogleLoading(false);
      
      // Navigate immediately - AuthContext will update in the background
      navigate("/", { replace: true });
      
    } catch (err) {
      console.error("Google sign-up error:", err);
      
      if (err.code === "auth/popup-closed-by-user") {
        setToast({ message: "Sign-up was cancelled.", type: "warning" });
      } else if (err.code === "auth/popup-blocked") {
        setToast({ message: "Popup was blocked. Please allow popups and try again.", type: "error" });
      } else if (err.code === "auth/operation-not-allowed") {
        setToast({ message: "Google authentication is not enabled.", type: "error" });
      } else if (err.code === "auth/unauthorized-domain") {
        setToast({ message: "This domain is not authorized.", type: "error" });
      } else {
        setToast({ message: `Failed to sign up with Google: ${err.message || err.code || "Unknown error"}`, type: "error" });
      }
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
          <div className="login-signup-card bg-white rounded-3xl shadow-2xl shadow-black/10 border border-gray-200/50 p-8 sm:p-10 lg:p-12 backdrop-blur-sm">
            {/* Logo/Icon Section */}
            <div className="text-center mb-8 sm:mb-10">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#1C1C1E] mb-3 sm:mb-4 tracking-tight">
                Create your account
              </h1>
              <p className="text-base sm:text-lg text-[#8E8E93] font-light">
                Join Voyago and start your journey
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSignup} className="space-y-5">
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
                    disabled={loading || googleLoading}
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
                    disabled={loading || googleLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider">
                  Email Address
                </label>
                <input
                  type="email"
                  className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/10 bg-[#F5F5F7] text-[#1C1C1E] font-light transition-all duration-300 hover:border-gray-300"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading || googleLoading}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider">
                  Password
                </label>
                <input
                  type="password"
                  className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/10 bg-[#F5F5F7] text-[#1C1C1E] font-light transition-all duration-300 hover:border-gray-300"
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading || googleLoading}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider">
                  Confirm Password
                </label>
                <input
                  type="password"
                  className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/10 bg-[#F5F5F7] text-[#1C1C1E] font-light transition-all duration-300 hover:border-gray-300"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading || googleLoading}
                />
              </div>


              <button
                type="submit"
                disabled={loading || googleLoading || !firstName || !lastName || !email || !password || !confirmPassword}
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
              type="button"
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
      
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          duration={10000}
        />
      )}
    </div>
  );
};

export default Signup;
