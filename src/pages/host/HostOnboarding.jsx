import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { PAYPAL_CLIENT_ID } from "../../config/paypal";
import Header from "../../components/Header";

const TOTAL_STEPS = 6;

const HostOnboarding = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isUpgrade = searchParams.get("upgrade") === "true";
  const upgradePlanId = searchParams.get("plan");
  const { currentUser, userRole, userRoles, setUserRole, loading: authLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState(isUpgrade ? 3 : 1); // Skip to payment step if upgrading
  const [showPolicyModal, setShowPolicyModal] = useState(!isUpgrade); // Don't show policy modal if upgrading
  const [policyAcknowledged, setPolicyAcknowledged] = useState(isUpgrade); // Auto-acknowledge if upgrading
  const [formData, setFormData] = useState({
    plan: null,
    profilePhoto: null,
    profilePhotoUrl: null,
    fullName: "",
    bio: "",
    hostingExperience: "",
    paypalEmail: "",
    agreeToTerms: false,
    policyRead: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Use a ref to track if we should allow redirects
  const isOnboardingActive = useRef(true); // Start as true to prevent initial redirect
  const hasCheckedOnboarding = useRef(false);

  useEffect(() => {
    // Mark that we're in onboarding if currentStep is between 1-6
    isOnboardingActive.current = currentStep > 0 && currentStep < 7;
  }, [currentStep]);

  useEffect(() => {
    if (authLoading) return;
    
    if (!currentUser) {
      navigate("/login");
      return;
    }

    // Always check if we're in onboarding first - NEVER redirect if in onboarding
    const isInOnboarding = currentStep > 0 && currentStep < 7;
    
    // Don't redirect if we're actively in the onboarding process
    if (isInOnboarding) {
      // We're in the onboarding flow, don't redirect - just load data once
      if (!hasCheckedOnboarding.current) {
        loadUserData();
        hasCheckedOnboarding.current = true;
      }
      return; // CRITICAL: Exit early to prevent any redirects
    }

    // Only check onboarding status once on initial mount if not in onboarding
    if (hasCheckedOnboarding.current) {
      return; // Already checked, don't check again
    }

    // Check if onboarding is already completed (only on initial mount if not in onboarding)
    const checkOnboardingStatus = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          // Only redirect if onboarding is completed AND user has host role AND we're not in onboarding
          if (userData.onboardingCompleted && userRoles && userRoles.includes("host")) {
            navigate("/host/listings");
            return;
          }
        }
      } catch (error) {
        console.error("Error checking onboarding status:", error);
      }
      
      // Load existing user data if not redirecting
      loadUserData();
      hasCheckedOnboarding.current = true;
    };

    checkOnboardingStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, authLoading, navigate, currentStep]); // Include currentStep to always check if in onboarding

  const loadUserData = async () => {
    if (!currentUser) return;
    
    try {
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setFormData(prev => ({
          ...prev,
          fullName: userData.name || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || currentUser.displayName || "",
          profilePhotoUrl: userData.profilePhotoUrl || null
        }));
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  };

  // Load plan data when in upgrade mode
  useEffect(() => {
    if (isUpgrade && upgradePlanId) {
      const plans = [
        {
          id: "starter",
          name: "Starter",
          price: 29,
          listings: 3,
          duration: "1 year",
          description: "Perfect for new hosts looking to get started",
          bestFor: "New hosts"
        },
        {
          id: "pro",
          name: "Pro",
          price: 79,
          listings: 10,
          duration: "1 year",
          description: "Ideal for growing hosts expanding their presence",
          bestFor: "Growing hosts",
          popular: true
        },
        {
          id: "elite",
          name: "Elite",
          price: 199,
          listings: 1000,
          duration: "1 year",
          description: "Best for businesses and professional hosts",
          bestFor: "Businesses"
        }
      ];

      const selectedPlan = plans.find(plan => plan.id === upgradePlanId);
      if (selectedPlan) {
        setFormData(prev => ({
          ...prev,
          plan: selectedPlan,
          policyRead: true, // Auto-acknowledge for upgrades
          agreeToTerms: true // Auto-agree for upgrades
        }));
      }
    }
  }, [isUpgrade, upgradePlanId]);

  const handleNext = () => {
    if (currentStep === 1) {
      // Welcome step - validate policy is read
      if (!formData.policyRead) {
        setError("Please read and acknowledge the Policy and Compliance guidelines before continuing.");
        setShowPolicyModal(true);
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      // Plan selection - validate plan is selected
      if (!formData.plan) {
        setError("Please select a plan to continue");
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      // Payment - handled by PayPal
      // This will be handled by PayPal success callback
    } else if (currentStep === 4) {
      // Profile Photo - optional, can skip
      setCurrentStep(5);
    } else if (currentStep === 5) {
      // Host Information - validate required fields
      if (!formData.fullName.trim()) {
        setError("Full name is required");
        return;
      }
      if (!formData.paypalEmail.trim()) {
        setError("PayPal email is required for payouts");
        return;
      }
      setCurrentStep(6);
    } else if (currentStep === 6) {
      // Profile Preview - validate terms
      if (!formData.agreeToTerms) {
        setError("Please agree to the Hosting Terms and Conditions");
        return;
      }
      handleFinish();
    }
    setError("");
  };

  const handleBack = () => {
    if (isUpgrade && currentStep === 3) {
      // If upgrading and on payment step, go back to listings
      navigate("/host/listings");
    } else if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError("");
    }
  };

  const handlePlanSelect = (plan) => {
    setFormData(prev => ({ ...prev, plan }));
    setError("");
  };

  const handlePaymentSuccess = async (details) => {
    try {
      setLoading(true);
      const isWalletPayment = details.id && details.id.startsWith("wallet_");
      
      // Update user document with subscription info
      const updateData = {
        subscriptionPlan: formData.plan.id,
        subscriptionStatus: "active",
        subscriptionStartDate: new Date().toISOString(),
      };
      
      // Only add PayPal order ID if it's a PayPal payment
      if (!isWalletPayment && details.id) {
        updateData.paypalOrderId = details.id;
      }
      
      await updateDoc(doc(db, "users", currentUser.uid), updateData);
      
      setSuccess(`Payment successful! Subscription ${isUpgrade ? "upgraded" : "activated"} via ${isWalletPayment ? "E-Wallet" : "PayPal"}.`);
      
      // If upgrading, redirect to listings page after payment
      if (isUpgrade) {
        setTimeout(() => {
          navigate("/host/listings");
        }, 2000);
      } else {
        // If new onboarding, continue to next step
        setTimeout(() => {
          setCurrentStep(4);
          setSuccess("");
        }, 2000);
      }
    } catch (error) {
      console.error("Error processing payment:", error);
      setError("Failed to process payment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError("Please upload an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5MB");
      return;
    }

    try {
      setLoading(true);
      // Here you would upload to Cloudinary or Firebase Storage
      // For now, we'll create a local URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          profilePhoto: file,
          profilePhotoUrl: reader.result
        }));
        setLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error uploading photo:", error);
      setError("Failed to upload photo. Please try again.");
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    try {
      setLoading(true);
      
      // Generate host ID
      const hostId = `H${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      
      // Get current user document to update roles array
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};
      
      // Get existing roles or default to guest
      let roles = [];
      if (userData.roles && Array.isArray(userData.roles)) {
        roles = [...userData.roles];
      } else if (userData.role) {
        // Legacy: convert single role to array
        roles = [userData.role];
      } else {
        roles = ["guest"];
      }
      
      // Add host role if not already present
      if (!roles.includes("host")) {
        roles.push("host");
      }
      
      // Update user document with roles array and host info
      await updateDoc(doc(db, "users", currentUser.uid), {
        roles: roles,
        role: "host", // Keep for backward compatibility
        hostId: hostId,
        hostInfo: {
          fullName: formData.fullName,
          bio: formData.bio,
          hostingExperience: formData.hostingExperience,
          profilePhotoUrl: formData.profilePhotoUrl
        },
        paypalEmail: formData.paypalEmail,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString()
      });

      // Update active role to host
      setUserRole("host");
      
      setSuccess("Onboarding completed! You are now a host.");
      setCurrentStep(7); // Show success screen
    } catch (error) {
      console.error("Error completing onboarding:", error);
      setError("Failed to complete onboarding. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const progressPercentage = Math.round((currentStep / TOTAL_STEPS) * 100);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="text-[#1C1C1E] font-light">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <Header />
      
      {/* Progress Bar - Only show for steps 1-6, hide on success screen */}
      {currentStep <= TOTAL_STEPS && (
        <div className="bg-white border-b border-gray-200 sticky top-14 z-40">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-light text-[#8E8E93]">
                Step {currentStep} of {TOTAL_STEPS}
              </span>
              <button
                onClick={() => navigate("/")}
                className="text-sm font-light text-[#8E8E93] hover:text-[#1C1C1E] transition-colors"
              >
                Exit
              </button>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-[#0071E3] h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
            <div className="text-right mt-2">
              <span className="text-sm font-light text-[#0071E3]">
                {progressPercentage}% Complete
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        {/* Success Notification */}
        {success && (
          <div 
            className="mb-6 bg-[#34C759] text-white px-4 py-3 rounded-xl flex items-center justify-between animate-slideDownFadeIn"
            style={{ animation: 'slideDownFadeIn 0.3s ease-out' }}
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-medium">{success}</span>
            </div>
            <button
              onClick={() => setSuccess("")}
              className="text-white/80 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div 
            className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between animate-slideDownFadeIn"
            style={{ animation: 'slideDownFadeIn 0.3s ease-out' }}
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium">{error}</span>
            </div>
            <button
              onClick={() => setError("")}
              className="text-red-600/80 hover:text-red-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Step Content */}
        {currentStep === 7 ? (
          <SuccessStep formData={formData} onContinue={() => navigate("/host/listings")} />
        ) : (
          <>
            <div className="bg-white rounded-3xl shadow-lg p-6 sm:p-8 lg:p-12 animate-fadeInUp">
              {currentStep === 1 && (
                <WelcomeStep 
                  formData={formData} 
                  setShowPolicyModal={setShowPolicyModal}
                  policyAcknowledged={policyAcknowledged}
                />
              )}
              {currentStep === 2 && <PlanSelectionStep formData={formData} onPlanSelect={handlePlanSelect} />}
              {currentStep === 3 && (
                <PaymentStep 
                  formData={formData} 
                  onPaymentSuccess={handlePaymentSuccess}
                  loading={loading}
                  isUpgrade={isUpgrade}
                />
              )}
              {currentStep === 4 && (
                <ProfilePhotoStep 
                  formData={formData} 
                  onPhotoUpload={handlePhotoUpload}
                  loading={loading}
                />
              )}
              {currentStep === 5 && (
                <HostInfoStep 
                  formData={formData} 
                  setFormData={setFormData}
                />
              )}
              {currentStep === 6 && (
                <ProfilePreviewStep 
                  formData={formData} 
                  setFormData={setFormData}
                  currentUser={currentUser}
                />
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-8">
              <button
                onClick={handleBack}
                disabled={currentStep === 1 || loading}
                className="px-6 py-3 bg-white border border-gray-300 text-[#1C1C1E] rounded-xl text-sm sm:text-base font-light hover:bg-gray-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Back
              </button>
              {currentStep !== 3 && currentStep !== 6 && (
                <button
                  onClick={handleNext}
                  disabled={loading || (currentStep === 1 && !formData.policyRead)}
                  className="px-8 py-3 bg-[#0071E3] text-white rounded-xl text-sm sm:text-base font-medium hover:bg-[#0051D0] transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              )}
              {currentStep === 6 && (
                <button
                  onClick={handleFinish}
                  disabled={loading || !formData.agreeToTerms}
                  className="px-8 py-3 bg-[#0071E3] text-white rounded-xl text-sm sm:text-base font-medium hover:bg-[#0051D0] transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Processing..." : "Finish Onboarding"}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Policy Modal */}
      {showPolicyModal && (
        <PolicyModal 
          onClose={() => {
            if (policyAcknowledged) {
              setShowPolicyModal(false);
            }
          }}
          onAcknowledge={() => {
            setPolicyAcknowledged(true);
            setFormData(prev => ({ ...prev, policyRead: true }));
            setShowPolicyModal(false);
          }}
          acknowledged={policyAcknowledged}
        />
      )}
    </div>
  );
};

// Step 1: Welcome
const WelcomeStep = ({ formData, setShowPolicyModal, policyAcknowledged }) => {
  const { currentUser } = useAuth();
  const userFirstName = currentUser?.displayName?.split(" ")[0] || currentUser?.email?.split("@")[0] || "there";

  return (
    <div className="text-center animate-fadeInUp">
      <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6 sm:mb-8 rounded-2xl bg-[#0071E3]/10 flex items-center justify-center">
        <svg className="w-10 h-10 sm:w-12 sm:h-12 text-[#0071E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      </div>
      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light text-[#1C1C1E] mb-4 sm:mb-6">
        Welcome to Hosting,
      </h2>
      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light text-[#0071E3] mb-6 sm:mb-8">
        {userFirstName}!
      </h2>
      <p className="text-base sm:text-lg text-[#8E8E93] font-light mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed">
        Let's create your professional hosting profile and get you ready to host amazing stays on Voyago.
      </p>
      {policyAcknowledged ? (
        <div className="flex items-center justify-center gap-2 text-green-600 mb-4">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm sm:text-base font-medium">
            Policy and Compliance acknowledged
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm sm:text-base text-[#1C1C1E] font-medium mb-4">
            ⚠️ You must read and acknowledge our Policy and Compliance guidelines before continuing.
          </p>
          <button
            onClick={() => setShowPolicyModal(true)}
            className="px-6 py-3 bg-[#0071E3] text-white rounded-xl text-sm sm:text-base font-medium hover:bg-[#0051D0] transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            Read Policy and Compliance
          </button>
        </div>
      )}
    </div>
  );
};

// Step 2: Plan Selection
const PlanSelectionStep = ({ formData, onPlanSelect }) => {
  const plans = [
    {
      id: "starter",
      name: "Starter",
      price: 29,
      listings: 3,
      duration: "1 year",
      description: "Perfect for new hosts looking to get started",
      bestFor: "New hosts"
    },
    {
      id: "pro",
      name: "Pro",
      price: 79,
      listings: 10,
      duration: "1 year",
      description: "Ideal for growing hosts expanding their presence",
      bestFor: "Growing hosts",
      popular: true
    },
    {
      id: "elite",
      name: "Elite",
      price: 199,
      listings: 1000,
      duration: "1 year",
      description: "Best for businesses and professional hosts",
      bestFor: "Businesses"
    }
  ];

  return (
    <div className="animate-fadeInUp">
      <h2 className="text-3xl sm:text-4xl font-light text-[#1C1C1E] mb-3 sm:mb-4 text-center">
        Choose Your Plan
      </h2>
      <p className="text-base sm:text-lg text-[#8E8E93] font-light mb-8 sm:mb-12 text-center">
        Select the perfect plan for your hosting needs
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {plans.map((plan, index) => (
          <div
            key={plan.id}
            onClick={() => onPlanSelect(plan)}
            className={`relative bg-white border-2 rounded-2xl p-6 sm:p-8 cursor-pointer transition-all duration-300 hover:shadow-xl ${
              formData.plan?.id === plan.id
                ? "border-[#0071E3] shadow-lg scale-105"
                : "border-gray-200 hover:border-[#0071E3]/50"
            } animate-fadeInUp`}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-[#0071E3] text-white px-4 py-1 rounded-full text-xs font-medium">
                Most Popular
              </div>
            )}
            
            {formData.plan?.id === plan.id && (
              <div className="absolute top-4 right-4 w-6 h-6 bg-[#0071E3] rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}

            <h3 className="text-2xl sm:text-3xl font-light text-[#1C1C1E] mb-2">{plan.name}</h3>
            <div className="mb-4 sm:mb-6">
              <span className="text-3xl sm:text-4xl font-light text-[#1C1C1E]">${plan.price}</span>
              <span className="text-base sm:text-lg text-[#8E8E93] font-light"> / year</span>
            </div>
            
            <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-[#0071E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm sm:text-base text-[#1C1C1E] font-light">
                  Listings: {plan.listings === 1000 ? "Unlimited" : plan.listings}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-[#0071E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm sm:text-base text-[#1C1C1E] font-light">
                  Duration: {plan.duration}
                </span>
              </div>
            </div>

            <div className="pt-4 sm:pt-6 border-t border-gray-100">
              <p className="text-xs sm:text-sm text-[#8E8E93] font-light mb-2">Best for:</p>
              <p className="text-sm sm:text-base text-[#1C1C1E] font-medium mb-2">{plan.bestFor}</p>
              <p className="text-xs sm:text-sm text-[#8E8E93] font-light">{plan.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Step 3: Payment
const PaymentStep = ({ formData, onPaymentSuccess, loading, isUpgrade = false }) => {
  const { currentUser } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState("paypal"); // "paypal" or "wallet"
  const [walletBalance, setWalletBalance] = useState(0);
  const [checkingWallet, setCheckingWallet] = useState(true);
  const [processingWallet, setProcessingWallet] = useState(false);

  useEffect(() => {
    if (currentUser) {
      fetchWalletBalance();
    }
  }, [currentUser]);

  const fetchWalletBalance = async () => {
    try {
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setWalletBalance(data.walletBalance || 0);
      }
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
    } finally {
      setCheckingWallet(false);
    }
  };

  const handleWalletPayment = async () => {
    if (walletBalance < formData.plan.price) {
      alert(`Insufficient wallet balance. You have $${walletBalance.toFixed(2)} but need $${formData.plan.price}. Please use PayPal or add funds to your wallet.`);
      return;
    }

    try {
      setProcessingWallet(true);
      const userRef = doc(db, "users", currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const currentBalance = userDoc.data().walletBalance || 0;
        const newBalance = currentBalance - formData.plan.price;
        
        const transaction = {
          type: "subscription_payment",
          amount: formData.plan.price,
          date: new Date().toISOString(),
          status: "completed",
          method: "wallet",
          plan: formData.plan.name,
        };

        const existingTransactions = userDoc.data().transactions || [];
        
        await updateDoc(userRef, {
          walletBalance: newBalance,
          transactions: [transaction, ...existingTransactions].slice(0, 10),
        });

        // Create a mock payment details object similar to PayPal's structure
        const mockPaymentDetails = {
          id: `wallet_${Date.now()}`,
          status: "COMPLETED",
          purchase_units: [{
            amount: {
              value: formData.plan.price.toString(),
              currency_code: "USD"
            }
          }]
        };

        onPaymentSuccess(mockPaymentDetails);
      }
    } catch (error) {
      console.error("Error processing wallet payment:", error);
      alert("Failed to process payment. Please try again.");
      setProcessingWallet(false);
    }
  };

  if (!formData.plan) {
    return (
      <div className="text-center">
        <p className="text-[#8E8E93]">Please go back and select a plan first.</p>
      </div>
    );
  }

  return (
    <div className="animate-fadeInUp">
      <h2 className="text-3xl sm:text-4xl font-light text-[#1C1C1E] mb-3 sm:mb-4 text-center">
        {isUpgrade ? "Upgrade Your Plan" : "Complete Payment"}
      </h2>
      <p className="text-base sm:text-lg text-[#8E8E93] font-light mb-8 sm:mb-12 text-center">
        {isUpgrade 
          ? `Upgrade to the ${formData.plan.name} plan to get more listings`
          : `Pay for your ${formData.plan.name} plan subscription`
        }
      </p>

      <div className="max-w-md mx-auto bg-gray-50 rounded-2xl p-6 sm:p-8">
        <div className="mb-6">
          <h3 className="text-xl font-light text-[#1C1C1E] mb-4">{formData.plan.name} Plan</h3>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[#8E8E93] font-light">Subscription</span>
            <span className="text-lg font-light text-[#1C1C1E]">${formData.plan.price}/year</span>
          </div>
          <div className="border-t border-gray-200 pt-4 mt-4">
            <div className="flex items-center justify-between">
              <span className="text-base font-medium text-[#1C1C1E]">Total</span>
              <span className="text-2xl font-light text-[#1C1C1E]">${formData.plan.price}</span>
            </div>
          </div>
        </div>

        {/* Payment Method Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#1C1C1E] mb-3">
            Select Payment Method
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setPaymentMethod("paypal")}
              className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                paymentMethod === "paypal"
                  ? "border-[#0071E3] bg-[#0071E3]/5"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                <svg className="w-8 h-8 text-[#0071E3]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.174 1.351 1.05 3.3.93 4.855v.08c-.011 1.699-.027 3.4-.04 4.26-.014.86-.024 1.49-.024 1.93 0 .3.168.54.5.65 1.417.48 2.24 1.44 2.24 2.9 0 1.72-1.39 3.12-3.1 3.12h-2.75c-.524 0-.968.382-1.05.9l-1.12 7.38zm8.267-13.99a.477.477 0 0 0-.415.24l-3.15 5.66h2.85c.524 0 .968.382 1.05.9l.9 5.92 2.1-14.72zm-2.85 5.66l-1.5-2.7-1.5 2.7h3z"/>
                </svg>
                <span className="text-sm font-medium text-[#1C1C1E]">PayPal</span>
              </div>
            </button>
            <button
              onClick={() => setPaymentMethod("wallet")}
              className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                paymentMethod === "wallet"
                  ? "border-[#34C759] bg-[#34C759]/5"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                <svg className="w-8 h-8 text-[#34C759]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="text-sm font-medium text-[#1C1C1E]">E-Wallet</span>
              </div>
            </button>
          </div>
        </div>

        {/* Wallet Balance Display */}
        {paymentMethod === "wallet" && (
          <div className="mb-6 p-4 bg-white rounded-xl border border-gray-200">
            {checkingWallet ? (
              <p className="text-sm text-[#8E8E93] font-light">Checking wallet balance...</p>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#8E8E93] font-light">Wallet Balance:</span>
                <span className={`text-lg font-medium ${
                  walletBalance >= formData.plan.price ? "text-[#34C759]" : "text-[#FF3B30]"
                }`}>
                  ${walletBalance.toFixed(2)}
                </span>
              </div>
            )}
            {!checkingWallet && walletBalance < formData.plan.price && (
              <p className="text-xs text-[#FF3B30] font-light mt-2">
                Insufficient balance. You need ${(formData.plan.price - walletBalance).toFixed(2)} more.
              </p>
            )}
          </div>
        )}

        {/* Payment Options */}
        {paymentMethod === "paypal" ? (
          <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency: "USD" }}>
            <PayPalButtons
              createOrder={(data, actions) => {
                return actions.order.create({
                  purchase_units: [
                    {
                      description: `${formData.plan.name} Plan - Annual Subscription`,
                      amount: {
                        currency_code: "USD",
                        value: formData.plan.price.toString(),
                      },
                    },
                  ],
                });
              }}
              onApprove={async (data, actions) => {
                const details = await actions.order.capture();
                onPaymentSuccess(details);
              }}
              onError={(err) => {
                console.error("PayPal error:", err);
              }}
              style={{
                layout: "vertical",
                color: "blue",
                shape: "rect",
                label: "paypal"
              }}
            />
          </PayPalScriptProvider>
        ) : (
          <button
            onClick={handleWalletPayment}
            disabled={processingWallet || checkingWallet || walletBalance < formData.plan.price}
            className={`w-full py-4 rounded-xl text-base font-medium transition-all duration-200 ${
              processingWallet || checkingWallet || walletBalance < formData.plan.price
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-[#34C759] text-white hover:bg-[#30D158] shadow-sm hover:shadow-md"
            }`}
          >
            {processingWallet ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Processing...</span>
              </div>
            ) : checkingWallet ? (
              "Checking Balance..."
            ) : walletBalance < formData.plan.price ? (
              "Insufficient Balance"
            ) : (
              `Pay $${formData.plan.price} with E-Wallet`
            )}
          </button>
        )}
      </div>
    </div>
  );
};

// Step 4: Profile Photo
const ProfilePhotoStep = ({ formData, onPhotoUpload, loading }) => {
  return (
    <div className="animate-fadeInUp">
      <h2 className="text-3xl sm:text-4xl font-light text-[#1C1C1E] mb-3 sm:mb-4 text-center">
        Profile Photo
      </h2>
      <p className="text-base sm:text-lg text-[#8E8E93] font-light mb-8 sm:mb-12 text-center">
        Add a professional photo to build trust with your guests
      </p>

      <div className="max-w-md mx-auto">
        <div className="relative w-48 h-48 sm:w-64 sm:h-64 mx-auto mb-6 sm:mb-8">
          {formData.profilePhotoUrl ? (
            <img
              src={formData.profilePhotoUrl}
              alt="Profile"
              className="w-full h-full rounded-2xl object-cover border-2 border-gray-200"
            />
          ) : (
            <div className="w-full h-full rounded-2xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center bg-gray-50">
              <svg className="w-12 h-12 sm:w-16 sm:h-16 text-[#8E8E93] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-sm text-[#8E8E93] font-light">Add Photo</span>
            </div>
          )}
        </div>

        <label className="block">
          <input
            type="file"
            accept="image/*"
            onChange={onPhotoUpload}
            className="hidden"
            disabled={loading}
          />
          <div className="w-full bg-[#0071E3] text-white rounded-xl py-3 sm:py-4 text-center text-sm sm:text-base font-medium hover:bg-[#0051D0] transition-all duration-200 cursor-pointer shadow-lg hover:shadow-xl">
            {loading ? "Uploading..." : formData.profilePhotoUrl ? "Change Photo" : "Choose Photo"}
          </div>
        </label>
        <p className="text-xs sm:text-sm text-[#8E8E93] font-light text-center mt-3">
          Optional - You can add this later
        </p>
      </div>
    </div>
  );
};

// Step 5: Host Information
const HostInfoStep = ({ formData, setFormData }) => {
  const { currentUser } = useAuth();
  
  useEffect(() => {
    if (!formData.fullName && currentUser) {
      setFormData(prev => ({
        ...prev,
        fullName: currentUser.displayName || currentUser.email?.split("@")[0] || ""
      }));
    }
  }, [currentUser, formData.fullName, setFormData]);

  return (
    <div className="max-w-2xl mx-auto animate-fadeInUp">
      <h2 className="text-3xl sm:text-4xl font-light text-[#1C1C1E] mb-3 sm:mb-4 text-center">
        Host Information
      </h2>
      <p className="text-base sm:text-lg text-[#8E8E93] font-light mb-8 sm:mb-12 text-center">
        Tell us about your hosting experience and background
      </p>

      <div className="space-y-6 sm:space-y-8">
        <div>
          <label className="block text-sm sm:text-base font-medium text-[#1C1C1E] mb-2">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.fullName}
            onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
            className="w-full px-4 py-3 bg-[#F2F2F7] border border-transparent rounded-xl text-sm sm:text-base text-[#1C1C1E] placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:bg-white transition-all"
            placeholder="Enter your full name"
            required
          />
        </div>

        <div>
          <label className="block text-sm sm:text-base font-medium text-[#1C1C1E] mb-2">
            Professional Bio
          </label>
          <textarea
            value={formData.bio}
            onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
            rows={5}
            className="w-full px-4 py-3 bg-[#F2F2F7] border border-transparent rounded-xl text-sm sm:text-base text-[#1C1C1E] placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:bg-white transition-all resize-none"
            placeholder="Describe your hosting style, expertise, and what guests can expect..."
          />
        </div>

        <div>
          <label className="block text-sm sm:text-base font-medium text-[#1C1C1E] mb-2">
            Hosting Experience
          </label>
          <select
            value={formData.hostingExperience}
            onChange={(e) => setFormData(prev => ({ ...prev, hostingExperience: e.target.value }))}
            className="w-full px-4 py-3 bg-[#F2F2F7] border border-transparent rounded-xl text-sm sm:text-base text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:bg-white transition-all"
          >
            <option value="">Select experience level</option>
            <option value="first-time">First-time Host</option>
            <option value="1-2-years">1-2 years</option>
            <option value="3-5-years">3-5 years</option>
            <option value="5-plus-years">5+ years</option>
          </select>
        </div>

        <div>
          <label className="block text-sm sm:text-base font-medium text-[#1C1C1E] mb-2">
            PayPal Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={formData.paypalEmail}
            onChange={(e) => setFormData(prev => ({ ...prev, paypalEmail: e.target.value }))}
            className="w-full px-4 py-3 bg-[#F2F2F7] border border-transparent rounded-xl text-sm sm:text-base text-[#1C1C1E] placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:bg-white transition-all"
            placeholder="Enter your PayPal email"
            required
          />
          <p className="text-xs sm:text-sm text-[#8E8E93] font-light mt-2">
            Make sure this is the same email linked to your PayPal account. It's where Voyago will send your payouts.
          </p>
        </div>
      </div>
    </div>
  );
};

// Step 6: Profile Preview
const ProfilePreviewStep = ({ formData, setFormData, currentUser }) => {
  const [hostId] = useState(() => `H${Math.random().toString(36).substring(2, 10).toUpperCase()}`);

  return (
    <div className="max-w-2xl mx-auto animate-fadeInUp">
      <h2 className="text-3xl sm:text-4xl font-light text-[#1C1C1E] mb-8 sm:mb-12 text-center">
        Profile Preview
      </h2>

      <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 sm:p-8 mb-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-2xl sm:text-3xl font-light text-[#1C1C1E] mb-1">Voyago</h3>
            <p className="text-sm sm:text-base text-[#8E8E93] font-light">Certified Host</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-[#8E8E93] font-light">
            <span>ID: {hostId}</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </div>

        <div className="flex items-start gap-4 sm:gap-6">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-[#0071E3]/10 flex items-center justify-center flex-shrink-0">
            {formData.profilePhotoUrl ? (
              <img
                src={formData.profilePhotoUrl}
                alt="Profile"
                className="w-full h-full rounded-xl object-cover"
              />
            ) : (
              <svg className="w-8 h-8 sm:w-10 sm:h-10 text-[#0071E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <h4 className="text-xl sm:text-2xl font-light text-[#1C1C1E] mb-2">
              {formData.fullName || currentUser?.displayName || "Host"}
            </h4>
            <div className="flex items-center gap-2 mb-3">
              <span className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-medium">
                New Host
              </span>
              <span className="px-3 py-1 bg-[#0071E3]/10 text-[#0071E3] rounded-lg text-xs font-medium">
                {formData.plan?.name || "Starter"} Plan
              </span>
            </div>
            <div className="mt-4">
              <p className="text-xs font-medium text-[#8E8E93] mb-1 uppercase tracking-wide">BIO</p>
              <p className="text-sm sm:text-base text-[#1C1C1E] font-light">
                {formData.bio || "No bio provided"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3 mb-8">
        <input
          type="checkbox"
          id="agreeTerms"
          checked={formData.agreeToTerms}
          onChange={(e) => setFormData(prev => ({ ...prev, agreeToTerms: e.target.checked }))}
          className="mt-1 w-5 h-5 rounded border-gray-300 text-[#0071E3] focus:ring-[#0071E3] focus:ring-2"
        />
        <label htmlFor="agreeTerms" className="text-sm sm:text-base text-[#1C1C1E] font-light">
          I agree to the{" "}
          <button className="text-[#0071E3] hover:text-[#0051D0] underline">
            Hosting Terms and Conditions
          </button>
          {" "}and confirm that all information provided is accurate and true.
        </label>
      </div>
    </div>
  );
};

// Success Step
const SuccessStep = ({ formData, onContinue }) => {
  return (
    <div className="bg-white rounded-3xl shadow-lg p-6 sm:p-8 lg:p-12 animate-fadeInUp text-center">
      <div className="max-w-md mx-auto">
        <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6 sm:mb-8 rounded-full bg-[#34C759]/10 flex items-center justify-center">
          <svg className="w-10 h-10 sm:w-12 sm:h-12 text-[#34C759]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light text-[#1C1C1E] mb-4 sm:mb-6">
          Congrats!
        </h2>
        <p className="text-base sm:text-lg text-[#8E8E93] font-light mb-6 sm:mb-8 leading-relaxed">
          You're officially a host on Voyago. Create your first listing and start hosting amazing stays!
        </p>
        <p className="text-sm sm:text-base text-[#0071E3] font-light mb-8 sm:mb-10">
          You're subscribed to the {formData.plan?.name || "Starter"} plan
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={onContinue}
            className="px-8 py-3 bg-[#0071E3] text-white rounded-xl text-sm sm:text-base font-medium hover:bg-[#0051D0] transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            Create First Listing
          </button>
          <button
            onClick={() => window.location.href = "/"}
            className="px-8 py-3 bg-white border border-gray-300 text-[#1C1C1E] rounded-xl text-sm sm:text-base font-light hover:bg-gray-50 transition-all duration-200"
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  );
};

// Policy Modal
const PolicyModal = ({ onClose, onAcknowledge, acknowledged }) => {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [agreeChecked, setAgreeChecked] = useState(false);
  const scrollContainerRef = useRef(null);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (container) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // Check if user has scrolled to within 50px of the bottom
      if (scrollHeight - scrollTop - clientHeight < 50) {
        setHasScrolledToBottom(true);
      }
    }
  };

  const handleAcknowledge = () => {
    if (agreeChecked && hasScrolledToBottom) {
      onAcknowledge();
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={() => {
          // Don't allow closing by clicking outside if not acknowledged
          if (acknowledged) {
            onClose();
          }
        }}
        style={{ animation: 'fadeIn 0.3s ease-out' }}
      ></div>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div 
          className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden animate-slideDownFadeIn"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 sm:p-8 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-xl sm:text-2xl font-light text-[#1C1C1E]">Voyago Policy & Compliance Guidelines</h3>
            {acknowledged && (
              <button
                onClick={onClose}
                className="text-[#8E8E93] hover:text-[#1C1C1E] transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="p-6 sm:p-8 overflow-y-auto max-h-[calc(90vh-200px)]"
          >
            <div className="space-y-6 text-sm sm:text-base text-[#1C1C1E] font-light leading-relaxed">
              <section>
                <h4 className="text-lg font-medium text-[#1C1C1E] mb-3">Introduction</h4>
                <p className="text-[#8E8E93]">
                  Welcome to Voyago, a peer-to-peer accommodation booking platform connecting guests with verified hosts offering unique stays and experiences. By using Voyago, you agree to comply with these policies, which are designed to ensure a safe, fair, and transparent environment for all users.
                </p>
              </section>

              <section>
                <h4 className="text-lg font-medium text-[#1C1C1E] mb-3">General Platform Rules</h4>
                <ul className="list-disc list-inside space-y-2 text-[#8E8E93] ml-4">
                  <li>All users must provide accurate and up-to-date information in their profiles and listings.</li>
                  <li>Any attempt to mislead, defraud, or manipulate the platform or its users will result in immediate account suspension.</li>
                  <li>Voyago reserves the right to review, remove, or suspend any listing or booking that violates these policies.</li>
                  <li>All communication and transactions must occur within the Voyago platform for security and tracking purposes.</li>
                </ul>
              </section>

              <section>
                <h4 className="text-lg font-medium text-[#1C1C1E] mb-3">Booking & Payment Policy</h4>
                <p className="text-[#8E8E93]">
                  Guests must complete full payment through Voyago's secure payment system before a booking is confirmed. The host will receive their payout 24 hours after the check-in date, once the booking is verified as completed. Payments are held temporarily by Voyago to ensure proper transaction processing and compliance.
                </p>
              </section>

              <section>
                <h4 className="text-lg font-medium text-[#1C1C1E] mb-3">Cancellation & Refund Policy</h4>
                <p className="text-[#8E8E93]">
                  Cancellation policies vary by listing and are clearly displayed before booking. Guests may cancel according to the host's cancellation policy. Refunds will be processed according to the policy terms. Hosts who cancel confirmed bookings may face penalties and account restrictions.
                </p>
              </section>

              <section>
                <h4 className="text-lg font-medium text-[#1C1C1E] mb-3">Host Responsibilities</h4>
                <p className="text-[#8E8E93]">
                  Hosts are responsible for maintaining accurate listing information, providing clean and safe accommodations, responding to guest inquiries promptly, and honoring confirmed bookings. Hosts must comply with all local laws and regulations regarding short-term rentals.
                </p>
              </section>

              <section>
                <h4 className="text-lg font-medium text-[#1C1C1E] mb-3">Code of Conduct</h4>
                <p className="text-[#8E8E93]">
                  All hosts must maintain professional conduct, treat guests with respect, and provide accurate descriptions of their properties. Discrimination of any kind is strictly prohibited. Hosts must respond to booking requests and messages in a timely manner.
                </p>
              </section>

              <section>
                <h4 className="text-lg font-medium text-[#1C1C1E] mb-3">Privacy & Data Protection</h4>
                <p className="text-[#8E8E93]">
                  Voyago is committed to protecting user privacy. All personal information is handled according to our Privacy Policy. Hosts must respect guest privacy and not share guest information with third parties without consent.
                </p>
              </section>
            </div>
          </div>
          <div className="p-6 sm:p-8 border-t border-gray-200 space-y-4">
            {!hasScrolledToBottom && (
              <p className="text-sm text-amber-600 text-center">
                ⚠️ Please scroll to the bottom to read the complete policy
              </p>
            )}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="agreePolicy"
                checked={agreeChecked}
                onChange={(e) => setAgreeChecked(e.target.checked)}
                disabled={!hasScrolledToBottom}
                className="mt-1 w-5 h-5 rounded border-gray-300 text-[#0071E3] focus:ring-[#0071E3] focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <label 
                htmlFor="agreePolicy" 
                className={`text-sm sm:text-base text-[#1C1C1E] font-light ${!hasScrolledToBottom ? 'opacity-50' : ''}`}
              >
                I have read and understood the Voyago Policy & Compliance Guidelines. I agree to comply with all policies and terms outlined above.
              </label>
            </div>
            <button
              onClick={handleAcknowledge}
              disabled={!agreeChecked || !hasScrolledToBottom}
              className="w-full bg-[#0071E3] text-white rounded-xl py-3 sm:py-4 text-sm sm:text-base font-medium hover:bg-[#0051D0] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              I Acknowledge and Agree
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default HostOnboarding;

