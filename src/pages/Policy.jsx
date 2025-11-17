import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import Header from "../components/Header";

const Policy = () => {
  const [policySections, setPolicySections] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const sectionTitles = {
    introduction: "Introduction",
    generalPlatformRules: "General Platform Rules",
    bookingPaymentPolicy: "Booking & Payment Policy",
    cancellationRefundPolicy: "Cancellation & Refund Policy",
    hostResponsibilities: "Host Responsibilities",
    codeOfConduct: "Code of Conduct",
    privacyDataProtection: "Privacy & Data Protection"
  };

  const sectionOrder = [
    "introduction",
    "generalPlatformRules",
    "bookingPaymentPolicy",
    "cancellationRefundPolicy",
    "hostResponsibilities",
    "codeOfConduct",
    "privacyDataProtection"
  ];

  useEffect(() => {
    fetchPolicyContent();
  }, []);

  const fetchPolicyContent = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch policy from Firestore
      const policyDoc = await getDoc(doc(db, "adminSettings", "policyContent"));
      
      if (policyDoc.exists()) {
        const data = policyDoc.data();
        // Check if it's the new structure (sections) or old structure (single content)
        if (data.sections) {
          setPolicySections(data.sections);
        } else if (data.content) {
          // Migrate old format to new format for display
          const content = data.content;
          const sections = {
            introduction: content.split("## General Platform Rules")[0]?.trim() || "",
            generalPlatformRules: content.split("## General Platform Rules")[1]?.split("## Booking & Payment Policy")[0]?.trim() || "",
            bookingPaymentPolicy: content.split("## Booking & Payment Policy")[1]?.split("## Cancellation & Refund Policy")[0]?.trim() || "",
            cancellationRefundPolicy: content.split("## Cancellation & Refund Policy")[1]?.split("## Host Responsibilities")[0]?.trim() || "",
            hostResponsibilities: content.split("## Host Responsibilities")[1]?.split("## Code of Conduct")[0]?.trim() || "",
            codeOfConduct: content.split("## Code of Conduct")[1]?.split("## Privacy & Data Protection")[0]?.trim() || "",
            privacyDataProtection: content.split("## Privacy & Data Protection")[1]?.trim() || ""
          };
          setPolicySections(sections);
        } else {
          setPolicySections(getDefaultSections());
        }
      } else {
        setPolicySections(getDefaultSections());
      }
    } catch (error) {
      console.error("Error fetching policy content:", error);
      setError("Failed to load policy content. Please try again later.");
      setPolicySections(getDefaultSections());
    } finally {
      setLoading(false);
    }
  };

  const getDefaultSections = () => {
    return {
      introduction: "Welcome to Voyago, a peer-to-peer accommodation booking platform connecting guests with verified hosts offering unique stays and experiences. By using Voyago, you agree to comply with these policies, which are designed to ensure a safe, fair, and transparent environment for all users.",
      generalPlatformRules: "All users must provide accurate and up-to-date information in their profiles and listings. Any attempt to mislead, defraud, or manipulate the platform or its users will result in immediate account suspension. Voyago reserves the right to review, remove, or suspend any listing or booking that violates these policies. All communication and transactions must occur within the Voyago platform for security and tracking purposes.",
      bookingPaymentPolicy: "Guests must complete full payment through Voyago's secure payment system before a booking is confirmed. The host will receive their payout 24 hours after the check-in date, once the booking is verified as completed. Payments are held temporarily by Voyago to ensure proper transaction processing and compliance.",
      cancellationRefundPolicy: "Cancellation policies vary by listing and are clearly displayed before booking. Guests may cancel according to the host's cancellation policy. Refunds will be processed according to the policy terms. Hosts who cancel confirmed bookings may face penalties and account restrictions.",
      hostResponsibilities: "Hosts are responsible for maintaining accurate listing information, providing clean and safe accommodations, responding to guest inquiries promptly, and honoring confirmed bookings. Hosts must comply with all local laws and regulations regarding short-term rentals.",
      codeOfConduct: "All hosts must maintain professional conduct, treat guests with respect, and provide accurate descriptions of their properties. Discrimination of any kind is strictly prohibited. Hosts must respond to booking requests and messages in a timely manner.",
      privacyDataProtection: "Voyago is committed to protecting user privacy. All personal information is handled according to our Privacy Policy. Hosts must respect guest privacy and not share guest information with third parties without consent."
    };
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 md:p-10">
          <div className="mb-6 sm:mb-8">
            <Link
              to="/"
              className="flex items-center gap-2 text-[#8E8E93] hover:text-[#1C1C1E] transition-colors mb-4 sm:mb-6 text-sm sm:text-base font-light"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Link>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-light text-[#1C1C1E] mb-2 sm:mb-3">
              Voyago Policy & Compliance Guidelines
            </h1>
            <p className="text-sm sm:text-base text-[#8E8E93] font-light">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#0071E3]"></div>
              <p className="mt-4 text-[#8E8E93] font-light">Loading policy content...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 sm:p-6">
              <p className="text-red-600 font-light">{error}</p>
            </div>
          ) : policySections ? (
            <div className="space-y-8">
              {sectionOrder.map((sectionKey) => {
                const content = policySections[sectionKey];
                if (!content || content.trim() === "") return null;
                
                return (
                  <div key={sectionKey} className="border-b border-gray-200 pb-6 last:border-b-0">
                    <h2 className="text-xl sm:text-2xl font-medium text-[#1C1C1E] mb-4">
                      {sectionTitles[sectionKey]}
                    </h2>
                    <div 
                      className="text-sm sm:text-base text-[#8E8E93] font-light leading-relaxed whitespace-pre-wrap"
                      style={{ wordWrap: 'break-word' }}
                    >
                      {content}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Policy;

