import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
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
          setUserData(userDoc.data());
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

  const userInitials = (currentUser?.displayName || currentUser?.email || 'U')[0].toUpperCase() + 
    (currentUser?.displayName || currentUser?.email || 'U')[1]?.toUpperCase() || '';
  const userName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';
  const userEmail = currentUser?.email || '';
  const createdAt = userData?.createdAt || currentUser?.metadata?.creationTime || '';

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <Header />

      {/* Main Content - Centered */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10 profile-container">
        <div className="max-w-6xl mx-auto">
          {/* Page Title */}
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-light text-[#1C1C1E] mb-6 sm:mb-8 animate-fadeInUp" style={{ marginBottom: '1.5rem' }}>Profile</h1>

          {/* Profile Header Card */}
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl p-5 sm:p-6 lg:p-8 mb-6 sm:mb-8 animate-slideDownFadeIn border border-gray-100 profile-section-card" style={{ marginBottom: '1.5rem' }}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
              {/* Avatar */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-2xl bg-[#0071E3] flex items-center justify-center text-white text-2xl sm:text-3xl lg:text-4xl font-light shadow-lg flex-shrink-0">
                {userInitials}
              </div>
              
              {/* User Info */}
              <div className="flex-1 w-full">
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-light text-[#1C1C1E] mb-2 sm:mb-3">
                  {userName}
                </h2>
                <p className="text-sm sm:text-base text-[#1C1C1E]/70 font-light mb-3 sm:mb-4">
                  {userEmail}
                </p>
                
                {/* Member Since & Roles */}
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#0071E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs sm:text-sm text-[#1C1C1E]/70 font-light">
                      Member since {formatDate(createdAt)}
                    </span>
                  </div>
                  {/* Roles Display */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {userRoles && userRoles.length > 0 ? (
                      userRoles.map((role, index) => (
                        <span
                          key={index}
                          className={`px-3 py-1 rounded-lg text-xs font-medium ${
                            role === "host"
                              ? "bg-[#0071E3]/10 text-[#0071E3]"
                              : "bg-gray-100 text-[#1C1C1E]/70"
                          }`}
                        >
                          {role.charAt(0).toUpperCase() + role.slice(1)}
                        </span>
                      ))
                    ) : (
                      <span className="px-3 py-1 rounded-lg text-xs font-medium bg-gray-100 text-[#1C1C1E]/70">
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
                              navigate("/host/dashboard");
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
          <div className="flex items-center gap-2 sm:gap-4 mb-6 sm:mb-8 border-b border-gray-200 pb-1" style={{ marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 text-sm font-medium transition-all duration-200 border-b-2 ${
                activeTab === "overview"
                  ? "border-[#0071E3] text-[#0071E3]"
                  : "border-transparent text-[#8E8E93] hover:text-[#1C1C1E]"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Overview</span>
            </button>
            <button
              onClick={() => setActiveTab("wishlist")}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 text-sm font-medium transition-all duration-200 border-b-2 ${
                activeTab === "wishlist"
                  ? "border-[#0071E3] text-[#0071E3]"
                  : "border-transparent text-[#8E8E93] hover:text-[#1C1C1E]"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span>Wishlist</span>
            </button>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 profile-stats-section" style={{ gap: '0.75rem' }}>
            {/* Total Bookings */}
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg animate-slideDownFadeIn border border-gray-100 hover:shadow-xl transition-all duration-300 hover:scale-105 profile-stat-card" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: '0.75rem', paddingLeft: '0.25rem', paddingRight: '0.25rem' }}>
                <h3 className="text-xs text-[#8E8E93] font-light" style={{ paddingLeft: '0.25rem' }}>Total Bookings</h3>
                <div className="profile-stat-icon" style={{ padding: '0.375rem' }}>
                  <svg className="w-4 h-4 text-[#0071E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-light text-[#1C1C1E]" style={{ paddingLeft: '0.25rem' }}>{stats.totalBookings}</p>
            </div>

            {/* Completed Trips */}
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg animate-slideDownFadeIn border border-gray-100 hover:shadow-xl transition-all duration-300 hover:scale-105 profile-stat-card" style={{ animationDelay: '0.15s' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: '0.75rem', paddingLeft: '0.25rem', paddingRight: '0.25rem' }}>
                <h3 className="text-xs text-[#8E8E93] font-light" style={{ paddingLeft: '0.25rem' }}>Completed Trips</h3>
                <div className="profile-stat-icon" style={{ padding: '0.375rem' }}>
                  <div className="w-4 h-4 rounded-full bg-[#34C759] flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-light text-[#1C1C1E]" style={{ paddingLeft: '0.25rem' }}>{stats.completedTrips}</p>
            </div>

            {/* Reviews Given */}
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg animate-slideDownFadeIn border border-gray-100 hover:shadow-xl transition-all duration-300 hover:scale-105 profile-stat-card" style={{ animationDelay: '0.2s' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: '0.75rem', paddingLeft: '0.25rem', paddingRight: '0.25rem' }}>
                <h3 className="text-xs text-[#8E8E93] font-light" style={{ paddingLeft: '0.25rem' }}>Reviews Given</h3>
                <div className="profile-stat-icon" style={{ padding: '0.375rem' }}>
                  <svg className="w-4 h-4 text-[#FFD700]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-light text-[#1C1C1E]" style={{ paddingLeft: '0.25rem' }}>{stats.reviewsGiven}</p>
            </div>

            {/* Avg Rating Given */}
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg animate-slideDownFadeIn border border-gray-100 hover:shadow-xl transition-all duration-300 hover:scale-105 profile-stat-card" style={{ animationDelay: '0.25s' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: '0.75rem', paddingLeft: '0.25rem', paddingRight: '0.25rem' }}>
                <h3 className="text-xs text-[#8E8E93] font-light" style={{ paddingLeft: '0.25rem' }}>Avg Rating Given</h3>
                <div className="profile-stat-icon" style={{ padding: '0.375rem' }}>
                  <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 100-3m-3 3a1.5 1.5 0 101.5-1.5m5.5-1.5a1.5 1.5 0 101.5 1.5m-1.5 3h3m-3 0v-3m0 0v-1.5a1.5 1.5 0 00-1.5-1.5h-3m4.5 0a1.5 1.5 0 00-1.5 1.5m1.5-1.5h3m-3 0h-3m0 0v3m0-3v-1.5m0 4.5h3m-3 0h-3" />
                  </svg>
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-light text-[#1C1C1E]" style={{ paddingLeft: '0.25rem' }}>
                {stats.avgRatingGiven > 0 ? stats.avgRatingGiven.toFixed(1) : 'N/A'}
              </p>
            </div>
          </div>

          {/* Booking History & Recent Reviews */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6" style={{ gap: '1rem' }}>
            {/* Booking History */}
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl animate-slideDownFadeIn border border-gray-100 profile-section-card" style={{ animationDelay: '0.3s' }}>
              <h2 className="text-lg sm:text-xl lg:text-2xl font-light text-[#1C1C1E]" style={{ marginBottom: '0.75rem' }}>Your Booking History</h2>
              <p className="text-xs sm:text-sm text-[#8E8E93] font-light" style={{ marginBottom: '1.5rem' }}>
                Recent bookings sorted by date (newest first).
              </p>
              <div className="min-h-[200px]">
                {bookings.length > 0 ? (
                  <div className="space-y-4">
                    {bookings.slice(0, 5).map((booking, index) => (
                      <div 
                        key={booking.id} 
                        className="p-3 sm:p-4 rounded-lg bg-gray-50 border border-gray-100 hover:bg-gray-100 hover:border-gray-200 transition-all duration-300 hover:shadow-md mb-3 last:mb-0"
                        style={{ animation: `fadeInUp 0.4s ease-out ${0.1 * index}s both` }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm sm:text-base font-medium text-[#1C1C1E]">{booking.listingTitle || 'Unknown Listing'}</h3>
                          <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                            booking.status === 'confirmed' ? 'bg-[#34C759]/10 text-[#34C759]' :
                            booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            booking.status === 'completed' ? 'bg-gray-100 text-gray-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {booking.status}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-[#8E8E93] font-light">
                          {formatDate(booking.checkIn)} - {formatDate(booking.checkOut)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-base sm:text-lg text-[#8E8E93] font-light text-center py-12">
                    No booking transactions yet.
                  </p>
                )}
              </div>
            </div>

            {/* Recent Reviews */}
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl animate-slideDownFadeIn border border-gray-100 profile-section-card" style={{ animationDelay: '0.35s' }}>
              <h2 className="text-lg sm:text-xl lg:text-2xl font-light text-[#1C1C1E]" style={{ marginBottom: '0.75rem' }}>Recent Reviews</h2>
              <p className="text-xs sm:text-sm text-[#8E8E93] font-light" style={{ marginBottom: '1.5rem' }}>
                Your latest reviews and ratings.
              </p>
              <div className="min-h-[200px]">
                {reviews.length > 0 ? (
                  <div className="space-y-4">
                    {reviews.slice(0, 5).map((review, index) => (
                      <div 
                        key={review.id} 
                        className="p-3 sm:p-4 rounded-lg bg-gray-50 border border-gray-100 hover:bg-gray-100 hover:border-gray-200 transition-all duration-300 hover:shadow-md mb-3 last:mb-0"
                        style={{ animation: `fadeInUp 0.4s ease-out ${0.1 * index}s both` }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm sm:text-base font-medium text-[#1C1C1E]">{review.listingTitle || 'Unknown Listing'}</h3>
                          <div className="flex items-center gap-0.5">
                            {[...Array(5)].map((_, i) => (
                              <svg
                                key={i}
                                className={`w-3.5 h-3.5 transition-all duration-200 ${i < review.rating ? 'text-[#FFD700] fill-[#FFD700]' : 'text-gray-300'}`}
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                              </svg>
                            ))}
                          </div>
                        </div>
                        <p className="text-xs sm:text-sm text-[#8E8E93] font-light line-clamp-3 mb-2">{review.comment}</p>
                        <p className="text-xs text-[#8E8E93] font-light">{formatDate(review.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-base sm:text-lg text-[#8E8E93] font-light text-center py-12">
                    No reviews given yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
