import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { auth } from "../firebase";
import { verifyEmailToken } from "../utils/emailVerification";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("verifying");
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    const handleVerification = async () => {
      try {
        // Check for custom token (EmailJS verification)
        const token = searchParams.get("token");
        const userId = searchParams.get("userId");
        
        // Also check for Firebase's oobCode (for backward compatibility)
        const mode = searchParams.get("mode");
        const actionCode = searchParams.get("oobCode");

        // Handle token-based verification (EmailJS)
        if (token && userId) {
          await verifyEmailToken(token, userId);
          setStatus("success");
          setMessage("Email verified successfully! Redirecting to login...");
          setTimeout(() => {
            navigate("/login", {
              state: {
                message: "Email verified successfully! You can now sign in."
              }
            });
          }, 2000);
          return;
        }

        // Handle Firebase's built-in verification (backward compatibility)
        if (mode === "verifyEmail" && actionCode) {
          const { applyActionCode } = await import("firebase/auth");
          await applyActionCode(auth, actionCode);
          setStatus("success");
          setMessage("Email verified successfully! Redirecting to login...");
          setTimeout(() => {
            navigate("/login", {
              state: {
                message: "Email verified successfully! You can now sign in."
              }
            });
          }, 2000);
          return;
        }

        // No valid verification method found
        setStatus("error");
        setMessage("Invalid verification link. Please request a new verification email.");
        setTimeout(() => navigate("/login"), 3000);
      } catch (error) {
        console.error("Verification error:", error);
        setStatus("error");
        
        if (error.message?.includes("expired")) {
          setMessage("This verification link has expired. Please request a new verification email.");
        } else if (error.message?.includes("already verified")) {
          setMessage("This email is already verified. You can sign in now.");
          setTimeout(() => {
            navigate("/login", {
              state: {
                message: "Email already verified. You can sign in now."
              }
            });
          }, 2000);
          return;
        } else if (error.message?.includes("Invalid") || error.message?.includes("not found")) {
          setMessage("This verification link is invalid. Please request a new verification email.");
        } else {
          setMessage("Failed to verify email. Please try again or request a new verification email.");
        }
        
        setTimeout(() => navigate("/login"), 4000);
      }
    };

    handleVerification();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F5F7] to-white flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 sm:p-10 text-center animate-fadeInUp">
        {status === "verifying" && (
          <>
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#0071E3]/10 flex items-center justify-center">
              <svg className="w-10 h-10 text-[#0071E3] animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#1C1C1E] mb-3">Verifying Email</h1>
            <p className="text-[#8E8E93] font-light">{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#1C1C1E] mb-3">Email Verified!</h1>
            <p className="text-[#8E8E93] font-light mb-6">{message}</p>
            <div className="w-full h-1 bg-[#F2F2F7] rounded-full overflow-hidden">
              <div className="h-full bg-[#0071E3] rounded-full animate-pulse" style={{ width: "100%" }}></div>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#1C1C1E] mb-3">Verification Failed</h1>
            <p className="text-[#8E8E93] font-light mb-6">{message}</p>
            <button
              onClick={() => navigate("/login")}
              className="w-full py-3 bg-[#0071E3] text-white rounded-xl font-medium hover:bg-[#0051D0] transition-colors"
            >
              Go to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
