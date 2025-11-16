import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../contexts/AuthContext";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { updateProfile } from "firebase/auth";
import { cloudinaryConfig, CLOUDINARY_UPLOAD_URL } from "../config/cloudinary";

const ProfileModal = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedFirstName, setEditedFirstName] = useState("");
  const [editedLastName, setEditedLastName] = useState("");
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [editedPhone, setEditedPhone] = useState("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen && currentUser) {
      fetchUserData();
    }
  }, [isOpen, currentUser]);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserData(data);
        setEditedFirstName(data.firstName || "");
        setEditedLastName(data.lastName || "");
        setEditedPhone(data.phoneNumber || data.phone || '');
        setProfilePhotoUrl(data.photoURL || data.profilePhotoUrl || currentUser.photoURL || null);
      } else {
        setEditedFirstName("");
        setEditedLastName("");
        setEditedPhone('');
        setProfilePhotoUrl(currentUser.photoURL || null);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveName = async () => {
    const firstName = editedFirstName.trim();
    const lastName = editedLastName.trim();
    
    if (!firstName || !lastName) {
      alert("Please provide both first and last name");
      return;
    }

    try {
      const finalDisplayName = `${firstName} ${lastName}`;

      await updateProfile(auth.currentUser, {
        displayName: finalDisplayName
      });

      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        displayName: finalDisplayName,
        name: finalDisplayName,
        firstName: firstName,
        lastName: lastName,
        updatedAt: new Date().toISOString()
      });

      setIsEditingName(false);
      await fetchUserData();
    } catch (error) {
      console.error("Error updating name:", error);
      alert("Failed to update name. Please try again.");
    }
  };

  const handleSavePhone = async () => {
    const phoneNumber = editedPhone.trim();

    try {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        phoneNumber: phoneNumber || null,
        phone: phoneNumber || null,
        updatedAt: new Date().toISOString()
      });

      setIsEditingPhone(false);
      await fetchUserData();
    } catch (error) {
      console.error("Error updating phone number:", error);
      alert("Failed to update phone number. Please try again.");
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Image size must be less than 5MB");
      return;
    }

    try {
      setIsUploadingPhoto(true);

      const formDataUpload = new FormData();
      formDataUpload.append("file", file);
      formDataUpload.append("upload_preset", cloudinaryConfig.uploadPreset);
      formDataUpload.append("folder", `voyago/profiles/${currentUser.uid}`);

      const response = await fetch(CLOUDINARY_UPLOAD_URL, {
        method: "POST",
        body: formDataUpload,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      const photoUrl = data.secure_url;

      await updateProfile(auth.currentUser, {
        photoURL: photoUrl
      });

      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        photoURL: photoUrl,
        profilePhotoUrl: photoUrl,
        updatedAt: new Date().toISOString()
      });

      setProfilePhotoUrl(photoUrl);
      await fetchUserData();

      alert("Profile picture updated successfully!");
    } catch (error) {
      console.error("Error uploading photo:", error);
      alert("Failed to upload photo. Please try again.");
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getDisplayName = () => {
    if (userData?.displayName) return userData.displayName;
    if (userData?.firstName && userData?.lastName) {
      return `${userData.firstName} ${userData.lastName}`;
    }
    if (userData?.name) return userData.name;
    if (currentUser?.displayName) return currentUser.displayName;
    if (currentUser?.email) return currentUser.email.split('@')[0];
    return 'User';
  };

  const displayName = getDisplayName();
  const userInitials = profilePhotoUrl 
    ? '' 
    : displayName[0].toUpperCase() + (displayName[1]?.toUpperCase() || '');

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
              <h2 className="text-2xl sm:text-3xl font-light text-[#1C1C1E] mb-1">My Profile</h2>
              <p className="text-sm text-[#8E8E93] font-light">Manage your profile information</p>
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
                    {profilePhotoUrl ? (
                      <img
                        src={profilePhotoUrl}
                        alt={displayName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          const fallback = e.target.nextElementSibling;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div style={{ display: profilePhotoUrl ? 'none' : 'flex' }}>
                      {userInitials}
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                    className="absolute -bottom-2 -right-2 p-2 bg-[#0071E3] text-white rounded-full shadow-lg hover:bg-[#0051D0] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Change photo"
                  >
                    {isUploadingPhoto ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-sm text-[#8E8E93] font-light text-center">
                  {isUploadingPhoto ? "Uploading..." : "Click the icon to change your photo"}
                </p>
              </div>

              {/* Name */}
              <div className="bg-gray-50 rounded-xl p-4 sm:p-5">
                <label className="block text-sm font-medium text-[#1C1C1E] mb-3">
                  Full Name
                </label>
                {isEditingName ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={editedFirstName}
                        onChange={(e) => setEditedFirstName(e.target.value)}
                        placeholder="First name"
                        className="px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] bg-white text-[#1C1C1E] font-light"
                      />
                      <input
                        type="text"
                        value={editedLastName}
                        onChange={(e) => setEditedLastName(e.target.value)}
                        placeholder="Last name"
                        className="px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] bg-white text-[#1C1C1E] font-light"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveName}
                        className="px-4 py-2 bg-[#0071E3] text-white rounded-xl text-sm font-medium hover:bg-[#0051D0] transition-all"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingName(false);
                          setEditedFirstName(userData?.firstName || "");
                          setEditedLastName(userData?.lastName || "");
                        }}
                        className="px-4 py-2 bg-gray-100 text-[#1C1C1E] rounded-xl text-sm font-medium hover:bg-gray-200 transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-base sm:text-lg text-[#1C1C1E] font-light">
                      {displayName || "Not set"}
                    </p>
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="p-2 text-[#8E8E93] hover:text-[#0071E3] hover:bg-[#0071E3]/10 rounded-lg transition-all"
                      title="Edit name"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Email */}
              <div className="bg-gray-50 rounded-xl p-4 sm:p-5">
                <label className="block text-sm font-medium text-[#1C1C1E] mb-2">
                  Email
                </label>
                <p className="text-base text-[#1C1C1E] font-light">
                  {currentUser?.email || "Not provided"}
                </p>
                <p className="text-xs text-[#8E8E93] font-light mt-1">
                  Email cannot be changed
                </p>
              </div>

              {/* Phone */}
              <div className="bg-gray-50 rounded-xl p-4 sm:p-5">
                <label className="block text-sm font-medium text-[#1C1C1E] mb-3">
                  Phone Number
                </label>
                {isEditingPhone ? (
                  <div className="space-y-3">
                    <input
                      type="tel"
                      value={editedPhone}
                      onChange={(e) => setEditedPhone(e.target.value)}
                      placeholder="Enter mobile number"
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] bg-white text-[#1C1C1E] font-light"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSavePhone}
                        className="px-4 py-2 bg-[#0071E3] text-white rounded-xl text-sm font-medium hover:bg-[#0051D0] transition-all"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingPhone(false);
                          setEditedPhone(userData?.phoneNumber || userData?.phone || '');
                        }}
                        className="px-4 py-2 bg-gray-100 text-[#1C1C1E] rounded-xl text-sm font-medium hover:bg-gray-200 transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-base text-[#1C1C1E] font-light">
                      {editedPhone || "Not provided"}
                    </p>
                    <button
                      onClick={() => setIsEditingPhone(true)}
                      className="p-2 text-[#8E8E93] hover:text-[#0071E3] hover:bg-[#0071E3]/10 rounded-lg transition-all"
                      title="Edit phone number"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ProfileModal;

