import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

const GuestProfileModal = ({ isOpen, onClose, guestId, guestData }) => {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    if (isOpen && guestId) {
      fetchGuestData();
    }
  }, [isOpen, guestId]);

  const fetchGuestData = async () => {
    try {
      setLoading(true);
      const userDoc = await getDoc(doc(db, "users", guestId));
      if (userDoc.exists()) {
        setUserData(userDoc.data());
      } else {
        // Use guestData from booking if available
        setUserData(guestData || null);
      }
    } catch (error) {
      console.error("Error fetching guest data:", error);
      setUserData(guestData || null);
    } finally {
      setLoading(false);
    }
  };

  const getDisplayName = () => {
    if (userData?.displayName) return userData.displayName;
    if (userData?.firstName && userData?.lastName) {
      return `${userData.firstName} ${userData.lastName}`;
    }
    if (userData?.name) return userData.name;
    if (guestData?.guestName) return guestData.guestName;
    if (userData?.email) return userData.email.split('@')[0];
    if (guestData?.guestEmail) return guestData.guestEmail.split('@')[0];
    return 'Guest';
  };

  const getPhotoUrl = () => {
    return userData?.photoURL || 
           userData?.profilePhotoUrl || 
           guestData?.guestPhotoUrl || 
           null;
  };

  const displayName = getDisplayName();
  const photoUrl = getPhotoUrl();
  const userInitials = photoUrl 
    ? '' 
    : displayName[0].toUpperCase() + (displayName[1]?.toUpperCase() || '');

  const email = userData?.email || guestData?.guestEmail || 'Not provided';
  const phone = userData?.phoneNumber || userData?.phone || 'Not provided';

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={onClose}></div>
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-slideDownFadeIn">
        {/* Header */}
        <div className="flex items-center justify-between p-6 sm:p-8 border-b border-gray-200 bg-gradient-to-r from-white to-gray-50 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#0071E3] rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-light text-[#1C1C1E] mb-1">Guest Profile</h2>
              <p className="text-sm text-[#8E8E93] font-light">View guest information</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#8E8E93] hover:bg-gray-100 rounded-lg transition-colors duration-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-10 h-10 border-4 border-[#0071E3] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Profile Photo */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-[#0071E3] to-[#0051D0] flex items-center justify-center text-white text-3xl sm:text-4xl font-semibold shadow-xl overflow-hidden ring-4 ring-white/50">
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={displayName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          const fallback = e.target.nextElementSibling;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div style={{ display: photoUrl ? 'none' : 'flex' }}>
                      {userInitials}
                    </div>
                  </div>
                </div>
                <h3 className="text-xl sm:text-2xl font-light text-[#1C1C1E]">
                  {displayName}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-[#0071E3]/10 text-[#0071E3] rounded-lg text-xs font-medium">
                    Guest
                  </span>
                </div>
              </div>

              {/* Name */}
              <div className="bg-gray-50 rounded-xl p-4 sm:p-5">
                <label className="block text-sm font-medium text-[#1C1C1E] mb-2">
                  Full Name
                </label>
                <p className="text-base sm:text-lg text-[#1C1C1E] font-light">
                  {displayName || "Not provided"}
                </p>
              </div>

              {/* Email */}
              <div className="bg-gray-50 rounded-xl p-4 sm:p-5">
                <label className="block text-sm font-medium text-[#1C1C1E] mb-2">
                  Email
                </label>
                <p className="text-base text-[#1C1C1E] font-light">
                  {email}
                </p>
              </div>

              {/* Phone */}
              <div className="bg-gray-50 rounded-xl p-4 sm:p-5">
                <label className="block text-sm font-medium text-[#1C1C1E] mb-2">
                  Phone Number
                </label>
                <p className="text-base text-[#1C1C1E] font-light">
                  {phone || "Not provided"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default GuestProfileModal;

