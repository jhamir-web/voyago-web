import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { doc, getDoc, collection, query, where, getDocs, updateDoc, addDoc, orderBy } from "firebase/firestore";
import { db, auth } from "../firebase";
import { updateProfile } from "firebase/auth";
import { cloudinaryConfig, CLOUDINARY_UPLOAD_URL } from "../config/cloudinary";
import Header from "../components/Header";

const Profile = () => {
  const { currentUser, userRole, userRoles, setUserRole } = useAuth();
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [bookings, setBookings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({
    totalBookings: 0,
    completedTrips: 0,
    reviewsGiven: 0,
    avgRatingGiven: 0
  });
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [editedFirstName, setEditedFirstName] = useState("");
  const [editedLastName, setEditedLastName] = useState("");
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [editedPhone, setEditedPhone] = useState("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(null);
  const fileInputRef = useRef(null);
  const [wishlistRequests, setWishlistRequests] = useState([]);

  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch user data
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData(data);
          // Set display name (full name)
          const displayName = data.displayName || currentUser.displayName || currentUser.email?.split('@')[0] || 'User';
          setEditedName(displayName);
          // Set first and last name separately
          setEditedFirstName(data.firstName || "");
          setEditedLastName(data.lastName || "");
          setEditedPhone(data.phoneNumber || data.phone || '');
          setProfilePhotoUrl(data.photoURL || data.profilePhotoUrl || currentUser.photoURL || null);
        } else {
          const displayName = currentUser.displayName || currentUser.email?.split('@')[0] || 'User';
          setEditedName(displayName);
          setEditedFirstName("");
          setEditedLastName("");
          setEditedPhone('');
          setProfilePhotoUrl(currentUser.photoURL || null);
        }

        // Fetch bookings
        const bookingsQuery = query(
          collection(db, "bookings"),
          where("guestId", "==", currentUser.uid)
        );
        const bookingsSnapshot = await getDocs(bookingsQuery);
        const bookingsData = bookingsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        bookingsData.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return dateB - dateA;
        });
        setBookings(bookingsData);

        // Fetch reviews
        const reviewsQuery = query(
          collection(db, "reviews"),
          where("userId", "==", currentUser.uid)
        );
        const reviewsSnapshot = await getDocs(reviewsQuery);
        const reviewsData = reviewsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        reviewsData.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return dateB - dateA;
        });
        setReviews(reviewsData);

        // Calculate statistics
        const completedTrips = bookingsData.filter(b => 
          b.status === "completed" || (new Date(b.checkOut) < new Date() && b.status === "confirmed")
        ).length;
        
        const avgRating = reviewsData.length > 0
          ? reviewsData.reduce((sum, r) => sum + (r.rating || 0), 0) / reviewsData.length
          : 0;

        setStats({
          totalBookings: bookingsData.length,
          completedTrips,
          reviewsGiven: reviewsData.length,
          avgRatingGiven: avgRating
        });

        // Fetch wishlist requests
        const requestsQuery = query(
          collection(db, "wishlistRequests"),
          where("guestId", "==", currentUser.uid),
          orderBy("createdAt", "desc")
        );
        const requestsSnapshot = await getDocs(requestsQuery);
        const requestsData = requestsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setWishlistRequests(requestsData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser, navigate]);

  const formatDate = (dateString) => {
    if (!dateString) return 'Not provided';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="text-[#1C1C1E] font-light">Loading...</div>
      </div>
    );
  }

  const handleSaveName = async () => {
    // Validate that both first and last name are provided
    const firstName = editedFirstName.trim();
    const lastName = editedLastName.trim();
    
    if (!firstName || !lastName) {
      alert("Please provide both first and last name");
      return;
    }

    try {
      // Combine first and last name for display name
      const finalDisplayName = `${firstName} ${lastName}`;
      const finalName = finalDisplayName;

      // Update Firebase Auth profile with display name
      await updateProfile(auth.currentUser, {
        displayName: finalDisplayName
      });

      // Update Firestore user document with all name fields
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        displayName: finalDisplayName,
        name: finalName,
        firstName: firstName,
        lastName: lastName,
        updatedAt: new Date().toISOString()
      });

      setIsEditingName(false);
      // Refresh user data
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const updatedData = userDoc.data();
        setUserData(updatedData);
        // Update local state with the saved values
        setEditedName(finalDisplayName);
        setEditedFirstName(firstName);
        setEditedLastName(lastName);
      }
    } catch (error) {
      console.error("Error updating name:", error);
      alert("Failed to update name. Please try again.");
    }
  };

  const handleSavePhone = async () => {
    // Phone number is optional, so we allow empty
    const phoneNumber = editedPhone.trim();

    try {
      // Update Firestore user document
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        phoneNumber: phoneNumber || null,
        phone: phoneNumber || null, // Also update 'phone' field for compatibility
        updatedAt: new Date().toISOString()
      });

      setIsEditingPhone(false);
      // Refresh user data
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        setUserData(userDoc.data());
      }
    } catch (error) {
      console.error("Error updating phone number:", error);
      alert("Failed to update phone number. Please try again.");
    }
  };


  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert("Please upload an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image size must be less than 5MB");
      return;
    }

    try {
      setIsUploadingPhoto(true);

      // Upload to Cloudinary
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

      // Update Firebase Auth profile
      await updateProfile(auth.currentUser, {
        photoURL: photoUrl
      });

      // Update Firestore user document
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        photoURL: photoUrl,
        profilePhotoUrl: photoUrl,
        updatedAt: new Date().toISOString()
      });

      setProfilePhotoUrl(photoUrl);
      
      // Refresh user data
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        setUserData(userDoc.data());
      }

      alert("Profile picture updated successfully!");
    } catch (error) {
      console.error("Error uploading photo:", error);
      alert("Failed to upload photo. Please try again.");
    } finally {
      setIsUploadingPhoto(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Get the display name - prioritize Firestore displayName, then combine firstName + lastName, then fallback
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
  const userName = displayName;
  const userEmail = currentUser?.email || '';
  const createdAt = userData?.createdAt || currentUser?.metadata?.creationTime || '';

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <Header />

      {/* Main Content - Centered */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12 profile-container bg-gradient-to-br from-[#F5F5F7] via-white to-[#F5F5F7]">
        <div className="max-w-6xl mx-auto">

          {/* Profile Header Card */}
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl p-6 sm:p-8 lg:p-10 mb-8 sm:mb-10 animate-fadeInUp border border-gray-100 overflow-hidden relative">
            {/* Gradient Background */}
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-[#0071E3]/10 via-[#0071E3]/5 to-transparent"></div>
            
            <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-8">
              {/* Avatar with Upload */}
              <div className="relative flex-shrink-0">
                <div className="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#0071E3] to-[#0051D0] flex items-center justify-center text-white text-3xl sm:text-4xl lg:text-5xl font-semibold shadow-2xl overflow-hidden ring-4 ring-white/50">
                  {profilePhotoUrl ? (
                    <img
                      src={profilePhotoUrl}
                      alt={userName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        const fallback = e.target.nextElementSibling;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  {!profilePhotoUrl && (
                    <span>{userInitials}</span>
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                  className="absolute bottom-0 right-0 w-10 h-10 sm:w-12 sm:h-12 bg-white text-[#0071E3] rounded-full flex items-center justify-center shadow-xl hover:shadow-2xl hover:scale-110 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ring-2 ring-white"
                  title="Change profile picture"
                >
                  {isUploadingPhoto ? (
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>
              
              {/* User Info */}
              <div className="flex-1 w-full">
                {isEditingName ? (
                  <div className="space-y-4 mb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-[#8E8E93] mb-1.5">
                          First Name
                        </label>
                        <input
                          type="text"
                          value={editedFirstName}
                          onChange={(e) => setEditedFirstName(e.target.value)}
                          placeholder="First Name"
                          className="w-full text-base sm:text-lg font-medium text-[#1C1C1E] border-2 border-[#0071E3] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-[#8E8E93] mb-1.5">
                          Last Name
                        </label>
                        <input
                          type="text"
                          value={editedLastName}
                          onChange={(e) => setEditedLastName(e.target.value)}
                          placeholder="Last Name"
                          className="w-full text-base sm:text-lg font-medium text-[#1C1C1E] border-2 border-[#0071E3] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleSaveName}
                        className="px-5 py-3 bg-[#0071E3] text-white rounded-xl text-sm font-semibold hover:bg-[#0051D0] transition-all shadow-md hover:shadow-lg"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingName(false);
                          // Reset to original values from Firestore
                          setEditedFirstName(userData?.firstName || "");
                          setEditedLastName(userData?.lastName || "");
                          // Reset editedName to the current display name
                          const currentDisplayName = userData?.displayName || 
                            (userData?.firstName && userData?.lastName ? `${userData.firstName} ${userData.lastName}` : '') ||
                            userData?.name || 
                            currentUser?.displayName || 
                            currentUser?.email?.split('@')[0] || 
                            'User';
                          setEditedName(currentDisplayName);
                        }}
                        className="px-5 py-3 bg-gray-100 text-[#1C1C1E] rounded-xl text-sm font-semibold hover:bg-gray-200 transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 mb-3">
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-[#1C1C1E]">
                      {userName}
                    </h2>
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="p-2.5 text-[#8E8E93] hover:text-[#0071E3] hover:bg-[#0071E3]/10 rounded-xl transition-all duration-200"
                      title="Edit name"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                )}
                <p className="text-base sm:text-lg text-[#717171] font-light mb-4">
                  {userEmail}
                </p>
                
                {/* Phone Number */}
                {isEditingPhone ? (
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <input
                      type="tel"
                      value={editedPhone}
                      onChange={(e) => setEditedPhone(e.target.value)}
                      placeholder="Enter mobile number"
                      className="text-sm sm:text-base text-[#1C1C1E] border-2 border-[#0071E3] rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 flex-1 max-w-xs"
                      autoFocus
                    />
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
                ) : (
                  <div className="flex items-center gap-3 mb-3 sm:mb-4">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <p className="text-sm sm:text-base text-[#1C1C1E]/70 font-light">
                        {userData?.phoneNumber || userData?.phone || 'Not provided'}
                      </p>
                    </div>
                    <button
                      onClick={() => setIsEditingPhone(true)}
                      className="p-1.5 text-[#8E8E93] hover:text-[#0071E3] hover:bg-[#0071E3]/10 rounded-lg transition-all"
                      title="Edit phone number"
                    >
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                )}
                
                {/* Member Since & Roles */}
                <div className="flex flex-wrap items-center gap-4 sm:gap-6 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-lg bg-[#0071E3]/10 flex items-center justify-center">
                      <svg className="w-5 h-5 text-[#0071E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-[#8E8E93] font-light">Member since</p>
                      <p className="text-sm font-medium text-[#1C1C1E]">
                        {formatDate(createdAt)}
                      </p>
                    </div>
                  </div>
                  {/* Roles Display */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {userRoles && userRoles.length > 0 ? (
                      userRoles.map((role, index) => (
                        <span
                          key={index}
                          className={`px-4 py-2 rounded-xl text-sm font-semibold ${
                            role === "host"
                              ? "bg-gradient-to-r from-[#0071E3] to-[#0051D0] text-white shadow-lg"
                              : "bg-gray-100 text-[#1C1C1E]"
                          }`}
                        >
                          {role.charAt(0).toUpperCase() + role.slice(1)}
                        </span>
                      ))
                    ) : (
                      <span className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-[#1C1C1E]">
                        Guest
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Role Switcher */}
                {userRoles && userRoles.length > 1 && (
                  <div className="mt-4 sm:mt-6">
                    <p className="text-xs sm:text-sm text-[#8E8E93] font-light mb-2">Switch Role:</p>
                    <div className="flex items-center gap-2">
                      {userRoles.map((role) => (
                        <button
                          key={role}
                          onClick={() => {
                            setUserRole(role);
                            // Navigate based on role
                            if (role === "host") {
                              navigate("/host/listings");
                            } else {
                              navigate("/guest/dashboard");
                            }
                          }}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                            userRole === role
                              ? role === "host"
                                ? "bg-[#0071E3] text-white shadow-lg"
                                : "bg-[#1C1C1E] text-white shadow-lg"
                              : "bg-gray-100 text-[#8E8E93] hover:bg-gray-200"
                          }`}
                        >
                          {role === "host" ? "Host View" : "Guest View"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 sm:gap-2 mb-8 sm:mb-10 bg-white rounded-xl p-1.5 shadow-lg border border-gray-100">
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex items-center gap-2.5 px-5 sm:px-6 py-3 text-sm font-semibold transition-all duration-200 rounded-lg ${
                activeTab === "overview"
                  ? "bg-[#0071E3] text-white shadow-md"
                  : "text-[#8E8E93] hover:text-[#1C1C1E] hover:bg-gray-50"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Overview</span>
            </button>
            <button
              onClick={() => setActiveTab("wishlist")}
              className={`flex items-center gap-2.5 px-5 sm:px-6 py-3 text-sm font-semibold transition-all duration-200 rounded-lg ${
                activeTab === "wishlist"
                  ? "bg-[#0071E3] text-white shadow-md"
                  : "text-[#8E8E93] hover:text-[#1C1C1E] hover:bg-gray-50"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span>Wishlist</span>
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === "overview" && (
            <>
          {/* Statistics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-10">
            {/* Total Bookings */}
            <div className="bg-white rounded-2xl shadow-lg animate-fadeInUp border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 p-6" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs sm:text-sm text-[#8E8E93] font-medium uppercase tracking-wide">Total Bookings</h3>
                <div className="w-10 h-10 rounded-xl bg-[#0071E3]/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#0071E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <p className="text-3xl sm:text-4xl font-bold text-[#1C1C1E]">{stats.totalBookings}</p>
            </div>

            {/* Completed Trips */}
            <div className="bg-white rounded-2xl shadow-lg animate-fadeInUp border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 p-6" style={{ animationDelay: '0.15s', animationFillMode: 'both' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs sm:text-sm text-[#8E8E93] font-medium uppercase tracking-wide">Completed Trips</h3>
                <div className="w-10 h-10 rounded-xl bg-[#34C759]/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#34C759]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <p className="text-3xl sm:text-4xl font-bold text-[#1C1C1E]">{stats.completedTrips}</p>
            </div>

            {/* Reviews Given */}
            <div className="bg-white rounded-2xl shadow-lg animate-fadeInUp border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 p-6" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs sm:text-sm text-[#8E8E93] font-medium uppercase tracking-wide">Reviews Given</h3>
                <div className="w-10 h-10 rounded-xl bg-[#FFD700]/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#FFD700]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
              </div>
              <p className="text-3xl sm:text-4xl font-bold text-[#1C1C1E]">{stats.reviewsGiven}</p>
            </div>

            {/* Avg Rating Given */}
            <div className="bg-white rounded-2xl shadow-lg animate-fadeInUp border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 p-6" style={{ animationDelay: '0.25s', animationFillMode: 'both' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs sm:text-sm text-[#8E8E93] font-medium uppercase tracking-wide">Avg Rating</h3>
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
              </div>
              <p className="text-3xl sm:text-4xl font-bold text-[#1C1C1E]">
                {stats.avgRatingGiven > 0 ? stats.avgRatingGiven.toFixed(1) : 'N/A'}
              </p>
            </div>
          </div>

          {/* Booking History & Recent Reviews */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            {/* Booking History */}
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl animate-fadeInUp border border-gray-100 p-6 sm:p-8" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#0071E3]/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#0071E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-[#1C1C1E]">Your Booking History</h2>
                  <p className="text-sm text-[#8E8E93] font-light mt-1">
                    Recent bookings sorted by date (newest first).
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {bookings.length > 0 ? (
                  bookings.slice(0, 5).map((booking, index) => (
                    <Link
                      key={booking.id}
                      to={`/listing/${booking.listingId}`}
                      className="block p-4 rounded-xl bg-gradient-to-r from-gray-50 to-white border border-gray-200 hover:border-[#0071E3] hover:shadow-lg transition-all duration-300 group animate-fadeInUp"
                      style={{ animationDelay: `${0.05 * index}s`, animationFillMode: 'both' }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-base sm:text-lg font-semibold text-[#1C1C1E] group-hover:text-[#0071E3] transition-colors">{booking.listingTitle || 'Unknown Listing'}</h3>
                        <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ml-3 ${
                          booking.status === 'confirmed' ? 'bg-[#34C759]/10 text-[#34C759]' :
                          booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          booking.status === 'completed' ? 'bg-gray-100 text-gray-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {booking.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[#717171] font-light">
                        <svg className="w-4 h-4 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>{formatDate(booking.checkIn)} - {formatDate(booking.checkOut)}</span>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="text-base sm:text-lg text-[#8E8E93] font-light">
                      No booking transactions yet.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Reviews */}
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl animate-fadeInUp border border-gray-100 p-6 sm:p-8" style={{ animationDelay: '0.35s', animationFillMode: 'both' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#FFD700]/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#FFD700]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-[#1C1C1E]">Recent Reviews</h2>
                  <p className="text-sm text-[#8E8E93] font-light mt-1">
                    Your latest reviews and ratings.
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {reviews.length > 0 ? (
                  reviews.slice(0, 5).map((review, index) => (
                    <Link
                      key={review.id}
                      to={`/listing/${review.listingId}`}
                      className="block p-4 rounded-xl bg-gradient-to-r from-gray-50 to-white border border-gray-200 hover:border-[#0071E3] hover:shadow-lg transition-all duration-300 group animate-fadeInUp"
                      style={{ animationDelay: `${0.05 * index}s`, animationFillMode: 'both' }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-base sm:text-lg font-semibold text-[#1C1C1E] group-hover:text-[#0071E3] transition-colors">{review.listingTitle || 'Unknown Listing'}</h3>
                        <div className="flex items-center gap-1 ml-3">
                          {[...Array(5)].map((_, i) => (
                            <svg
                              key={i}
                              className={`w-4 h-4 transition-all duration-200 ${i < review.rating ? 'text-[#FFD700] fill-[#FFD700]' : 'text-gray-300'}`}
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-[#717171] font-light line-clamp-2 mb-2">{review.comment}</p>
                      <p className="text-xs text-[#8E8E93] font-light">{formatDate(review.createdAt)}</p>
                    </Link>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    <p className="text-base sm:text-lg text-[#8E8E93] font-light">
                      No reviews given yet.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
            </>
          )}

          {activeTab === "wishlist" && (
            <div className="space-y-6">
              {/* Header */}
              <div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-light text-[#1C1C1E] mb-2">
                  Improvement Requests
                </h2>
                <p className="text-sm sm:text-base text-[#8E8E93] font-light">
                  View your improvement requests submitted to hosts. Create new requests from your past bookings in the My Bookings page.
                </p>
              </div>

              {/* Requests List */}
              <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-gray-100 p-6">
                <h3 className="text-lg sm:text-xl font-light text-[#1C1C1E] mb-4">Your Requests</h3>
                {wishlistRequests.length > 0 ? (
                  <div className="space-y-4">
                    {wishlistRequests.map((request) => (
                      <div
                        key={request.id}
                        className="p-4 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-all"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="text-base sm:text-lg font-medium text-[#1C1C1E]">
                                {request.title}
                              </h4>
                              <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-[#0071E3]/10 text-[#0071E3]">
                                {request.category}
                              </span>
                              <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                                request.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                                request.status === "reviewed" ? "bg-blue-100 text-blue-700" :
                                "bg-green-100 text-green-700"
                              }`}>
                                {request.status}
                              </span>
                            </div>
                            <p className="text-sm text-[#8E8E93] font-light mb-2">
                              {request.listingTitle} - {request.listingLocation}
                            </p>
                            <p className="text-sm text-[#1C1C1E] font-light">
                              {request.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-[#8E8E93] font-light">
                          <span>Submitted: {formatDate(request.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <svg className="w-16 h-16 mx-auto text-[#8E8E93] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    <p className="text-base sm:text-lg text-[#8E8E93] font-light">
                      No improvement requests yet
                    </p>
                    <p className="text-sm text-[#8E8E93] font-light mt-2">
                      Create your first request to help hosts improve their listings
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
