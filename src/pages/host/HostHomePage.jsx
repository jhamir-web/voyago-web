import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { collection, query, getDocs, onSnapshot, where, orderBy, addDoc, doc, getDoc, limit, serverTimestamp, updateDoc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { cloudinaryConfig, CLOUDINARY_UPLOAD_URL } from "../../config/cloudinary";
import { GoogleMap, LoadScript, Marker } from "@react-google-maps/api";
import { GOOGLE_MAPS_API_KEY } from "../../config/googlemaps";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { PAYPAL_CLIENT_ID } from "../../config/paypal";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase";
import WalletModal from "../../components/WalletModal";
import RewardsCenterModal from "../../components/RewardsCenterModal";
import CouponManagementModal from "../../components/CouponManagementModal";
import GuestWishlistsModal from "../../components/GuestWishlistsModal";
import { awardPoints, POINTS_PER_BOOKING } from "../../utils/points";

const HostHomePage = () => {
  const { currentUser, userRole, userRoles, setUserRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeSection, setActiveSection] = useState("home");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showBurgerMenu, setShowBurgerMenu] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [showRewards, setShowRewards] = useState(false);
  const [showCoupons, setShowCoupons] = useState(false);
  const [showWishlists, setShowWishlists] = useState(false);
  const [stats, setStats] = useState({
    totalIncome: 0,
    activeListings: 0,
    pendingListings: 0,
    rejectedListings: 0,
    totalListings: 0,
    averageRating: 0,
    totalBookings: 0,
    todayBookings: 0,
    upcomingBookings: 0,
    pendingBookings: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    
    if (!currentUser) {
      navigate("/login");
      return;
    }

    // Check if user has host role
    if (!userRoles || !userRoles.includes("host")) {
      console.warn("User does not have host role. Redirecting to home.");
      navigate("/");
      return;
    }

    // Set active section based on URL
    const path = location.pathname;
    if (path === "/host" || path === "/host/") {
      setActiveSection("home"); // Show host dashboard home
    } else if (path.includes("/host/listings")) {
      setActiveSection("listings");
    } else if (path.includes("/host/bookings")) {
      setActiveSection("bookings");
    } else if (path.includes("/host/calendar")) {
      setActiveSection("calendar");
    } else if (path.includes("/host/messages")) {
      setActiveSection("messages");
    } else {
      setActiveSection("home"); // Default to home
    }

    fetchStats().catch(error => {
      console.error("Error in fetchStats:", error);
      setLoading(false);
    });
  }, [currentUser, userRoles, authLoading, navigate, location]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      
      // Fetch host's listings
      const listingsQuery = query(
        collection(db, "listings"),
        where("hostId", "==", currentUser.uid)
      );
      const listingsSnapshot = await getDocs(listingsQuery);
      const allListings = listingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Fetch host's bookings
      const bookingsQuery = query(
        collection(db, "bookings"),
        where("hostId", "==", currentUser.uid)
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);
      const allBookings = bookingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Calculate stats
      const totalIncome = allBookings
        .filter(b => b.status === "confirmed" && b.paymentStatus === "paid")
        .reduce((sum, b) => sum + (b.totalPrice || 0), 0);
      
      const activeListings = allListings.filter(l => l.status === "active").length;
      const pendingListings = allListings.filter(l => l.status === "pending").length;
      const rejectedListings = allListings.filter(l => l.status === "rejected").length;
      const totalListings = allListings.length;
      
      // Calculate today's bookings
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayBookings = allBookings.filter(b => {
        const checkIn = b.checkIn ? new Date(b.checkIn) : null;
        if (!checkIn) return false;
        checkIn.setHours(0, 0, 0, 0);
        return checkIn.getTime() === today.getTime() && b.status === "confirmed";
      }).length;
      
      // Calculate upcoming bookings
      const upcomingBookings = allBookings.filter(b => {
        const checkIn = b.checkIn ? new Date(b.checkIn) : null;
        if (!checkIn) return false;
        return checkIn > today && b.status === "confirmed";
      }).length;
      
      // Calculate pending bookings
      const pendingBookings = allBookings.filter(b => b.status === "pending").length;
      
      // Calculate average rating (placeholder - you'll need reviews collection)
      const averageRating = 0; // TODO: Calculate from reviews
      
      setStats({
        totalIncome,
        activeListings,
        pendingListings,
        rejectedListings,
        totalListings,
        averageRating,
        totalBookings: allBookings.length,
        todayBookings,
        upcomingBookings,
        pendingBookings
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSectionChange = (section) => {
    setActiveSection(section);
    setSidebarOpen(false);
    // For "home", navigate to /host to show host dashboard home (not guest home)
    if (section === "home") {
      navigate("/host"); // Navigate to /host route (host dashboard home)
    } else {
      navigate(`/host/${section}`);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getCurrentDate = () => {
    const today = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return today.toLocaleDateString('en-US', options);
  };

  // Show loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="text-[#1C1C1E] font-light">Loading...</div>
      </div>
    );
  }

  // Check if user is authenticated and has host role before showing content
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="text-[#1C1C1E] font-light">Redirecting to login...</div>
      </div>
    );
  }

  if (!userRoles || !userRoles.includes("host")) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#1C1C1E] font-light mb-4">You don't have host access.</p>
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 bg-[#0071E3] text-white rounded-lg hover:bg-[#0051D0] transition-all"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="text-[#1C1C1E] font-light">Loading host dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex">
      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#0071E3] flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <span className="text-xl font-light text-[#1C1C1E]">Voyago</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <NavItem
              icon="home"
              label="Home"
              active={activeSection === "home"}
              onClick={() => handleSectionChange("home")}
            />
            <NavItem
              icon="listings"
              label="Listings"
              active={activeSection === "listings"}
              onClick={() => handleSectionChange("listings")}
            />
            <NavItem
              icon="bookings"
              label="Bookings"
              active={activeSection === "bookings"}
              onClick={() => handleSectionChange("bookings")}
            />
            <NavItem
              icon="calendar"
              label="Calendar"
              active={activeSection === "calendar"}
              onClick={() => handleSectionChange("calendar")}
            />
            <NavItem
              icon="messages"
              label="Messages"
              active={activeSection === "messages"}
              onClick={() => handleSectionChange("messages")}
            />
          </nav>

          {/* Switch to Guest View */}
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={() => {
                setUserRole("guest");
                navigate("/");
              }}
              className="w-full px-4 py-2.5 bg-gray-100 text-[#1C1C1E] rounded-xl text-sm font-light hover:bg-gray-200 transition-all duration-200"
            >
              Switch to Guest View
            </button>
          </div>
        </div>
      </aside>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          style={{ animation: 'fadeIn 0.2s ease-out' }}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 text-[#1C1C1E] hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h1 className="text-2xl font-light text-[#1C1C1E]">
                {activeSection === "home" ? "Dashboard" : activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-[#8E8E93] font-light hidden sm:block">
                {getCurrentDate()}
              </div>
              {/* Burger Menu Button */}
              <div className="relative">
                <button
                  onClick={() => setShowBurgerMenu(!showBurgerMenu)}
                  className="p-2 text-[#1C1C1E] hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>

                {/* Burger Menu Dropdown */}
                {showBurgerMenu && (
                  <>
                    <div 
                      className="fixed inset-0 bg-black/20 backdrop-blur-sm" 
                      onClick={() => setShowBurgerMenu(false)}
                      style={{ 
                        animation: 'fadeIn 0.2s ease-out',
                        zIndex: 40
                      }}
                    ></div>
                    <div 
                      className="absolute right-0 top-full mt-2 w-64 sm:w-72 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
                      style={{ zIndex: 50 }}
                    >
                      <Link
                        to="/profile"
                        onClick={() => setShowBurgerMenu(false)}
                        className="flex items-center gap-3 px-4 py-3 text-sm text-[#1C1C1E] hover:bg-gray-50 transition-all duration-200"
                      >
                        <svg className="w-5 h-5 text-[#0071E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="font-light">Profile</span>
                      </Link>

                      <button
                        onClick={() => {
                          setShowBurgerMenu(false);
                          setShowWallet(true);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#1C1C1E] hover:bg-gray-50 transition-all duration-200"
                      >
                        <svg className="w-5 h-5 text-[#0071E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span className="font-light">Wallet</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowBurgerMenu(false);
                          setShowCoupons(true);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#1C1C1E] hover:bg-gray-50 transition-all duration-200"
                      >
                        <svg className="w-5 h-5 text-[#0071E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2v7m-2 2H10a2 2 0 01-2-2V9a2 2 0 012-2h2m-4 5h4m-4 0v5a2 2 0 002 2h4a2 2 0 002-2v-5m-6 0h6" />
                        </svg>
                        <span className="font-light">Coupon Management</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowBurgerMenu(false);
                          setShowRewards(true);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#1C1C1E] hover:bg-gray-50 transition-all duration-200"
                      >
                        <svg className="w-5 h-5 text-[#0071E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2v7m-2 2H10a2 2 0 01-2-2V9a2 2 0 012-2h2m-4 5h4m-4 0v5a2 2 0 002 2h4a2 2 0 002-2v-5m-6 0h6" />
                        </svg>
                        <span className="font-light">Points & Rewards</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowBurgerMenu(false);
                          setShowWishlists(true);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#1C1C1E] hover:bg-gray-50 transition-all duration-200"
                      >
                        <svg className="w-5 h-5 text-[#0071E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        <span className="font-light">Guest Wishlists</span>
                      </button>

                      <div className="border-t border-gray-200 my-1"></div>

                      <button
                        onClick={async () => {
                          setShowBurgerMenu(false);
                          try {
                            await signOut(auth);
                            navigate("/login");
                          } catch (error) {
                            console.error("Error signing out:", error);
                          }
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-all duration-200"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span className="font-light">Logout</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {activeSection === "messages" ? (
            <div className="flex-1 overflow-hidden p-4 sm:p-6 lg:p-8">
              <HostMessagesContent />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
              {activeSection === "home" && <HostHomeContent stats={stats} formatCurrency={formatCurrency} currentUser={currentUser} />}
              {activeSection === "listings" && <HostListingsContent />}
              {activeSection === "bookings" && <HostBookingsContent />}
              {activeSection === "calendar" && <HostCalendarContent />}
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <WalletModal isOpen={showWallet} onClose={() => setShowWallet(false)} />
      <RewardsCenterModal isOpen={showRewards} onClose={() => setShowRewards(false)} />
      <CouponManagementModal isOpen={showCoupons} onClose={() => setShowCoupons(false)} />
      <GuestWishlistsModal isOpen={showWishlists} onClose={() => setShowWishlists(false)} />
    </div>
  );
};

// Navigation Item Component
const NavItem = ({ icon, label, active, onClick }) => {
  const icons = {
    home: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    listings: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
    bookings: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    calendar: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    messages: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    )
  };

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-light transition-all duration-200 ${
        active
          ? "bg-[#0071E3]/10 text-[#0071E3]"
          : "text-[#8E8E93] hover:bg-gray-100 hover:text-[#1C1C1E]"
      }`}
    >
      {icons[icon]}
      <span>{label}</span>
    </button>
  );
};

// Host Home Content Component
const HostHomeContent = ({ stats, formatCurrency, currentUser }) => {
  const userName = currentUser?.displayName?.split(" ")[0] || currentUser?.email?.split("@")[0] || "Host";

  const statCards = [
    {
      label: "Total Income",
      value: formatCurrency(stats.totalIncome),
      icon: "dollar",
      color: "bg-[#0071E3]",
      delay: 0
    },
    {
      label: "Active Listings",
      value: stats.activeListings,
      icon: "home",
      color: "bg-[#34C759]",
      delay: 0.1
    },
    {
      label: "Pending Listings",
      value: stats.pendingListings,
      icon: "clock",
      color: "bg-[#FF9500]",
      delay: 0.2
    },
    {
      label: "Rejected Listings",
      value: stats.rejectedListings,
      icon: "x",
      color: "bg-[#FF3B30]",
      delay: 0.3
    },
    {
      label: "Total Listings",
      value: stats.totalListings,
      icon: "document",
      color: "bg-[#AF52DE]",
      delay: 0.4
    },
    {
      label: "Average Rating",
      value: stats.averageRating > 0 ? stats.averageRating.toFixed(1) : "No ratings",
      subtitle: stats.averageRating > 0 ? `${stats.totalBookings} reviews` : "0 reviews",
      icon: "star",
      color: "bg-gradient-to-br from-[#FF9500] to-[#FFCC00]",
      delay: 0.5
    }
  ];

  return (
    <div className="space-y-8 sm:space-y-10 lg:space-y-12 animate-fadeInUp">
      {/* Welcome Section */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 animate-fadeInUp">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#0071E3]/10 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl sm:text-3xl font-light text-[#0071E3]">
              {userName[0].toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-light text-[#1C1C1E] mb-2">
              Welcome back, {userName}
            </h2>
            <p className="text-base text-[#8E8E93] font-light">
              Here's what's happening with your properties today.
            </p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {statCards.map((card, index) => (
          <StatCard key={index} {...card} />
        ))}
      </div>

      {/* Booking Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        <BookingCard
          title="Today's Bookings"
          count={stats.todayBookings}
          icon="calendar"
          emptyMessage="No bookings for today"
          delay={0.6}
        />
        <BookingCard
          title="Upcoming Bookings"
          count={stats.upcomingBookings}
          icon="clock"
          emptyMessage="No upcoming bookings"
          delay={0.7}
        />
      </div>

      {/* Charts and Additional Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        <MonthlyEarningsCard delay={0.8} />
        <RecentMessagesCard delay={0.9} />
      </div>

      <GuestReviewsCard delay={1.0} />
    </div>
  );
};

// Stat Card Component
const StatCard = ({ label, value, subtitle, icon, color, delay }) => {
  const icons = {
    dollar: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    home: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    clock: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    x: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    document: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    star: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    )
  };

  return (
    <div
      className="bg-white rounded-2xl p-6 sm:p-7 shadow-sm border border-gray-100 hover:shadow-lg hover:border-gray-200 hover:-translate-y-1 transition-all duration-300 animate-fadeInUp group"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-300`}>
          {icons[icon]}
        </div>
      </div>
      <div>
        <p className="text-sm text-[#8E8E93] font-light mb-2">{label}</p>
        <p className="text-2xl sm:text-3xl font-light text-[#1C1C1E] group-hover:text-[#0071E3] transition-colors duration-300">{value}</p>
        {subtitle && (
          <p className="text-xs text-[#8E8E93] font-light mt-1.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
};

// Booking Card Component
const BookingCard = ({ title, count, icon, emptyMessage, delay = 0 }) => {
  const icons = {
    calendar: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    clock: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  };

  return (
    <div 
      className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 hover:shadow-lg hover:border-gray-200 hover:-translate-y-1 transition-all duration-300 animate-fadeInUp group"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-[#0071E3]/10 flex items-center justify-center text-[#0071E3] group-hover:bg-[#0071E3]/20 group-hover:scale-110 transition-all duration-300">
          {icons[icon]}
        </div>
        <div>
          <h3 className="text-lg font-light text-[#1C1C1E] group-hover:text-[#0071E3] transition-colors duration-300">{title}</h3>
          <p className="text-sm text-[#8E8E93] font-light">{count} {count === 1 ? 'booking' : 'bookings'}</p>
        </div>
      </div>
      {count === 0 ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors duration-300">
            {icons[icon]}
          </div>
          <p className="text-sm text-[#8E8E93] font-light">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Booking items would go here */}
        </div>
      )}
    </div>
  );
};

// Monthly Earnings Card
const MonthlyEarningsCard = ({ delay = 0 }) => {
  return (
    <div 
      className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 hover:shadow-lg hover:border-gray-200 hover:-translate-y-1 transition-all duration-300 animate-fadeInUp group"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-[#FF9500]/10 flex items-center justify-center text-[#FF9500] group-hover:bg-[#FF9500]/20 group-hover:scale-110 transition-all duration-300">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-light text-[#1C1C1E] group-hover:text-[#FF9500] transition-colors duration-300">Monthly Earnings</h3>
          <p className="text-sm text-[#8E8E93] font-light">Revenue overview for this year</p>
        </div>
      </div>
      <div className="h-64 flex items-center justify-center">
        <p className="text-sm text-[#8E8E93] font-light">Chart placeholder - Coming soon</p>
      </div>
    </div>
  );
};

// Recent Messages Card
const RecentMessagesCard = ({ delay = 0 }) => {
  return (
    <div 
      className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 hover:shadow-lg hover:border-gray-200 hover:-translate-y-1 transition-all duration-300 animate-fadeInUp group"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-[#AF52DE]/10 flex items-center justify-center text-[#AF52DE] group-hover:bg-[#AF52DE]/20 group-hover:scale-110 transition-all duration-300">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-light text-[#1C1C1E] group-hover:text-[#AF52DE] transition-colors duration-300">Recent Messages</h3>
          <p className="text-sm text-[#8E8E93] font-light">Latest conversations</p>
        </div>
      </div>
      <div className="text-center py-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors duration-300">
          <svg className="w-8 h-8 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <p className="text-sm text-[#8E8E93] font-light">No messages yet</p>
      </div>
    </div>
  );
};

// Guest Reviews Card
const GuestReviewsCard = ({ delay = 0 }) => {
  return (
    <div 
      className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 hover:shadow-lg hover:border-gray-200 hover:-translate-y-1 transition-all duration-300 animate-fadeInUp group"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-[#FFCC00]/10 flex items-center justify-center text-[#FF9500] group-hover:bg-[#FFCC00]/20 group-hover:scale-110 transition-all duration-300">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-light text-[#1C1C1E] group-hover:text-[#FF9500] transition-colors duration-300">Guest Reviews</h3>
          <p className="text-sm text-[#8E8E93] font-light">Latest feedback from guests</p>
        </div>
      </div>
      <div className="text-center py-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors duration-300">
          <svg className="w-8 h-8 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </div>
        <p className="text-sm text-[#8E8E93] font-light">No reviews yet</p>
      </div>
    </div>
  );
};

// Listings Content Component
const HostListingsContent = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState("all"); // all, place, services, experiences
  const [showDraftsModal, setShowDraftsModal] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);
  const [showListingModal, setShowListingModal] = useState(false);
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [listingReviews, setListingReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState({
    plan: "starter",
    limit: 3,
    activeCount: 0,
  });
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("paypal");
  const [walletBalance, setWalletBalance] = useState(0);
  const [checkingWallet, setCheckingWallet] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: "",
    message: "",
    onConfirm: null,
    confirmText: "Confirm",
    cancelText: "Cancel",
    type: "danger", // danger, warning, info
  });

  useEffect(() => {
    if (!currentUser) return;

    const fetchListings = async () => {
      try {
        setLoading(true);
        const q = query(
          collection(db, "listings"),
          where("hostId", "==", currentUser.uid)
        );

        const querySnapshot = await getDocs(q);
        const listingsData = [];

        querySnapshot.forEach((doc) => {
          listingsData.push({
            id: doc.id,
            ...doc.data(),
          });
        });

        // Sort by createdAt (newest first)
        listingsData.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return dateB - dateA;
        });

        setListings(listingsData);
      } catch (error) {
        console.error("Error fetching listings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, [currentUser]);

  // Fetch subscription info and calculate active listings count
  useEffect(() => {
    if (!currentUser) return;

    const fetchSubscriptionInfo = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const subscriptionPlan = userData.subscriptionPlan || "starter";
          
          // Get plan limits
          const planLimits = {
            starter: 3,
            pro: 10,
            elite: 1000 // Unlimited
          };
          
          const listingLimit = planLimits[subscriptionPlan] || 3;
          
          // Count active listings
          const activeCount = listings.filter(listing => listing.status === "active").length;
          
          setSubscriptionInfo({
            plan: subscriptionPlan,
            limit: listingLimit,
            activeCount: activeCount,
          });
        }
      } catch (error) {
        console.error("Error fetching subscription info:", error);
      }
    };

    fetchSubscriptionInfo();
  }, [currentUser, listings]);

  // Reset modal state when it closes
  useEffect(() => {
    if (!showUpgradeModal) {
      setSelectedPlan(null);
      setPaymentMethod("paypal");
    }
  }, [showUpgradeModal]);

  const filteredListings = listings.filter((listing) => {
    // Only show published/active listings (exclude drafts)
    if (listing.status === "draft") return false;
    
    if (selectedFilter === "all") return true;
    if (selectedFilter === "place") {
      return listing.category === "resort" || listing.category === "hotel" || listing.category === "transient";
    }
    if (selectedFilter === "services") {
      return listing.services && Array.isArray(listing.services) && listing.services.length > 0;
    }
    if (selectedFilter === "experiences") {
      return listing.experiences && Array.isArray(listing.experiences) && listing.experiences.length > 0;
    }
    return true;
  });

  const drafts = listings.filter(listing => listing.status === "draft");

  const handleAddListing = () => {
    // Check if limit is reached
    if (subscriptionInfo.limit < 1000 && subscriptionInfo.activeCount >= subscriptionInfo.limit) {
      setShowUpgradeModal(true);
      fetchWalletBalance();
    } else {
      navigate("/host/select-listing-type");
    }
  };

  // Fetch wallet balance
  const fetchWalletBalance = async () => {
    if (!currentUser) return;
    try {
      setCheckingWallet(true);
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setWalletBalance(userData.walletBalance || 0);
      }
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
    } finally {
      setCheckingWallet(false);
    }
  };

  // Handle wallet payment
  const handleWalletPayment = async (plan) => {
    if (walletBalance < plan.price) {
      alert(`Insufficient wallet balance. You have $${walletBalance.toFixed(2)} but need $${plan.price}. Please use PayPal or add funds to your wallet.`);
      return;
    }

    try {
      setProcessingPayment(true);
      const userRef = doc(db, "users", currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const currentBalance = userDoc.data().walletBalance || 0;
        const newBalance = currentBalance - plan.price;
        
        const transaction = {
          type: "subscription_payment",
          amount: plan.price,
          date: new Date().toISOString(),
          status: "completed",
          method: "wallet",
          plan: plan.name,
        };

        const existingTransactions = userDoc.data().transactions || [];
        
        await updateDoc(userRef, {
          subscriptionPlan: plan.id,
          subscriptionStatus: "active",
          subscriptionStartDate: new Date().toISOString(),
          walletBalance: newBalance,
          transactions: [transaction, ...existingTransactions].slice(0, 10),
        });

        // Refresh listings to update subscription info
        const q = query(
          collection(db, "listings"),
          where("hostId", "==", currentUser.uid)
        );
        const querySnapshot = await getDocs(q);
        const listingsData = [];
        querySnapshot.forEach((doc) => {
          listingsData.push({
            id: doc.id,
            ...doc.data(),
          });
        });
        listingsData.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return dateB - dateA;
        });
        setListings(listingsData);

        // Update subscription info
        const activeCount = listingsData.filter(listing => listing.status === "active").length;
        const planLimits = {
          starter: 3,
          pro: 10,
          elite: 1000
        };
        const listingLimit = planLimits[plan.id] || 3;
        
        setSubscriptionInfo({
          plan: plan.id,
          limit: listingLimit,
          activeCount: activeCount,
        });

        // Update wallet balance after wallet payment
        setWalletBalance(newBalance);

        setShowUpgradeModal(false);
        setSelectedPlan(null);
        setProcessingPayment(false);
        alert(`Payment successful! Your subscription has been ${plan.id === subscriptionInfo.plan ? "renewed" : "upgraded"} to ${plan.name}.`);
      }
    } catch (error) {
      console.error("Error processing wallet payment:", error);
      alert("Failed to process payment. Please try again.");
      setProcessingPayment(false);
    }
  };

  // Handle PayPal payment success
  const handlePayPalPaymentSuccess = async (details, plan) => {
    try {
      setProcessingPayment(true);
      const userRef = doc(db, "users", currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const updateData = {
          subscriptionPlan: plan.id,
          subscriptionStatus: "active",
          subscriptionStartDate: new Date().toISOString(),
          paypalOrderId: details.id,
        };

        await updateDoc(userRef, updateData);

        // Refresh listings to update subscription info
        const q = query(
          collection(db, "listings"),
          where("hostId", "==", currentUser.uid)
        );
        const querySnapshot = await getDocs(q);
        const listingsData = [];
        querySnapshot.forEach((doc) => {
          listingsData.push({
            id: doc.id,
            ...doc.data(),
          });
        });
        listingsData.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return dateB - dateA;
        });
        setListings(listingsData);

        // Update subscription info
        const activeCount = listingsData.filter(listing => listing.status === "active").length;
        const planLimits = {
          starter: 3,
          pro: 10,
          elite: 1000
        };
        const listingLimit = planLimits[plan.id] || 3;
        
        setSubscriptionInfo({
          plan: plan.id,
          limit: listingLimit,
          activeCount: activeCount,
        });

        setShowUpgradeModal(false);
        setSelectedPlan(null);
        setProcessingPayment(false);
        alert(`Payment successful! Your subscription has been ${plan.id === subscriptionInfo.plan ? "renewed" : "upgraded"} to ${plan.name}.`);
      }
    } catch (error) {
      console.error("Error processing PayPal payment:", error);
      alert("Failed to process payment. Please try again.");
      setProcessingPayment(false);
    }
  };


  const handleEditDraft = async (listingId) => {
    try {
      // Fetch the listing to get its category
      const listingDoc = await getDoc(doc(db, "listings", listingId));
      if (listingDoc.exists()) {
        const listingData = listingDoc.data();
        // Determine category from listing data
        let listingCategory = "place"; // default
        if (listingData.category === "place" || listingData.placeType || listingData.subcategory) {
          listingCategory = "place";
        } else if (listingData.serviceType) {
          listingCategory = "service";
        } else if (listingData.activityType) {
          listingCategory = "experience";
        }
        // Navigate to CreateListingFlow with category and listing ID
        navigate(`/host/create-listing-flow?category=${listingCategory}&id=${listingId}`);
      } else {
        console.error("Listing not found");
      }
    } catch (error) {
      console.error("Error fetching listing:", error);
    }
  };

  const showConfirmModal = (title, message, onConfirm, type = "danger", confirmText = "Confirm", cancelText = "Cancel") => {
    setConfirmModal({
      show: true,
      title,
      message,
      onConfirm,
      confirmText,
      cancelText,
      type,
    });
  };

  const handleDeleteDraft = async (listingId) => {
    showConfirmModal(
      "Delete Draft",
      "Are you sure you want to delete this draft? This action cannot be undone.",
      async () => {
        try {
          await deleteDoc(doc(db, "listings", listingId));
          
          // Refresh listings
          const q = query(
            collection(db, "listings"),
            where("hostId", "==", currentUser.uid)
          );
          const querySnapshot = await getDocs(q);
          const listingsData = [];
          querySnapshot.forEach((doc) => {
            listingsData.push({
              id: doc.id,
              ...doc.data(),
            });
          });
          listingsData.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB - dateA;
          });
          setListings(listingsData);
          setConfirmModal(prev => ({ ...prev, show: false }));
        } catch (error) {
          console.error("Error deleting draft:", error);
          alert("Failed to delete draft. Please try again.");
        }
      },
      "danger",
      "Delete",
      "Cancel"
    );
  };

  const handleDeleteListing = async (listingId) => {
    showConfirmModal(
      "Delete Listing",
      "Are you sure you want to delete this listing? This action cannot be undone and will also delete all associated bookings and reviews.",
      async () => {
        try {
          setDeletingId(listingId);
          await deleteDoc(doc(db, "listings", listingId));
          
          // Refresh listings
          const q = query(
            collection(db, "listings"),
            where("hostId", "==", currentUser.uid)
          );
          const querySnapshot = await getDocs(q);
          const listingsData = [];
          querySnapshot.forEach((doc) => {
            listingsData.push({
              id: doc.id,
              ...doc.data(),
            });
          });
          listingsData.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB - dateA;
          });
          setListings(listingsData);
          setConfirmModal(prev => ({ ...prev, show: false }));
        } catch (error) {
          console.error("Error deleting listing:", error);
          alert("Failed to delete listing. Please try again.");
        } finally {
          setDeletingId(null);
        }
      },
      "danger",
      "Delete",
      "Cancel"
    );
  };

  const handleViewReviews = async (listing) => {
    try {
      setSelectedListing(listing);
      setLoadingReviews(true);
      setShowReviewsModal(true);
      
      // Fetch reviews for this listing (without orderBy to avoid index requirement)
      const reviewsQuery = query(
        collection(db, "reviews"),
        where("listingId", "==", listing.id),
        where("status", "==", "approved")
      );
      
      const reviewsSnapshot = await getDocs(reviewsQuery);
      const reviewsData = [];
      
      reviewsSnapshot.forEach((doc) => {
        reviewsData.push({
          id: doc.id,
          ...doc.data(),
        });
      });
      
      // Sort by createdAt in JavaScript (newest first)
      reviewsData.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB - dateA;
      });
      
      setListingReviews(reviewsData);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      // Don't show alert, just show empty state in modal
      setListingReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeInUp">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-light text-[#1C1C1E] mb-2">My Listings</h2>
            {/* Subscription Limit Indicator */}
            {subscriptionInfo.limit < 1000 && (
              <div className={`flex items-center gap-2 text-sm font-light ${
                subscriptionInfo.activeCount >= subscriptionInfo.limit
                  ? "text-[#FF3B30]" 
                  : subscriptionInfo.activeCount >= subscriptionInfo.limit * 0.8
                  ? "text-[#FF9500]"
                  : "text-[#8E8E93]"
              }`}>
                <span>
                  {subscriptionInfo.activeCount} / {subscriptionInfo.limit} active listings
                </span>
                {subscriptionInfo.activeCount >= subscriptionInfo.limit && (
                  <span className="px-2 py-0.5 bg-[#FF3B30]/10 text-[#FF3B30] rounded-lg text-xs">
                    Limit reached
                  </span>
                )}
                {subscriptionInfo.activeCount >= subscriptionInfo.limit * 0.8 && subscriptionInfo.activeCount < subscriptionInfo.limit && (
                  <span className="px-2 py-0.5 bg-[#FF9500]/10 text-[#FF9500] rounded-lg text-xs">
                    Near limit
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setShowDraftsModal(true)}
              className="px-4 py-2 bg-gray-100 text-[#1C1C1E] rounded-xl text-sm font-medium hover:bg-gray-200 transition-all duration-200 relative"
            >
              View Drafts
              {drafts.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#FF9500] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                  {drafts.length}
                </span>
              )}
            </button>
            <button
              onClick={handleAddListing}
              className="px-6 py-2.5 bg-[#0071E3] text-white rounded-xl text-sm font-medium hover:bg-[#0051D0] transition-all duration-200 shadow-sm hover:shadow-md"
            >
              Add Listing
            </button>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          {["all", "place", "services", "experiences"].map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                selectedFilter === filter
                  ? "bg-[#0071E3] text-white shadow-sm"
                  : "bg-gray-100 text-[#1C1C1E] hover:bg-gray-200"
              }`}
            >
              {filter === "all" ? "All" : filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Listings Grid */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 flex items-center justify-center">
          <div className="text-[#8E8E93] font-light">Loading listings...</div>
        </div>
      ) : filteredListings.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 sm:p-16 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center animate-fadeInUp">
          <div className="w-24 h-24 sm:w-32 sm:h-32 mb-6 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-12 h-12 sm:w-16 sm:h-16 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-xl sm:text-2xl font-light text-[#1C1C1E] mb-2">No listings yet</h3>
          <p className="text-sm sm:text-base text-[#8E8E93] font-light mb-6 max-w-md">
            Create your first listing to get started and showcase your property to potential guests.
          </p>
          <button
            onClick={handleAddListing}
            className="px-6 py-3 bg-[#0071E3] text-white rounded-xl text-sm font-medium hover:bg-[#0051D0] transition-all duration-200 shadow-sm hover:shadow-md"
          >
            Add Listing
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredListings.map((listing, index) => (
            <div
              key={listing.id}
              className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 animate-fadeInUp"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              {/* Listing Image */}
              <div className="relative h-48 sm:h-56 overflow-hidden bg-gray-100">
                {listing.imageUrl ? (
                  <img
                    src={listing.imageUrl}
                    alt={listing.title}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100">
                    <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                {listing.status === "draft" && (
                  <div className="absolute top-3 left-3 px-2 py-1 bg-[#FF9500] text-white text-xs font-medium rounded-lg">
                    Draft
                  </div>
                )}
              </div>

              {/* Listing Info */}
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-medium text-[#1C1C1E] line-clamp-1 flex-1">
                    {listing.title}
                  </h3>
                </div>
                <p className="text-sm text-[#8E8E93] font-light mb-3 line-clamp-2">
                  {listing.location}
                </p>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1">
                    <span className="text-base font-medium text-[#1C1C1E]">${listing.price}</span>
                    <span className="text-sm text-[#8E8E93] font-light">
                      {listing.activityType 
                        ? "/person" 
                        : listing.serviceType 
                        ? "/service" 
                        : listing.placeType || listing.subcategory || listing.category === "place" || (listing.category && !listing.activityType && !listing.serviceType)
                        ? "/night" 
                        : "/person"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedListing(listing);
                      setShowListingModal(true);
                    }}
                    className="flex-1 px-3 py-1.5 bg-[#0071E3]/10 text-[#0071E3] rounded-lg text-xs font-medium hover:bg-[#0071E3]/20 transition-colors duration-200"
                  >
                    View
                  </button>
                  <button
                    onClick={() => handleViewReviews(listing)}
                    className="flex-1 px-3 py-1.5 bg-[#34C759]/10 text-[#34C759] rounded-lg text-xs font-medium hover:bg-[#34C759]/20 transition-colors duration-200"
                  >
                    Reviews
                  </button>
                  <button
                    onClick={() => handleDeleteListing(listing.id)}
                    disabled={deletingId === listing.id}
                    className="px-3 py-1.5 bg-red-500/10 text-red-500 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete listing"
                  >
                    {deletingId === listing.id ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-500 mx-auto"></div>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Listing Preview Modal */}
      {showListingModal && selectedListing && createPortal(
        <ListingPreviewModal 
          listing={selectedListing} 
          onClose={() => {
            setShowListingModal(false);
            setSelectedListing(null);
          }} 
        />,
        document.body
      )}

      {/* Reviews Modal */}
      {showReviewsModal && selectedListing && createPortal(
        <ReviewsModal
          listing={selectedListing}
          reviews={listingReviews}
          loading={loadingReviews}
          onClose={() => {
            setShowReviewsModal(false);
            setSelectedListing(null);
            setListingReviews([]);
          }}
        />,
        document.body
      )}

      {/* Confirmation Modal */}
      {confirmModal.show && createPortal(
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          type={confirmModal.type}
          confirmText={confirmModal.confirmText}
          cancelText={confirmModal.cancelText}
          onConfirm={() => {
            if (confirmModal.onConfirm) {
              confirmModal.onConfirm();
            }
          }}
          onCancel={() => {
            setConfirmModal(prev => ({ ...prev, show: false }));
          }}
        />,
        document.body
      )}

      {/* Drafts Modal - Using Portal to render at document body level */}
      {showDraftsModal && createPortal(
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 sm:p-6 animate-fadeIn"
          onClick={() => setShowDraftsModal(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-4xl h-[85vh] flex flex-col animate-slideDownFadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header - Fixed */}
            <div className="px-6 sm:px-8 py-5 sm:py-6 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-2xl sm:text-3xl font-light text-[#1C1C1E] mb-1">Draft Listings</h3>
                <p className="text-sm sm:text-base text-[#8E8E93] font-light">
                  {drafts.length} {drafts.length === 1 ? 'draft' : 'drafts'} saved
                </p>
              </div>
              <button
                onClick={() => setShowDraftsModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-[#1C1C1E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 sm:py-8 min-h-0">
              {drafts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 mb-4 sm:mb-6 rounded-full bg-gray-100 flex items-center justify-center">
                    <svg className="w-10 h-10 sm:w-12 sm:h-12 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h4 className="text-lg sm:text-xl font-light text-[#1C1C1E] mb-2">No drafts yet</h4>
                  <p className="text-sm sm:text-base text-[#8E8E93] font-light mb-6 sm:mb-8 max-w-md">
                    Start creating a listing and save it as a draft to continue later
                  </p>
                  <button
                    onClick={() => {
                      setShowDraftsModal(false);
                      handleAddListing();
                    }}
                    className="px-6 sm:px-8 py-3 sm:py-3.5 bg-[#0071E3] text-white rounded-xl text-sm sm:text-base font-medium hover:bg-[#0051D0] transition-all duration-200"
                  >
                    Create Listing
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  {drafts.map((draft, index) => (
                    <div
                      key={draft.id}
                      className="bg-gray-50 rounded-xl p-5 sm:p-6 border border-gray-200 hover:border-gray-300 transition-all duration-200 animate-fadeInUp"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className="flex items-start gap-4 mb-4 sm:mb-5">
                        {draft.imageUrl ? (
                          <img
                            src={draft.imageUrl}
                            alt={draft.title}
                            className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                            <svg className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-base sm:text-lg font-medium text-[#1C1C1E] mb-1.5 sm:mb-2 line-clamp-1">
                            {draft.title || "Untitled Listing"}
                          </h4>
                          <p className="text-xs sm:text-sm text-[#8E8E93] font-light line-clamp-2 mb-2 sm:mb-3">
                            {draft.location || "No location"}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-sm sm:text-base font-medium text-[#1C1C1E]">${draft.price || 0}</span>
                            <span className="text-xs sm:text-sm text-[#8E8E93] font-light">
                              {draft.activityType 
                                ? "/person" 
                                : draft.serviceType 
                                ? "/service" 
                                : draft.placeType || draft.subcategory || draft.category === "place" || (draft.category && !draft.activityType && !draft.serviceType)
                                ? "/night" 
                                : "/person"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <button
                          onClick={() => {
                            setShowDraftsModal(false);
                            handleEditDraft(draft.id);
                          }}
                          className="flex-1 px-4 sm:px-5 py-2.5 sm:py-3 bg-[#0071E3] text-white rounded-lg text-sm sm:text-base font-medium hover:bg-[#0051D0] transition-colors duration-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteDraft(draft.id)}
                          className="px-3 sm:px-4 py-2.5 sm:py-3 bg-red-500 text-white rounded-lg text-sm sm:text-base font-medium hover:bg-red-600 transition-colors duration-200"
                          title="Delete draft"
                        >
                          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Subscription Payment Modal */}
      {showUpgradeModal && createPortal(
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 animate-fadeIn overflow-y-auto">
          {/* Blurred Background Overlay */}
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-md"
            onClick={() => !processingPayment && setShowUpgradeModal(false)}
          />

          {/* Modal Content */}
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-5xl w-full overflow-hidden animate-scaleIn my-8">
            <div className="p-6 sm:p-8">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl sm:text-3xl font-light text-[#1C1C1E] mb-2">
                    Choose Your Plan
                  </h3>
                  <p className="text-sm text-[#8E8E93] font-light">
                    {subscriptionInfo.activeCount >= subscriptionInfo.limit 
                      ? `You've reached your ${subscriptionInfo.plan.charAt(0).toUpperCase() + subscriptionInfo.plan.slice(1)} plan limit of ${subscriptionInfo.limit} active listings.`
                      : "Select or upgrade your subscription plan."
                    }
                  </p>
                </div>
                {!processingPayment && (
                  <button
                    onClick={() => setShowUpgradeModal(false)}
                    className="text-[#8E8E93] hover:text-[#1C1C1E] transition-colors flex-shrink-0"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Current Usage */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-light text-[#1C1C1E]">Current Usage:</span>
                  <span className="text-lg font-medium text-[#FF3B30]">
                    {subscriptionInfo.activeCount} / {subscriptionInfo.limit} listings
                  </span>
                </div>
              </div>

              {/* All Plans */}
              <div className="mb-6">
                <h4 className="text-lg font-light text-[#1C1C1E] mb-4">Available Plans:</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(() => {
                    const allPlans = [
                      {
                        id: "starter",
                        name: "Starter",
                        price: 29,
                        listings: 3,
                        description: "Perfect for new hosts",
                      },
                      {
                        id: "pro",
                        name: "Pro",
                        price: 79,
                        listings: 10,
                        description: "Ideal for growing hosts",
                        popular: true,
                      },
                      {
                        id: "elite",
                        name: "Elite",
                        price: 199,
                        listings: 1000,
                        description: "Best for businesses",
                      },
                    ];

                    return allPlans.map((plan) => {
                      const isCurrentPlan = plan.id === subscriptionInfo.plan;
                      return (
                        <div
                          key={plan.id}
                          className={`relative bg-white border-2 rounded-2xl p-6 transition-all duration-300 hover:shadow-lg cursor-pointer ${
                            isCurrentPlan
                              ? "border-[#34C759] shadow-md bg-[#34C759]/5"
                              : selectedPlan?.id === plan.id
                              ? "border-[#0071E3] shadow-md"
                              : plan.popular
                              ? "border-[#0071E3] shadow-sm"
                              : "border-gray-200 hover:border-[#0071E3]/50"
                          }`}
                          onClick={() => !processingPayment && setSelectedPlan(plan)}
                        >
                          {isCurrentPlan && (
                            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-[#34C759] text-white px-3 py-1 rounded-full text-xs font-medium">
                              Current Plan
                            </div>
                          )}
                          {plan.popular && !isCurrentPlan && (
                            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-[#0071E3] text-white px-3 py-1 rounded-full text-xs font-medium">
                              Most Popular
                            </div>
                          )}
                          <h5 className="text-xl font-light text-[#1C1C1E] mb-2">{plan.name}</h5>
                          <div className="mb-3">
                            <span className="text-3xl font-light text-[#1C1C1E]">${plan.price}</span>
                            <span className="text-sm text-[#8E8E93] font-light"> / year</span>
                          </div>
                          <div className="space-y-2 mb-4">
                            <div className="flex items-center gap-2">
                              <svg className="w-5 h-5 text-[#34C759]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="text-sm font-light text-[#1C1C1E]">
                                {plan.listings === 1000 ? "Unlimited" : plan.listings} listings
                              </span>
                            </div>
                            <p className="text-xs text-[#8E8E93] font-light">{plan.description}</p>
                          </div>
                          {selectedPlan?.id === plan.id && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <div className="flex items-center justify-center gap-2 text-sm text-[#34C759] font-medium">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Selected
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Payment Section - Only show if a plan is selected */}
              {selectedPlan && !processingPayment && (
                <div className="border-t border-gray-200 pt-6 mt-6">
                  <div className="max-w-md mx-auto">
                    <div className="bg-gray-50 rounded-xl p-4 mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-light text-[#1C1C1E]">Selected Plan:</span>
                        <span className="text-lg font-medium text-[#1C1C1E]">{selectedPlan.name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-light text-[#1C1C1E]">Total:</span>
                        <span className="text-2xl font-light text-[#1C1C1E]">${selectedPlan.price}</span>
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
                          <>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-[#8E8E93] font-light">Wallet Balance:</span>
                              <span className={`text-lg font-medium ${
                                walletBalance >= selectedPlan.price ? "text-[#34C759]" : "text-[#FF3B30]"
                              }`}>
                                ${walletBalance.toFixed(2)}
                              </span>
                            </div>
                            {walletBalance < selectedPlan.price && (
                              <p className="text-xs text-[#FF3B30] font-light mt-2">
                                Insufficient balance. You need ${(selectedPlan.price - walletBalance).toFixed(2)} more.
                              </p>
                            )}
                          </>
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
                                  description: `${selectedPlan.name} Plan - Annual Subscription`,
                                  amount: {
                                    currency_code: "USD",
                                    value: selectedPlan.price.toString(),
                                  },
                                },
                              ],
                            });
                          }}
                          onApprove={async (data, actions) => {
                            const details = await actions.order.capture();
                            await handlePayPalPaymentSuccess(details, selectedPlan);
                          }}
                          onError={(err) => {
                            console.error("PayPal error:", err);
                            alert("Payment error. Please try again.");
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
                        onClick={() => handleWalletPayment(selectedPlan)}
                        disabled={checkingWallet || walletBalance < selectedPlan.price}
                        className={`w-full py-4 rounded-xl text-base font-medium transition-all duration-200 ${
                          checkingWallet || walletBalance < selectedPlan.price
                            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                            : "bg-[#34C759] text-white hover:bg-[#30D158] shadow-sm hover:shadow-md"
                        }`}
                      >
                        {checkingWallet ? (
                          "Checking Balance..."
                        ) : walletBalance < selectedPlan.price ? (
                          "Insufficient Balance"
                        ) : (
                          `Pay $${selectedPlan.price} with E-Wallet`
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Processing Payment Overlay */}
              {processingPayment && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center rounded-3xl">
                  <div className="text-center">
                    <div className="w-16 h-16 border-4 border-[#0071E3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-lg font-light text-[#1C1C1E]">Processing payment...</p>
                    <p className="text-sm text-[#8E8E93] font-light mt-2">Please wait</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

const HostBookingsContent = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState("underReview");
  const [unreadCounts, setUnreadCounts] = useState({});

  useEffect(() => {
    if (!currentUser) return;
    fetchBookings();
  }, [currentUser]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, "bookings"),
        where("hostId", "==", currentUser.uid)
      );
      const querySnapshot = await getDocs(q);
      const bookingsData = [];
      querySnapshot.forEach((doc) => {
        bookingsData.push({
          id: doc.id,
          ...doc.data(),
        });
      });
      bookingsData.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA;
      });
      setBookings(bookingsData);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch unread message counts
  useEffect(() => {
    if (!currentUser || bookings.length === 0) return;
    const unsubscribes = [];
    const counts = {};
    bookings.forEach((booking) => {
      const messagesQuery = query(
        collection(db, "messages"),
        where("bookingId", "==", booking.id),
        where("receiverId", "==", currentUser.uid),
        where("read", "==", false)
      );
      const unsubscribe = onSnapshot(
        messagesQuery,
        (snapshot) => {
          counts[booking.id] = snapshot.size;
          setUnreadCounts({ ...counts });
        },
        (error) => {
          if (error.code !== "failed-precondition") {
            console.error("Error fetching unread count for booking", booking.id, error);
          }
        }
      );
      unsubscribes.push(unsubscribe);
    });
    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [bookings, currentUser]);

  // Filter bookings
  const filteredBookings = bookings.filter((booking) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkInDate = new Date(booking.checkIn);
    checkInDate.setHours(0, 0, 0, 0);

    switch (selectedFilter) {
      case "underReview":
        return booking.status === "pending";
      case "today":
        return booking.status === "confirmed" && 
               checkInDate.getTime() === today.getTime();
      case "upcoming":
        return booking.status === "confirmed" && 
               checkInDate.getTime() > today.getTime();
      case "rejected":
        return booking.status === "rejected" || booking.status === "cancelled";
      default:
        return true;
    }
  });

  // Calculate stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pendingBookings = bookings.filter(b => b.status === "pending");
  const todayBookings = bookings.filter(b => {
    if (b.status !== "confirmed") return false;
    const checkIn = new Date(b.checkIn);
    checkIn.setHours(0, 0, 0, 0);
    return checkIn.getTime() === today.getTime();
  });
  const upcomingBookings = bookings.filter(b => {
    if (b.status !== "confirmed") return false;
    const checkIn = new Date(b.checkIn);
    checkIn.setHours(0, 0, 0, 0);
    return checkIn.getTime() > today.getTime();
  });
  const rejectedBookings = bookings.filter(b => 
    b.status === "rejected" || b.status === "cancelled"
  );

  const handleUpdateBookingStatus = async (bookingId, newStatus) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) {
      alert("Booking not found.");
      return;
    }

    if (newStatus === "confirmed") {
      if (booking.paymentStatus !== "paid") {
        alert("❌ Cannot confirm booking. Payment has not been completed.");
        return;
      }

      try {
        const checkInDate = new Date(booking.checkIn);
        const checkOutDate = new Date(booking.checkOut);
        let hasConflict = false;
        let conflictInfo = null;

        bookings.forEach((existingBooking) => {
          if (existingBooking.id === bookingId) return;
          if (existingBooking.listingId !== booking.listingId) return;
          if (existingBooking.status !== "confirmed") return;
          
          const existingCheckIn = new Date(existingBooking.checkIn);
          const existingCheckOut = new Date(existingBooking.checkOut);
          
          if (checkInDate < existingCheckOut && checkOutDate > existingCheckIn) {
            hasConflict = true;
            conflictInfo = {
              checkIn: existingBooking.checkIn,
              checkOut: existingBooking.checkOut,
            };
          }
        });

        if (hasConflict) {
          alert(`❌ Cannot confirm booking. These dates conflict with an existing confirmed booking:\n${new Date(conflictInfo.checkIn).toLocaleDateString()} - ${new Date(conflictInfo.checkOut).toLocaleDateString()}`);
          return;
        }
      } catch (error) {
        console.error("Error checking for conflicts:", error);
        alert("Failed to check for date conflicts. Please try again.");
        return;
      }
    }

    const actionText = newStatus === "confirmed" ? "accept" : newStatus === "rejected" ? "reject" : newStatus;
    if (!window.confirm(`Are you sure you want to ${actionText} this booking?`)) {
      return;
    }

    try {
      // Update booking status
      await updateDoc(doc(db, "bookings", bookingId), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });

      // Handle wallet transfers
      const bookingAmount = booking.totalPrice || 0;
      
      if (newStatus === "confirmed") {
        // Add to host's pending balance (not actual wallet - money is held by admin)
        const hostRef = doc(db, "users", booking.hostId);
        const hostDoc = await getDoc(hostRef);
        
        if (hostDoc.exists()) {
          const hostData = hostDoc.data();
          const currentPendingBalance = hostData.pendingBalance || 0;
          const hostTransactions = hostData.transactions || [];
          
          const hostTransaction = {
            type: "booking_pending",
            amount: bookingAmount,
            bookingId: bookingId,
            date: new Date().toISOString(),
            status: "pending", // Pending until withdrawal
            description: `Pending payment for booking: ${booking.listingTitle || "Booking"}`,
            withdrawalRequestId: null // Will be set when withdrawal is requested
          };
          
          await updateDoc(hostRef, {
            pendingBalance: currentPendingBalance + bookingAmount,
            transactions: [hostTransaction, ...hostTransactions].slice(0, 10)
          });
        }
        
        // Record payment to admin (money goes to admin's PayPal)
        // Note: Actual PayPal transfer to admin would be handled by backend/webhook
        // For now, we'll track it in a separate collection
        try {
          await addDoc(collection(db, "adminPayments"), {
            bookingId: bookingId,
            hostId: booking.hostId,
            guestId: booking.guestId,
            amount: bookingAmount,
            status: "received", // Money received by admin
            paymentMethod: booking.paymentMethod || "paypal",
            paypalOrderId: booking.paypalOrderId || null,
            createdAt: serverTimestamp(),
            withdrawalRequestId: null // Will be set when host requests withdrawal
          });
        } catch (error) {
          console.error("Error recording admin payment:", error);
        }

        // Award points to host for accepting booking (same as guest gets for making booking)
        try {
          await awardPoints(booking.hostId, POINTS_PER_BOOKING, "booking_accepted", bookingId);
          console.log("✅ Points awarded to host for accepting booking");
        } catch (pointsError) {
          console.error("Error awarding points:", pointsError);
          // Don't fail the booking if points fail
        }
      } else if (newStatus === "rejected") {
        // Refund money to guest's wallet
        const guestRef = doc(db, "users", booking.guestId);
        const guestDoc = await getDoc(guestRef);
        
        if (guestDoc.exists()) {
          const guestData = guestDoc.data();
          const currentGuestBalance = guestData.walletBalance || 0;
          const guestTransactions = guestData.transactions || [];
          
          const guestTransaction = {
            type: "booking_refund",
            amount: bookingAmount,
            bookingId: bookingId,
            date: new Date().toISOString(),
            status: "completed",
            description: `Refund for rejected booking: ${booking.listingTitle || "Booking"}`
          };
          
          await updateDoc(guestRef, {
            walletBalance: currentGuestBalance + bookingAmount,
            transactions: [guestTransaction, ...guestTransactions].slice(0, 10)
          });
        }

        // Send system message to guest about rejection and refund
        try {
          const conversationId = bookingId; // Use bookingId as conversationId
          const systemMessage = {
            bookingId: bookingId,
            conversationId: conversationId,
            senderId: "system", // System sender
            senderName: "System",
            senderEmail: "system@voyago.com",
            receiverId: booking.guestId,
            receiverEmail: booking.guestEmail || "",
            message: `Your booking for "${booking.listingTitle || "this listing"}" has been rejected. $${bookingAmount.toFixed(2)} was refunded to your wallet.`,
            isSystem: true,
            systemType: "booking_rejected",
            createdAt: serverTimestamp(),
            read: false,
          };
          
          await addDoc(collection(db, "messages"), systemMessage);
        } catch (messageError) {
          console.error("Error sending system message:", messageError);
          // Don't fail the whole operation if message fails
        }
      }
      
      await fetchBookings();
      alert(`Booking ${actionText === "accept" ? "accepted" : actionText === "reject" ? "rejected" : newStatus} successfully! ${newStatus === "confirmed" ? `$${bookingAmount.toFixed(2)} has been added to your pending balance. Request withdrawal to receive funds.` : newStatus === "rejected" ? `$${bookingAmount.toFixed(2)} has been refunded to the guest.` : ""}`);
    } catch (error) {
      console.error("Error updating booking status:", error);
      alert("Failed to update booking status. Please try again.");
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "confirmed":
      case "active":
        return "bg-[#34C759]/10 text-[#34C759]";
      case "pending":
        return "bg-[#FF9500]/10 text-[#FF9500]";
      case "rejected":
      case "cancelled":
      case "inactive":
        return "bg-red-100 text-red-700";
      case "completed":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 animate-fadeInUp">
        <div className="text-center py-12">
          <div className="w-16 h-16 border-4 border-[#0071E3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#8E8E93] font-light">Loading bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 animate-fadeInUp">
      <div className="mb-6">
        <h2 className="text-2xl font-light text-[#1C1C1E] mb-4">Manage Bookings</h2>
        
        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 sm:gap-3 border-b border-gray-200 pb-2">
          <button
            onClick={() => setSelectedFilter("underReview")}
            className={`px-4 sm:px-6 py-2 sm:py-3 rounded-t-lg text-sm sm:text-base font-light transition-all border-b-2 ${
              selectedFilter === "underReview"
                ? "border-[#FF9500] text-[#FF9500]"
                : "border-transparent text-[#1C1C1E]/70 hover:text-[#1C1C1E]"
            }`}
          >
            Under Review ({pendingBookings.length})
          </button>
          <button
            onClick={() => setSelectedFilter("today")}
            className={`px-4 sm:px-6 py-2 sm:py-3 rounded-t-lg text-sm sm:text-base font-light transition-all border-b-2 ${
              selectedFilter === "today"
                ? "border-[#FF9500] text-[#FF9500]"
                : "border-transparent text-[#1C1C1E]/70 hover:text-[#1C1C1E]"
            }`}
          >
            Today ({todayBookings.length})
          </button>
          <button
            onClick={() => setSelectedFilter("upcoming")}
            className={`px-4 sm:px-6 py-2 sm:py-3 rounded-t-lg text-sm sm:text-base font-light transition-all border-b-2 ${
              selectedFilter === "upcoming"
                ? "border-[#FF9500] text-[#FF9500]"
                : "border-transparent text-[#1C1C1E]/70 hover:text-[#1C1C1E]"
            }`}
          >
            Upcoming ({upcomingBookings.length})
          </button>
          <button
            onClick={() => setSelectedFilter("rejected")}
            className={`px-4 sm:px-6 py-2 sm:py-3 rounded-t-lg text-sm sm:text-base font-light transition-all border-b-2 ${
              selectedFilter === "rejected"
                ? "border-[#FF9500] text-[#FF9500]"
                : "border-transparent text-[#1C1C1E]/70 hover:text-[#1C1C1E]"
            }`}
          >
            Rejected / Cancelled ({rejectedBookings.length})
          </button>
        </div>
      </div>

      {filteredBookings.length === 0 ? (
        <div className="text-center py-12 sm:py-16">
          <div className="text-5xl sm:text-6xl mb-4 sm:mb-6">📅</div>
          <h2 className="text-2xl sm:text-3xl font-light text-[#1C1C1E] mb-2">
            {selectedFilter === "underReview" && "No bookings under review"}
            {selectedFilter === "today" && "No bookings today"}
            {selectedFilter === "upcoming" && "No upcoming bookings"}
            {selectedFilter === "rejected" && "No rejected or cancelled bookings"}
          </h2>
          <p className="text-[#1C1C1E]/70 font-light">
            {selectedFilter === "underReview" && "Pending booking requests will appear here."}
            {selectedFilter === "today" && "Accepted bookings for today will appear here."}
            {selectedFilter === "upcoming" && "Future accepted bookings will appear here."}
            {selectedFilter === "rejected" && "Rejected or cancelled bookings will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {filteredBookings.map((booking) => (
            <div
              key={booking.id}
              className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 p-4 sm:p-6"
            >
              <div className="flex flex-col md:flex-row gap-4 sm:gap-6">
                {/* Image */}
                <Link
                  to={`/listing/${booking.listingId}`}
                  className="flex-shrink-0 w-full md:w-32 h-32 rounded-lg overflow-hidden bg-gray-100"
                >
                  {booking.listingImageUrl ? (
                    <img
                      src={booking.listingImageUrl}
                      alt={booking.listingTitle}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">
                      🏠
                    </div>
                  )}
                </Link>

                {/* Details */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <Link
                        to={`/listing/${booking.listingId}`}
                        className="text-lg sm:text-xl font-light text-[#1C1C1E] mb-2 hover:text-[#0071E3] transition-colors block"
                      >
                        {booking.listingTitle}
                      </Link>
                      <div className="flex items-center gap-4 mb-3">
                        <p className="text-base sm:text-lg font-light text-[#1C1C1E]">
                          Total: <span className="font-medium">${booking.totalPrice?.toFixed(2) || "0.00"}</span>
                        </p>
                        <span
                          className={`px-3 py-1 rounded-full text-xs sm:text-sm font-light capitalize ${getStatusBadge(
                            booking.status
                          )}`}
                        >
                          {booking.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Guest Information */}
                  <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {booking.guestPhotoUrl ? (
                        <img
                          src={booking.guestPhotoUrl}
                          alt={booking.guestName || "Guest"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-lg text-gray-500">
                          {(booking.guestName || booking.guestEmail || "G")[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm sm:text-base font-light text-[#1C1C1E] truncate">
                        {booking.guestName || "Guest"}
                      </p>
                      <p className="text-xs sm:text-sm text-[#1C1C1E]/70 font-light truncate">
                        {booking.guestEmail}
                      </p>
                    </div>
                  </div>

                  {/* Booking Dates */}
                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div>
                      <p className="text-[#1C1C1E]/70 font-light text-xs mb-1">Check-in</p>
                      <p className="text-[#1C1C1E] font-light">
                        {new Date(booking.checkIn).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#1C1C1E]/70 font-light text-xs mb-1">Check-out</p>
                      <p className="text-[#1C1C1E] font-light">
                        {new Date(booking.checkOut).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 sm:gap-3">
                    <Link
                      to={`/chat/${booking.id}`}
                      className="relative px-4 sm:px-6 py-2 sm:py-3 bg-[#0071E3] text-white rounded-lg text-xs sm:text-sm font-light hover:bg-[#0051D0] transition-colors"
                    >
                      View
                      {unreadCounts[booking.id] > 0 && (
                        <span className="absolute -top-1 -right-1 bg-[#FF3B30] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                          {(unreadCounts[booking.id] || 0) > 9 ? '9+' : unreadCounts[booking.id]}
                        </span>
                      )}
                    </Link>
                    {booking.status === "pending" && (
                      <>
                        <button
                          onClick={() => handleUpdateBookingStatus(booking.id, "confirmed")}
                          className="px-4 sm:px-6 py-2 sm:py-3 bg-[#34C759] text-white rounded-lg text-xs sm:text-sm font-light hover:bg-[#2FAE4A] transition-colors"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleUpdateBookingStatus(booking.id, "rejected")}
                          className="px-4 sm:px-6 py-2 sm:py-3 bg-red-50 text-red-600 rounded-lg text-xs sm:text-sm font-light hover:bg-red-100 transition-colors"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const HostCalendarContent = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookedDates, setBookedDates] = useState(new Set());
  const [blockedDates, setBlockedDates] = useState(new Set());
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch booked dates and blocked dates
  useEffect(() => {
    if (!currentUser) return;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch booked dates
        const bookingsQuery = query(
          collection(db, "bookings"),
          where("hostId", "==", currentUser.uid),
          where("status", "in", ["confirmed", "pending"])
        );
        const snapshot = await getDocs(bookingsQuery);
        const dates = new Set();
        
        snapshot.forEach(doc => {
          const booking = doc.data();
          if (booking.checkIn && booking.checkOut) {
            const checkIn = new Date(booking.checkIn);
            const checkOut = new Date(booking.checkOut);
            const current = new Date(checkIn);
            
            while (current <= checkOut) {
              dates.add(current.toISOString().split('T')[0]);
              current.setDate(current.getDate() + 1);
            }
          }
        });
        
        setBookedDates(dates);
        
        // Fetch blocked dates from user document
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.blockedDates && Array.isArray(userData.blockedDates)) {
            setBlockedDates(new Set(userData.blockedDates));
          }
        }
      } catch (error) {
        console.error("Error fetching calendar data:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [currentUser]);

  // Save blocked dates to Firestore
  const saveBlockedDates = async (newBlockedDates) => {
    if (!currentUser || saving) return;
    
    try {
      setSaving(true);
      const blockedDatesArray = Array.from(newBlockedDates);
      
      await updateDoc(doc(db, "users", currentUser.uid), {
        blockedDates: blockedDatesArray,
        blockedDatesUpdatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error saving blocked dates:", error);
      alert("Failed to save blocked dates. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const formatDateLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    // Adjust to start with Monday (0 = Monday, 6 = Sunday)
    const adjustedStart = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;
    
    const days = [];
    // Get last few days of previous month
    const prevMonth = new Date(year, month, 0);
    const prevMonthDays = prevMonth.getDate();
    for (let i = adjustedStart - 1; i >= 0; i--) {
      days.push(new Date(year, month - 1, prevMonthDays - i));
    }
    // Add all days of the current month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    // Add first few days of next month to complete the grid
    const remainingCells = 42 - days.length; // 6 rows * 7 days
    for (let day = 1; day <= remainingCells; day++) {
      days.push(new Date(year, month + 1, day));
    }
    return days;
  };

  const navigateMonth = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  const navigateYear = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setFullYear(prev.getFullYear() + direction);
      return newDate;
    });
  };

  const handleBlockWeekends = async () => {
    if (saving) return;
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const newBlockedDates = new Set(blockedDates);
    
    // Check if all weekends in this month are already blocked
    let allWeekendsBlocked = true;
    for (let day = 1; day <= lastDay; day++) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        const dateStr = formatDateLocal(date);
        if (!bookedDates.has(dateStr) && !newBlockedDates.has(dateStr)) {
          allWeekendsBlocked = false;
          break;
        }
      }
    }
    
    // Toggle: if all weekends are blocked, unblock them; otherwise, block them
    for (let day = 1; day <= lastDay; day++) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();
      // Saturday = 6, Sunday = 0
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        const dateStr = formatDateLocal(date);
        // Only block/unblock if not already booked
        if (!bookedDates.has(dateStr)) {
          if (allWeekendsBlocked) {
            // Unblock
            newBlockedDates.delete(dateStr);
          } else {
            // Block
            newBlockedDates.add(dateStr);
          }
        }
      }
    }
    
    setBlockedDates(newBlockedDates);
    await saveBlockedDates(newBlockedDates);
  };

  const handleDateClick = async (date) => {
    if (!isCurrentMonth(date) || saving) return; // Can't block dates from other months
    
    const dateStr = formatDateLocal(date);
    
    // Can't block booked dates
    if (bookedDates.has(dateStr)) {
      return;
    }
    
    const newBlockedDates = new Set(blockedDates);
    
    if (newBlockedDates.has(dateStr)) {
      // Unblock
      newBlockedDates.delete(dateStr);
    } else {
      // Block
      newBlockedDates.add(dateStr);
    }
    
    // Update state immediately for instant feedback
    setBlockedDates(newBlockedDates);
    
    // Save to Firestore without blocking UI
    saveBlockedDates(newBlockedDates).catch(err => {
      // Revert on error
      setBlockedDates(blockedDates);
      console.error("Error saving blocked date:", err);
    });
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const days = getDaysInMonth(currentDate);
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const isCurrentMonth = (date) => {
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  };

  const isWeekend = (date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  // Check if weekends are blocked for current month
  const areWeekendsBlocked = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    
    for (let day = 1; day <= lastDay; day++) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        const dateStr = formatDateLocal(date);
        if (!bookedDates.has(dateStr) && !blockedDates.has(dateStr)) {
          return false;
        }
      }
    }
    return true;
  };

  return (
    <div className="animate-fadeInUp h-[calc(100vh-8rem)] flex flex-col -mx-4 sm:-mx-6 lg:-mx-8">
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100 w-full flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#1C1C1E] mb-1">Host Calendar</h2>
            <p className="text-xs sm:text-sm text-[#8E8E93] font-light">
              Click on any date to block or unblock it
            </p>
          </div>
          <div className="flex items-center gap-3">
            {saving && (
              <div className="flex items-center gap-1.5 text-xs text-[#8E8E93]">
                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Saving...</span>
              </div>
            )}
            <button
              onClick={handleBlockWeekends}
              disabled={saving || loading}
              className="px-3 py-1.5 bg-[#0071E3] text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-[#0051D0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {areWeekendsBlocked() ? "Unblock Weekends" : "Block Weekends"}
            </button>
          </div>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 mb-3 flex-shrink-0">
          <button
            onClick={() => navigateYear(-1)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <svg className="w-4 h-4 text-[#1C1C1E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => navigateMonth(-1)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <svg className="w-4 h-4 text-[#1C1C1E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 className="text-base sm:text-lg font-semibold text-[#1C1C1E] min-w-[140px] sm:min-w-[180px] text-center">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h3>
          <button
            onClick={() => navigateMonth(1)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <svg className="w-4 h-4 text-[#1C1C1E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={() => navigateYear(1)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <svg className="w-4 h-4 text-[#1C1C1E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <div className="text-[#8E8E93] font-light text-sm">Loading calendar...</div>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-1 flex-shrink-0">
              {dayNames.map(day => (
                <div key={day} className="text-center text-xs sm:text-sm font-semibold text-[#1C1C1E] py-1.5 sm:py-2 border-b border-gray-200">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 flex-1 min-h-0 auto-rows-fr">
              {days.map((date, index) => {
                const dateStr = formatDateLocal(date);
                const isBooked = bookedDates.has(dateStr);
                const isBlocked = blockedDates.has(dateStr);
                const isCurrentMonthDate = isCurrentMonth(date);
                const isWeekendDate = isWeekend(date);
                const canBlock = isCurrentMonthDate && !isBooked;
                
                return (
                  <button
                    key={`${dateStr}-${index}`}
                    onClick={() => canBlock && handleDateClick(date)}
                    disabled={!canBlock || saving}
                    className={`flex items-center justify-center rounded-lg text-sm sm:text-base font-light transition-colors ${
                      !isCurrentMonthDate
                        ? "text-gray-300 cursor-default"
                        : isBooked
                        ? "bg-[#FF3B30]/10 text-[#FF3B30] cursor-not-allowed"
                        : isBlocked
                        ? "bg-gray-100 text-gray-400 cursor-pointer hover:bg-gray-200"
                        : isWeekendDate
                        ? "text-[#FF3B30] cursor-pointer hover:bg-gray-50"
                        : "text-[#1C1C1E] cursor-pointer hover:bg-gray-50"
                    }`}
                    title={isBooked ? "Booked - Cannot block" : isBlocked ? "Click to unblock this date" : canBlock ? "Click to block this date" : ""}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
            
            {/* Legend */}
            <div className="flex items-center gap-4 sm:gap-6 pt-3 border-t border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-[#FF3B30]"></div>
                <span className="text-xs sm:text-sm text-[#1C1C1E] font-light">Booked</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-gray-100"></div>
                <span className="text-xs sm:text-sm text-[#1C1C1E] font-light">Blocked</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const HostMessagesContent = ({ navigate }) => {
  const { currentUser, userRole } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedOtherUserId, setSelectedOtherUserId] = useState(null);
  const [selectedBookingIds, setSelectedBookingIds] = useState([]);
  const [otherUserData, setOtherUserData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Fetch conversations
  useEffect(() => {
    if (!currentUser || userRole !== "host") return;

    const fetchConversations = async () => {
      try {
        setLoading(true);
        const bookingsQuery = query(
          collection(db, "bookings"),
          where("hostId", "==", currentUser.uid)
        );

        const snapshot = await getDocs(bookingsQuery);
        const bookingsByGuest = new Map();

        for (const docSnap of snapshot.docs) {
          const bookingData = { id: docSnap.id, ...docSnap.data() };
          const guestId = bookingData.guestId;

          if (!bookingsByGuest.has(guestId)) {
            bookingsByGuest.set(guestId, {
              bookings: [],
              userData: null,
              lastMessage: null,
              unreadCount: 0
            });
          }

          bookingsByGuest.get(guestId).bookings.push(bookingData);
        }

        // Fetch guest user data and last messages
        for (const [guestId, convData] of bookingsByGuest.entries()) {
          try {
            const userDoc = await getDoc(doc(db, "users", guestId));
            if (userDoc.exists()) {
              convData.userData = { id: userDoc.id, ...userDoc.data() };
            }

            // Get last message from all bookings
            if (convData.bookings.length > 0) {
              const allBookingIds = convData.bookings.map(b => b.id);
              const messagesQuery = query(
                collection(db, "messages"),
                where("bookingId", "in", allBookingIds),
                orderBy("createdAt", "desc"),
                limit(1)
              );
              const messagesSnapshot = await getDocs(messagesQuery);
              if (!messagesSnapshot.empty) {
                convData.lastMessage = { id: messagesSnapshot.docs[0].id, ...messagesSnapshot.docs[0].data() };
              }

              // Count unread messages
              const unreadQuery = query(
                collection(db, "messages"),
                where("bookingId", "in", allBookingIds),
                where("receiverId", "==", currentUser.uid),
                where("read", "==", false)
              );
              const unreadSnapshot = await getDocs(unreadQuery);
              convData.unreadCount = unreadSnapshot.size;
            }
          } catch (error) {
            console.error("Error fetching guest data:", error);
          }
        }

        // Also fetch message-only conversations (without bookings)
        try {
          // Query messages where host is receiver or sender
          const sentMessagesQuery = query(
            collection(db, "messages"),
            where("senderId", "==", currentUser.uid)
          );
          const receivedMessagesQuery = query(
            collection(db, "messages"),
            where("receiverId", "==", currentUser.uid)
          );

          const [sentSnapshot, receivedSnapshot] = await Promise.all([
            getDocs(sentMessagesQuery),
            getDocs(receivedMessagesQuery)
          ]);

          const messagesByGuest = new Map();

          // Process sent messages
          sentSnapshot.forEach(doc => {
            const msg = doc.data();
            if (msg.conversationId && !msg.bookingId) {
              const parts = msg.conversationId.split('_');
              const guestId = parts[0] === currentUser.uid ? parts[1] : parts[0];
              
              if (!bookingsByGuest.has(guestId) && !messagesByGuest.has(guestId)) {
                messagesByGuest.set(guestId, {
                  bookings: [],
                  lastMessage: msg,
                  unreadCount: 0,
                  lastActivityTime: new Date(msg.createdAt || 0).getTime()
                });
              } else if (messagesByGuest.has(guestId)) {
                const conv = messagesByGuest.get(guestId);
                const msgTime = new Date(msg.createdAt || 0).getTime();
                if (msgTime > conv.lastActivityTime) {
                  conv.lastMessage = msg;
                  conv.lastActivityTime = msgTime;
                }
              }
            }
          });

          // Process received messages
          receivedSnapshot.forEach(doc => {
            const msg = doc.data();
            if (msg.conversationId && !msg.bookingId) {
              const parts = msg.conversationId.split('_');
              const guestId = parts[0] === currentUser.uid ? parts[1] : parts[0];
              
              if (!bookingsByGuest.has(guestId)) {
                if (!messagesByGuest.has(guestId)) {
                  messagesByGuest.set(guestId, {
                    bookings: [],
                    lastMessage: msg,
                    unreadCount: msg.read ? 0 : 1,
                    lastActivityTime: new Date(msg.createdAt || 0).getTime()
                  });
                } else {
                  const conv = messagesByGuest.get(guestId);
                  const msgTime = new Date(msg.createdAt || 0).getTime();
                  if (msgTime > conv.lastActivityTime) {
                    conv.lastMessage = msg;
                    conv.lastActivityTime = msgTime;
                  }
                  if (!msg.read) conv.unreadCount++;
                }
              }
            }
          });

          // Fetch user data for message-only conversations
          for (const [guestId, convData] of messagesByGuest.entries()) {
            try {
              const userDoc = await getDoc(doc(db, "users", guestId));
              if (userDoc.exists()) {
                convData.userData = { id: userDoc.id, ...userDoc.data() };
              } else {
                convData.userData = {
                  name: "Guest",
                  email: "",
                  role: "guest"
                };
              }
            } catch (error) {
              console.error("Error fetching guest data for message-only conversation:", error);
            }
          }

          // Add message-only conversations to the list
          for (const [guestId, data] of messagesByGuest.entries()) {
            bookingsByGuest.set(guestId, data);
          }
        } catch (error) {
          console.error("Error fetching message-only conversations:", error);
        }

        const conversationsList = Array.from(bookingsByGuest.entries()).map(([guestId, data]) => ({
          otherUserId: guestId,
          bookings: data.bookings || [],
          userData: data.userData,
          lastMessage: data.lastMessage,
          unreadCount: data.unreadCount || 0
        }));

        conversationsList.sort((a, b) => {
          const dateA = a.lastMessage?.createdAt || a.bookings[0]?.createdAt || 0;
          const dateB = b.lastMessage?.createdAt || b.bookings[0]?.createdAt || 0;
          return new Date(dateB) - new Date(dateA);
        });

        setConversations(conversationsList);
      } catch (error) {
        console.error("Error fetching conversations:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [currentUser, userRole]);

  // Fetch messages when conversation is selected
  useEffect(() => {
    if (!selectedOtherUserId || !currentUser) {
      setMessages([]);
      return;
    }

    // Fetch other user data
    getDoc(doc(db, "users", selectedOtherUserId)).then(userDoc => {
      if (userDoc.exists()) {
        setOtherUserData({ id: userDoc.id, ...userDoc.data() });
      }
    });

    // Set up message listeners
    const unsubscribeFunctions = [];
    const allMessages = new Map();

    // Mark messages as read
    const markMessagesAsRead = async (messagesArray) => {
      if (!currentUser) return;
      
      const unreadMessages = messagesArray.filter(
        (msg) => msg.receiverId === currentUser.uid && !msg.read
      );

      if (unreadMessages.length > 0) {
        const updatePromises = unreadMessages.map((msg) =>
          updateDoc(doc(db, "messages", msg.id), {
            read: true,
            readAt: new Date().toISOString(),
          })
        );
        try {
          await Promise.all(updatePromises);
        } catch (error) {
          console.error("Error marking messages as read:", error);
        }
      }
    };

    const updateMessages = async () => {
      const messagesArray = Array.from(allMessages.values());
      messagesArray.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateA - dateB;
      });
      setMessages(messagesArray);
      
      // Mark messages as read
      markMessagesAsRead(messagesArray);
      
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    };

    // Listen to messages - handle both bookingId and conversationId
    const conversationId1 = `${currentUser.uid}_${selectedOtherUserId}`;
    const conversationId2 = `${selectedOtherUserId}_${currentUser.uid}`;

    // If there are bookings, listen to messages by bookingId (split into sent and received like guest side)
    if (selectedBookingIds.length > 0) {
      selectedBookingIds.forEach(bookingId => {
        // Sent messages (host sent to guest)
        const sentQuery = query(
          collection(db, "messages"),
          where("bookingId", "==", bookingId),
          where("senderId", "==", currentUser.uid),
          orderBy("createdAt", "asc")
        );

        const unsubscribeSent = onSnapshot(sentQuery, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added' || change.type === 'modified') {
              allMessages.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
            } else if (change.type === 'removed') {
              allMessages.delete(change.doc.id);
            }
          });
          
          // Also ensure all existing docs are in the map
          snapshot.forEach((doc) => {
            if (!allMessages.has(doc.id)) {
              allMessages.set(doc.id, { id: doc.id, ...doc.data() });
            }
          });
          
          updateMessages();
        }, (error) => {
          console.error("Error listening to sent messages:", error);
        });

        // Received messages (guest sent to host)
        const receivedQuery = query(
          collection(db, "messages"),
          where("bookingId", "==", bookingId),
          where("receiverId", "==", currentUser.uid),
          orderBy("createdAt", "asc")
        );

        const unsubscribeReceived = onSnapshot(receivedQuery, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added' || change.type === 'modified') {
              allMessages.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
            } else if (change.type === 'removed') {
              allMessages.delete(change.doc.id);
            }
          });
          
          // Also ensure all existing docs are in the map
          snapshot.forEach((doc) => {
            if (!allMessages.has(doc.id)) {
              allMessages.set(doc.id, { id: doc.id, ...doc.data() });
            }
          });
          
          updateMessages();
        }, (error) => {
          console.error("Error listening to received messages:", error);
        });

        unsubscribeFunctions.push(unsubscribeSent, unsubscribeReceived);

        // ALSO listen for messages where conversationId = bookingId (guest side uses bookingId as conversationId)
        // Split into sent and received for security rules
        const sentConvQuery = query(
          collection(db, "messages"),
          where("conversationId", "==", bookingId),
          where("senderId", "==", currentUser.uid),
          orderBy("createdAt", "asc")
        );

        const unsubscribeSentConv = onSnapshot(sentConvQuery, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added' || change.type === 'modified') {
              allMessages.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
            } else if (change.type === 'removed') {
              allMessages.delete(change.doc.id);
            }
          });
          
          snapshot.forEach((doc) => {
            if (!allMessages.has(doc.id)) {
              allMessages.set(doc.id, { id: doc.id, ...doc.data() });
            }
          });
          
          updateMessages();
        }, (error) => {
          console.error("Error listening to sent messages by conversationId (bookingId):", error);
        });

        const receivedConvQuery = query(
          collection(db, "messages"),
          where("conversationId", "==", bookingId),
          where("receiverId", "==", currentUser.uid),
          orderBy("createdAt", "asc")
        );

        const unsubscribeReceivedConv = onSnapshot(receivedConvQuery, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added' || change.type === 'modified') {
              allMessages.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
            } else if (change.type === 'removed') {
              allMessages.delete(change.doc.id);
            }
          });
          
          snapshot.forEach((doc) => {
            if (!allMessages.has(doc.id)) {
              allMessages.set(doc.id, { id: doc.id, ...doc.data() });
            }
          });
          
          updateMessages();
        }, (error) => {
          console.error("Error listening to received messages by conversationId (bookingId):", error);
        });

        unsubscribeFunctions.push(unsubscribeSentConv, unsubscribeReceivedConv);
      });

      // Also listen to messages by conversationId (in case some messages don't have bookingId)
      // Split into sent and received for security rules
      const sentQuery1 = query(
        collection(db, "messages"),
        where("conversationId", "==", conversationId1),
        where("senderId", "==", currentUser.uid),
        orderBy("createdAt", "asc")
      );

      const receivedQuery1 = query(
        collection(db, "messages"),
        where("conversationId", "==", conversationId1),
        where("receiverId", "==", currentUser.uid),
        orderBy("createdAt", "asc")
      );

      const sentQuery2 = query(
        collection(db, "messages"),
        where("conversationId", "==", conversationId2),
        where("senderId", "==", currentUser.uid),
        orderBy("createdAt", "asc")
      );

      const receivedQuery2 = query(
        collection(db, "messages"),
        where("conversationId", "==", conversationId2),
        where("receiverId", "==", currentUser.uid),
        orderBy("createdAt", "asc")
      );

      const unsubscribeSent1 = onSnapshot(sentQuery1, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            allMessages.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
          } else if (change.type === 'removed') {
            allMessages.delete(change.doc.id);
          }
        });
        
        snapshot.forEach((doc) => {
          if (!allMessages.has(doc.id)) {
            allMessages.set(doc.id, { id: doc.id, ...doc.data() });
          }
        });
        
        updateMessages();
      }, (error) => {
        console.error("Error listening to sent messages by conversationId 1:", error);
      });

      const unsubscribeReceived1 = onSnapshot(receivedQuery1, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            allMessages.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
          } else if (change.type === 'removed') {
            allMessages.delete(change.doc.id);
          }
        });
        
        snapshot.forEach((doc) => {
          if (!allMessages.has(doc.id)) {
            allMessages.set(doc.id, { id: doc.id, ...doc.data() });
          }
        });
        
        updateMessages();
      }, (error) => {
        console.error("Error listening to received messages by conversationId 1:", error);
      });

      const unsubscribeSent2 = onSnapshot(sentQuery2, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            allMessages.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
          } else if (change.type === 'removed') {
            allMessages.delete(change.doc.id);
          }
        });
        
        snapshot.forEach((doc) => {
          if (!allMessages.has(doc.id)) {
            allMessages.set(doc.id, { id: doc.id, ...doc.data() });
          }
        });
        
        updateMessages();
      }, (error) => {
        console.error("Error listening to sent messages by conversationId 2:", error);
      });

      const unsubscribeReceived2 = onSnapshot(receivedQuery2, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            allMessages.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
          } else if (change.type === 'removed') {
            allMessages.delete(change.doc.id);
          }
        });
        
        snapshot.forEach((doc) => {
          if (!allMessages.has(doc.id)) {
            allMessages.set(doc.id, { id: doc.id, ...doc.data() });
          }
        });
        
        updateMessages();
      }, (error) => {
        console.error("Error listening to received messages by conversationId 2:", error);
      });

      unsubscribeFunctions.push(unsubscribeSent1, unsubscribeReceived1, unsubscribeSent2, unsubscribeReceived2);
    } else {
      // If no bookings, listen to messages by conversationId only (split into sent and received)
      const sentQuery1 = query(
        collection(db, "messages"),
        where("conversationId", "==", conversationId1),
        where("senderId", "==", currentUser.uid),
        orderBy("createdAt", "asc")
      );

      const receivedQuery1 = query(
        collection(db, "messages"),
        where("conversationId", "==", conversationId1),
        where("receiverId", "==", currentUser.uid),
        orderBy("createdAt", "asc")
      );

      const sentQuery2 = query(
        collection(db, "messages"),
        where("conversationId", "==", conversationId2),
        where("senderId", "==", currentUser.uid),
        orderBy("createdAt", "asc")
      );

      const receivedQuery2 = query(
        collection(db, "messages"),
        where("conversationId", "==", conversationId2),
        where("receiverId", "==", currentUser.uid),
        orderBy("createdAt", "asc")
      );

      const unsubscribeSent1 = onSnapshot(sentQuery1, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            allMessages.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
          } else if (change.type === 'removed') {
            allMessages.delete(change.doc.id);
          }
        });
        
        snapshot.forEach((doc) => {
          if (!allMessages.has(doc.id)) {
            allMessages.set(doc.id, { id: doc.id, ...doc.data() });
          }
        });
        
        updateMessages();
      }, (error) => {
        console.error("Error listening to sent messages by conversationId 1:", error);
      });

      const unsubscribeReceived1 = onSnapshot(receivedQuery1, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            allMessages.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
          } else if (change.type === 'removed') {
            allMessages.delete(change.doc.id);
          }
        });
        
        snapshot.forEach((doc) => {
          if (!allMessages.has(doc.id)) {
            allMessages.set(doc.id, { id: doc.id, ...doc.data() });
          }
        });
        
        updateMessages();
      }, (error) => {
        console.error("Error listening to received messages by conversationId 1:", error);
      });

      const unsubscribeSent2 = onSnapshot(sentQuery2, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            allMessages.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
          } else if (change.type === 'removed') {
            allMessages.delete(change.doc.id);
          }
        });
        
        snapshot.forEach((doc) => {
          if (!allMessages.has(doc.id)) {
            allMessages.set(doc.id, { id: doc.id, ...doc.data() });
          }
        });
        
        updateMessages();
      }, (error) => {
        console.error("Error listening to sent messages by conversationId 2:", error);
      });

      const unsubscribeReceived2 = onSnapshot(receivedQuery2, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            allMessages.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
          } else if (change.type === 'removed') {
            allMessages.delete(change.doc.id);
          }
        });
        
        snapshot.forEach((doc) => {
          if (!allMessages.has(doc.id)) {
            allMessages.set(doc.id, { id: doc.id, ...doc.data() });
          }
        });
        
        updateMessages();
      }, (error) => {
        console.error("Error listening to received messages by conversationId 2:", error);
      });

      unsubscribeFunctions.push(unsubscribeSent1, unsubscribeReceived1, unsubscribeSent2, unsubscribeReceived2);
    }

    return () => {
      unsubscribeFunctions.forEach(unsub => unsub());
    };
  }, [selectedOtherUserId, selectedBookingIds, currentUser]);

  // Handle typing indicator
  useEffect(() => {
    if (!currentUser || !selectedOtherUserId) return;

    // Use conversationId for typing indicator
    const conversationId = selectedBookingIds.length > 0
      ? selectedBookingIds[0]
      : `${currentUser.uid}_${selectedOtherUserId}`;
    const typingDocRef = doc(db, "typing", `${conversationId}_${currentUser.uid}`);
    
    if (!newMessage.trim()) {
      setDoc(typingDocRef, {
        isTyping: false,
        userId: currentUser.uid,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      return;
    }

    setDoc(typingDocRef, {
      isTyping: true,
      userId: currentUser.uid,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setDoc(typingDocRef, {
        isTyping: false,
        userId: currentUser.uid,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }, 3000);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [newMessage, selectedBookingIds, currentUser, selectedOtherUserId]);

  // Listen for other user's typing status
  useEffect(() => {
    if (!currentUser || !selectedOtherUserId) return;

    // Use conversationId for typing indicator
    const conversationId = selectedBookingIds.length > 0
      ? selectedBookingIds[0]
      : `${currentUser.uid}_${selectedOtherUserId}`;
    const otherUserTypingDocRef = doc(db, "typing", `${conversationId}_${selectedOtherUserId}`);

    const unsubscribe = onSnapshot(
      otherUserTypingDocRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          const updatedAt = data.updatedAt?.toDate();
          const now = new Date();
          const timeDiff = updatedAt ? (now - updatedAt) / 1000 : Infinity;
          
          if (data.isTyping && timeDiff < 4) {
            setOtherUserTyping(true);
          } else {
            setOtherUserTyping(false);
          }
        } else {
          setOtherUserTyping(false);
        }
      },
      (error) => {
        console.error("Error listening to typing status:", error);
        setOtherUserTyping(false);
      }
    );

    return () => unsubscribe();
  }, [selectedBookingIds, currentUser, selectedOtherUserId]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedOtherUserId || sending) return;

    // Use the same conversationId logic as the guest side
    // When there are bookings, use bookingId as conversationId (matches guest side)
    // Otherwise, use userId_userId format
    const conversationId = selectedBookingIds.length > 0
      ? selectedBookingIds[0]
      : `${currentUser.uid}_${selectedOtherUserId}`;

    // Optimistic UI: Add message immediately to local state
    const tempMessageId = `temp_${Date.now()}`;
    const messageText = newMessage.trim();
    
    try {
      setSending(true);
      setNewMessage(""); // Clear input immediately for better UX

      const optimisticMessage = {
        id: tempMessageId,
        conversationId: conversationId,
        senderId: currentUser.uid,
        receiverId: selectedOtherUserId,
        senderEmail: currentUser.email,
        receiverEmail: otherUserData?.email || "",
        message: messageText,
        read: false,
        createdAt: new Date(), // Temporary date, will be replaced by server
        isOptimistic: true
      };

      // Add bookingId if available
      if (selectedBookingIds.length > 0) {
        optimisticMessage.bookingId = selectedBookingIds[0];
      }

      // Add to messages immediately
      setMessages(prev => {
        const updated = [...prev, optimisticMessage];
        return updated.sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
          return dateA - dateB;
        });
      });

      // Scroll to bottom immediately
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }, 50);

      const messageData = {
        conversationId: conversationId,
        senderId: currentUser.uid,
        receiverId: selectedOtherUserId,
        senderEmail: currentUser.email,
        receiverEmail: otherUserData?.email || "",
        message: messageText,
        read: false,
        createdAt: serverTimestamp()
      };

      // Add bookingId if available
      if (selectedBookingIds.length > 0) {
        messageData.bookingId = selectedBookingIds[0];
      }

      await addDoc(collection(db, "messages"), messageData);

      // Remove optimistic message once real one is added (listener will handle this)
      // The onSnapshot listener will replace it automatically
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message. Please try again.");
      setNewMessage(messageText); // Restore message on error
      
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempMessageId));
    } finally {
      setSending(false);
    }
  };

  const getOtherPartyName = () => {
    if (!otherUserData) return "Guest";
    const firstName = otherUserData.firstName || "";
    const lastName = otherUserData.lastName || "";
    if (firstName || lastName) {
      return `${firstName} ${lastName}`.trim();
    }
    return otherUserData.name || otherUserData.email || "Guest";
  };

  const getOtherPartyInitials = () => {
    if (!otherUserData) return "G";
    const firstName = otherUserData.firstName || "";
    const lastName = otherUserData.lastName || "";
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    } else if (firstName) {
      return firstName[0].toUpperCase();
    } else if (otherUserData.name) {
      const nameParts = otherUserData.name.split(" ");
      if (nameParts.length >= 2) {
        return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
      }
      return nameParts[0][0].toUpperCase();
    }
    return "G";
  };

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    const userData = conv.userData || {};
    const firstName = userData.firstName || "";
    const lastName = userData.lastName || "";
    const fullName = `${firstName} ${lastName}`.trim() || userData.name || userData.email || "";
    return fullName.toLowerCase().includes(searchLower);
  });

  return (
    <div className="h-full flex flex-col animate-fadeInUp">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex overflow-hidden min-h-0">
        {/* Conversations List */}
        <div className="w-full sm:w-80 lg:w-96 border-r border-gray-200 flex flex-col flex-shrink-0">
          <div className="p-4 sm:p-6 border-b border-gray-200">
            <h2 className="text-xl sm:text-2xl font-light text-[#1C1C1E] mb-4">Messages</h2>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-11 pr-4 py-2.5 bg-[#F2F2F7] rounded-xl text-sm text-[#1C1C1E] placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center">
                <div className="text-[#8E8E93] font-light">Loading conversations...</div>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-[#8E8E93] font-light">No conversations yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredConversations.map((conv) => {
                  const userData = conv.userData || {};
                  const firstName = userData.firstName || "";
                  const lastName = userData.lastName || "";
                  const fullName = `${firstName} ${lastName}`.trim() || userData.name || userData.email || "Guest";
                  const initials = firstName && lastName
                    ? `${firstName[0]}${lastName[0]}`.toUpperCase()
                    : firstName
                    ? firstName[0].toUpperCase()
                    : userData.name
                    ? userData.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
                    : "G";

                  return (
                    <button
                      key={conv.otherUserId}
                      onClick={() => {
                        setSelectedOtherUserId(conv.otherUserId);
                        setSelectedBookingIds(conv.bookings.map(b => b.id));
                      }}
                      className={`w-full p-4 hover:bg-gray-50 transition-colors text-left ${
                        selectedOtherUserId === conv.otherUserId ? "bg-[#0071E3]/5" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-[#0071E3]/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-medium text-[#0071E3]">{initials}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium text-[#1C1C1E] truncate">{fullName}</p>
                            {conv.unreadCount > 0 && (
                              <span className="bg-[#0071E3] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium flex-shrink-0">
                                {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                              </span>
                            )}
                          </div>
                          {conv.lastMessage && (
                            <p className="text-xs text-[#8E8E93] truncate">
                              {conv.lastMessage.message}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Messages Area */}
        {selectedOtherUserId ? (
          <div className="flex-1 flex flex-col min-w-0">
            <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#0071E3]/10 flex items-center justify-center">
                  <span className="text-sm font-medium text-[#0071E3]">{getOtherPartyInitials()}</span>
                </div>
                <div>
                  <h3 className="text-base font-medium text-[#1C1C1E]">{getOtherPartyName()}</h3>
                  <p className="text-xs text-[#8E8E93]">Guest</p>
                </div>
              </div>
            </div>

            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto bg-[#F5F5F7] px-4 sm:px-6 py-6 sm:py-8"
            >
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-[#8E8E93] text-sm font-light">
                      No messages yet. Start the conversation!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {messages.map((message, index) => {
                    const isOwnMessage = message.senderId === currentUser.uid;
                    const isSystemMessage = message.isSystem || message.senderId === "system";
                    
                    if (isSystemMessage) {
                      // Render system message with special styling
                      return (
                        <div
                          key={message.id}
                          className="flex justify-center mb-3 animate-fadeInUp"
                          style={{ animationDelay: `${index * 0.05}s` }}
                        >
                          <div className="max-w-[85%] sm:max-w-[75%]">
                            <div className="bg-[#FF9500]/10 border border-[#FF9500]/20 rounded-2xl px-5 py-4 shadow-sm">
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#34C759]/20 flex items-center justify-center mt-0.5">
                                  <svg className="w-3 h-3 text-[#34C759]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words text-[#1C1C1E]">
                                    {message.message}
                                  </p>
                                  <span className="text-xs text-[#8E8E93] mt-2 block">
                                    {(() => {
                                      try {
                                        if (!message.createdAt) return "";
                                        let date;
                                        if (message.createdAt.toDate) {
                                          date = message.createdAt.toDate();
                                        } else if (message.createdAt instanceof Date) {
                                          date = message.createdAt;
                                        } else if (typeof message.createdAt === 'string') {
                                          date = new Date(message.createdAt);
                                        } else if (message.createdAt.seconds) {
                                          date = new Date(message.createdAt.seconds * 1000);
                                        } else {
                                          date = new Date(message.createdAt);
                                        }
                                        if (isNaN(date.getTime())) return "";
                                        return date.toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        });
                                      } catch (error) {
                                        return "";
                                      }
                                    })()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOwnMessage ? "justify-end" : "justify-start"} mb-3 animate-fadeInUp`}
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        <div className={`max-w-[75%] sm:max-w-[65%] ${isOwnMessage ? "items-end" : "items-start"} flex flex-col`}>
                          <div
                            className={`px-5 py-4 rounded-2xl ${
                              isOwnMessage
                                ? "bg-[#0071E3] text-white rounded-br-sm"
                                : "bg-white text-[#1C1C1E] rounded-bl-sm shadow-sm"
                            }`}
                          >
                            <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words mb-2">
                              {message.message}
                            </p>
                            <div className={`flex items-baseline gap-2 ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                              <span
                                className={`text-xs ${
                                  isOwnMessage ? "text-white/80" : "text-[#8E8E93]"
                                }`}
                              >
                                {(() => {
                                  try {
                                    if (!message.createdAt) return "";
                                    let date;
                                    if (message.createdAt.toDate) {
                                      date = message.createdAt.toDate();
                                    } else if (message.createdAt instanceof Date) {
                                      date = message.createdAt;
                                    } else if (typeof message.createdAt === 'string') {
                                      date = new Date(message.createdAt);
                                    } else if (message.createdAt.seconds) {
                                      date = new Date(message.createdAt.seconds * 1000);
                                    } else {
                                      date = new Date(message.createdAt);
                                    }
                                    if (isNaN(date.getTime())) return "";
                                    return date.toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    });
                                  } catch (error) {
                                    return "";
                                  }
                                })()}
                              </span>
                              {isOwnMessage && (
                                <span className="text-xs text-white/80">
                                  {message.read ? "âœ“âœ“" : "âœ“"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {otherUserTyping && (
                    <div className="flex justify-start mb-3">
                      <div className="bg-white rounded-2xl rounded-bl-sm shadow-sm px-5 py-4">
                        <div className="flex gap-1.5">
                          <div className="w-2.5 h-2.5 bg-[#8E8E93] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2.5 h-2.5 bg-[#8E8E93] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2.5 h-2.5 bg-[#8E8E93] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <form onSubmit={handleSendMessage} className="border-t border-gray-200 bg-white p-4 sm:p-6">
              <div className="flex gap-3 items-end">
                <div className="flex-1 bg-[#F2F2F7] rounded-2xl px-4 py-3 border border-transparent focus-within:border-[#0071E3]/30 focus-within:bg-white transition-colors min-h-[44px] flex items-center">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="w-full bg-transparent text-sm sm:text-base text-[#1C1C1E] placeholder:text-[#8E8E93] focus:outline-none"
                    disabled={sending}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="px-6 py-3 bg-[#0071E3] text-white rounded-xl text-sm font-medium hover:bg-[#0051D0] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {sending ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Send
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-[#F5F5F7]">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-[#8E8E93] text-sm font-light">Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Listing Preview Modal Component
const ListingPreviewModal = ({ listing, onClose }) => {
  const listingImages = listing.imageUrls && Array.isArray(listing.imageUrls) && listing.imageUrls.length > 0
    ? listing.imageUrls.filter(url => url && url.trim() !== "")
    : listing.imageUrl ? [listing.imageUrl] : [];

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 animate-fadeIn"
      onClick={handleBackdropClick}
    >
      {/* Blurred Background Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />

      {/* Modal Content */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-110"
        >
          <svg className="w-6 h-6 text-[#1C1C1E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1">
          {/* Images Section */}
          {listingImages.length > 0 && (
            <div className="relative w-full h-64 sm:h-80 bg-gray-100">
              <img
                src={listingImages[0]}
                alt={listing.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Content Section */}
          <div className="p-6 sm:p-8">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-start justify-between mb-3">
                <h2 className="text-3xl sm:text-4xl font-light text-[#1C1C1E] pr-12">
                  {listing.title || "Untitled Listing"}
                </h2>
              </div>
              <p className="text-base text-[#8E8E93] font-light mb-4">
                {listing.location || "No location specified"}
              </p>
              <div className="flex items-center gap-4 flex-wrap">
                {listing.status && (
                  <span className={`px-3 py-1 rounded-full text-sm font-light capitalize ${
                    listing.status === "active" ? "bg-green-100 text-green-700" :
                    listing.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                    listing.status === "rejected" ? "bg-red-100 text-red-700" :
                    listing.status === "draft" ? "bg-orange-100 text-orange-700" :
                    "bg-gray-100 text-gray-700"
                  }`}>
                    {listing.status}
                  </span>
                )}
                {listing.price && (
                  <span className="text-2xl font-light text-[#1C1C1E]">
                    ${listing.price}<span className="text-base text-[#8E8E93]">
                      {listing.activityType 
                        ? "/person" 
                        : listing.serviceType 
                        ? "/service" 
                        : listing.placeType || listing.subcategory || listing.category === "place" || (listing.category && !listing.activityType && !listing.serviceType)
                        ? "/night" 
                        : "/person"}
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {listing.bedrooms !== undefined && (
                <div className="p-4 bg-[#F2F2F7] rounded-xl">
                  <div className="text-xs text-[#8E8E93] mb-1">Bedrooms</div>
                  <div className="text-xl font-light text-[#1C1C1E]">{listing.bedrooms || 0}</div>
                </div>
              )}
              {listing.beds !== undefined && (
                <div className="p-4 bg-[#F2F2F7] rounded-xl">
                  <div className="text-xs text-[#8E8E93] mb-1">Beds</div>
                  <div className="text-xl font-light text-[#1C1C1E]">{listing.beds || 0}</div>
                </div>
              )}
              {listing.bathrooms !== undefined && (
                <div className="p-4 bg-[#F2F2F7] rounded-xl">
                  <div className="text-xs text-[#8E8E93] mb-1">Bathrooms</div>
                  <div className="text-xl font-light text-[#1C1C1E]">{listing.bathrooms || 0}</div>
                </div>
              )}
              {listing.maxGuests && (
                <div className="p-4 bg-[#F2F2F7] rounded-xl">
                  <div className="text-xs text-[#8E8E93] mb-1">Max Guests</div>
                  <div className="text-xl font-light text-[#1C1C1E]">{listing.maxGuests}</div>
                </div>
              )}
            </div>

            {/* Description */}
            {listing.description && (
              <div className="mb-6">
                <h3 className="text-xl font-light text-[#1C1C1E] mb-3">Description</h3>
                <p className="text-base text-[#1C1C1E] font-light leading-relaxed whitespace-pre-wrap">
                  {listing.description}
                </p>
              </div>
            )}

            {/* Amenities */}
            {listing.amenities && listing.amenities.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xl font-light text-[#1C1C1E] mb-3">Amenities</h3>
                <div className="flex flex-wrap gap-2">
                  {listing.amenities.map((amenity, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-[#F2F2F7] text-[#1C1C1E] rounded-full text-sm font-light"
                    >
                      {amenity}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Additional Images */}
            {listingImages.length > 1 && (
              <div>
                <h3 className="text-xl font-light text-[#1C1C1E] mb-3">Gallery</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {listingImages.slice(1, 7).map((img, index) => (
                    <img
                      key={index}
                      src={img}
                      alt={`Gallery ${index + 2}`}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-[#8E8E93] font-light">Category: </span>
                  <span className="text-[#1C1C1E] font-light">{listing.category || "N/A"}</span>
                </div>
                {listing.placeType && (
                  <div>
                    <span className="text-[#8E8E93] font-light">Place Type: </span>
                    <span className="text-[#1C1C1E] font-light">{listing.placeType}</span>
                  </div>
                )}
                {listing.createdAt && (
                  <div>
                    <span className="text-[#8E8E93] font-light">Created: </span>
                    <span className="text-[#1C1C1E] font-light">
                      {new Date(listing.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {listing.hostEmail && (
                  <div>
                    <span className="text-[#8E8E93] font-light">Host: </span>
                    <span className="text-[#1C1C1E] font-light">{listing.hostEmail}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Reviews Modal Component
const ReviewsModal = ({ listing, reviews, loading, onClose }) => {
  const calculateAverageRating = () => {
    if (!reviews || reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, review) => acc + (review.rating || 0), 0);
    return (sum / reviews.length).toFixed(1);
  };

  const averageRating = calculateAverageRating();

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Blurred Background Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />

      {/* Modal Content */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col animate-scaleIn">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-110"
        >
          <svg className="w-6 h-6 text-[#1C1C1E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="px-6 sm:px-8 py-6 border-b border-gray-200">
          <h2 className="text-2xl sm:text-3xl font-light text-[#1C1C1E] mb-2">
            Reviews for {listing?.title || "Listing"}
          </h2>
          {reviews && reviews.length > 0 && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className={`w-5 h-5 ${i < Math.round(averageRating) ? "text-yellow-400" : "text-gray-300"}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="text-lg font-medium text-[#1C1C1E]">{averageRating}</span>
              </div>
              <span className="text-sm text-[#8E8E93] font-light">
                ({reviews.length} {reviews.length === 1 ? "review" : "reviews"})
              </span>
            </div>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 px-6 sm:px-8 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0071E3]"></div>
            </div>
          ) : reviews && reviews.length > 0 ? (
            <div className="space-y-6">
              {reviews.map((review) => (
                <div key={review.id} className="border-b border-gray-200 pb-6 last:border-b-0 last:pb-0">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#0071E3]/10 flex items-center justify-center">
                        <span className="text-[#0071E3] font-medium text-sm">
                          {review.guestName ? review.guestName.charAt(0).toUpperCase() : "G"}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-[#1C1C1E]">
                          {review.guestName || "Anonymous Guest"}
                        </div>
                        <div className="text-xs text-[#8E8E93] font-light">
                          {review.createdAt
                            ? new Date(review.createdAt.toDate ? review.createdAt.toDate() : review.createdAt).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })
                            : "Recently"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          className={`w-4 h-4 ${i < (review.rating || 0) ? "text-yellow-400" : "text-gray-300"}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-[#1C1C1E] font-light leading-relaxed whitespace-pre-wrap">
                      {review.comment}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <h3 className="text-lg font-light text-[#1C1C1E] mb-2">No reviews yet</h3>
              <p className="text-sm text-[#8E8E93] font-light max-w-md">
                This listing doesn't have any reviews yet. Reviews will appear here once guests leave feedback.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Confirmation Modal Component
const ConfirmModal = ({ title, message, type = "danger", confirmText = "Confirm", cancelText = "Cancel", onConfirm, onCancel }) => {
  const getTypeStyles = () => {
    switch (type) {
      case "danger":
        return {
          icon: (
            <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ),
          confirmButton: "bg-red-500 hover:bg-red-600 text-white",
        };
      case "warning":
        return {
          icon: (
            <svg className="w-12 h-12 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ),
          confirmButton: "bg-amber-500 hover:bg-amber-600 text-white",
        };
      default:
        return {
          icon: (
            <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          confirmButton: "bg-blue-500 hover:bg-blue-600 text-white",
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      {/* Blurred Background Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />

      {/* Modal Content */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-scaleIn">
        {/* Content */}
        <div className="p-6 sm:p-8">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            {styles.icon}
          </div>

          {/* Title */}
          <h3 className="text-xl sm:text-2xl font-light text-[#1C1C1E] text-center mb-3">
            {title}
          </h3>

          {/* Message */}
          <p className="text-sm sm:text-base text-[#8E8E93] font-light text-center mb-6 leading-relaxed">
            {message}
          </p>

          {/* Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-3 bg-gray-100 text-[#1C1C1E] rounded-xl text-sm font-medium hover:bg-gray-200 transition-all duration-200"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${styles.confirmButton}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HostHomePage;
