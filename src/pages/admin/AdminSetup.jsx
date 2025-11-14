import React, { useState } from "react";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { useNavigate, Link } from "react-router-dom";
import Toast from "../../components/Toast";

const AdminSetup = () => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  const handleAdminSignup = async (e) => {
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
      // Create Firebase Auth account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Create user document with admin role
      await setDoc(doc(db, "users", user.uid), {
        email: email,
        firstName: firstName,
        lastName: lastName,
        name: `${firstName} ${lastName}`.trim() || email.split("@")[0],
        role: "admin",
        roles: ["admin", "guest"], // Admin can also access guest features
        createdAt: new Date().toISOString(),
        provider: "email",
        emailVerified: false,
        points: 0,
        walletBalance: 0,
        pendingBalance: 0,
        pointsHistory: [],
        transactions: [],
        isAdmin: true, // Additional flag for admin
      });
      
      // Sign out immediately (they'll sign in separately)
      await signOut(auth);
      
      // Clear form
      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");

      setToast({ 
        message: "Admin account created successfully! You can now sign in with this account.",
        type: "success"
      });
      
      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 3000);
    } catch (err) {
      console.error("Admin signup error:", err);
      if (err.code === "auth/email-already-in-use") {
        setToast({ message: "This email is already registered. Please use a different email or sign in instead.", type: "error" });
      } else if (err.code === "auth/weak-password") {
        setToast({ message: "Password is too weak. Please choose a stronger password.", type: "error" });
      } else {
        setToast({ message: `Failed to create admin account: ${err.message || "Please try again."}`, type: "error" });
      }
    } finally {
      setLoading(false);
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
              <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-[#0071E3] to-[#0051D0] rounded-3xl mb-6 sm:mb-8 shadow-lg shadow-[#0071E3]/20 animate-scaleIn">
                <svg className="w-10 h-10 sm:w-12 sm:h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#1C1C1E] mb-3 sm:mb-4 tracking-tight">
                Admin Account Setup
              </h1>
              <p className="text-base sm:text-lg text-[#8E8E93] font-light">
                Create your system administrator account
              </p>
            </div>

            {/* Warning Notice */}
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-yellow-800 mb-1">Important</p>
                  <p className="text-xs text-yellow-700 font-light">
                    This will create a separate admin account. Use a different email from your host account. After creation, you'll need to sign in with these credentials.
                  </p>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleAdminSignup} className="space-y-5">
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
                    placeholder="admin@voyago.com"
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
                    placeholder="Create a secure password"
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
                    Creating admin account...
                  </span>
                ) : (
                  "Create Admin Account"
                )}
              </button>
            </form>

            {/* Sign in link */}
            <div className="mt-6 sm:mt-8 text-center">
              <p className="text-xs sm:text-sm text-[#8E8E93] font-light">
                Already have an admin account?{" "}
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

export default AdminSetup;


