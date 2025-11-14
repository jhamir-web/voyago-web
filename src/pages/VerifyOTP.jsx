import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { verifyOTP, resendOTP } from "../utils/emailVerification";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

const VerifyOTP = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef([]);

  useEffect(() => {
    // Get userId from URL params or state
    const userIdParam = searchParams.get("userId");
    if (userIdParam) {
      setUserId(userIdParam);
      fetchUserEmail(userIdParam);
    } else {
      setError("Invalid verification link. Please request a new code.");
    }
  }, [searchParams]);

  useEffect(() => {
    // Countdown timer for resend
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const fetchUserEmail = async (uid) => {
    try {
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        setUserEmail(userDoc.data().email);
      }
    } catch (error) {
      console.error("Error fetching user email:", error);
    }
  };

  const handleOtpChange = (index, value) => {
    // Only allow numbers
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError("");

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(pastedData)) {
      const newOtp = pastedData.split("");
      setOtp(newOtp);
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");

    const otpCode = otp.join("");
    if (otpCode.length !== 6) {
      setError("Please enter the complete 6-digit code.");
      return;
    }

    if (!userId) {
      setError("Invalid verification session. Please request a new code.");
      return;
    }

    setLoading(true);

    try {
      await verifyOTP(otpCode, userId);
      
      // Success - redirect to login
      navigate("/login", {
        state: {
          message: "Email verified successfully! You can now sign in."
        }
      });
    } catch (err) {
      setError(err.message || "Invalid verification code. Please try again.");
      // Clear OTP on error
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;

    setResending(true);
    setError("");

    try {
      const userDoc = await getDoc(doc(db, "users", userId));
      if (!userDoc.exists()) {
        setError("User not found. Please sign up again.");
        return;
      }

      const userData = userDoc.data();
      await resendOTP(userData.email, userId, userData.firstName || "");
      
      setCountdown(60); // 60 second cooldown
      setError("");
      // Clear OTP inputs
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(`Failed to resend code: ${err.message || "Please try again."}`);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F5F7] to-white flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 sm:p-10 text-center animate-fadeInUp">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-[#0071E3] to-[#0051D0] rounded-3xl mb-6 shadow-lg shadow-[#0071E3]/20">
            <svg className="w-10 h-10 sm:w-12 sm:h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold text-[#1C1C1E] mb-3 tracking-tight">
            Verify Your Email
          </h1>
          <p className="text-[#8E8E93] font-light text-base">
            {userEmail ? `We sent a 6-digit code to ${userEmail}` : "Enter the 6-digit code sent to your email"}
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-6">
          <div className="flex justify-center gap-2 sm:gap-3">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                className="w-12 h-12 sm:w-14 sm:h-14 text-center text-2xl font-semibold border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/10 bg-[#F5F5F7] text-[#1C1C1E] transition-all"
                disabled={loading}
                autoFocus={index === 0}
              />
            ))}
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-light border-2 border-red-100 animate-fadeIn">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || otp.join("").length !== 6}
            className="w-full bg-[#0071E3] text-white py-3.5 rounded-xl text-base font-semibold hover:bg-[#0051D0] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#0071E3]/20 hover:shadow-xl hover:shadow-[#0071E3]/30"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Verifying...
              </span>
            ) : (
              "Verify Email"
            )}
          </button>

          <div className="text-center">
            <p className="text-sm text-[#8E8E93] font-light mb-2">
              Didn't receive the code?
            </p>
            <button
              type="button"
              onClick={handleResend}
              disabled={resending || countdown > 0}
              className="text-[#0071E3] font-medium hover:text-[#0051D0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resending
                ? "Sending..."
                : countdown > 0
                ? `Resend code in ${countdown}s`
                : "Resend code"}
            </button>
          </div>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={() => navigate("/login")}
            className="text-sm text-[#8E8E93] font-light hover:text-[#1C1C1E] transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerifyOTP;


