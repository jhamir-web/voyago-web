import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { collection, query, getDocs, onSnapshot, where, doc, getDoc, updateDoc, addDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, processPayPalPayout, checkPayPalPayoutStatus } from "../../firebase";
import { auth } from "../../firebase";
import jsPDF from "jspdf";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import ConfirmModal from "../../components/ConfirmModal";
import NotesModal from "../../components/NotesModal";
import FeePreviewModal from "../../components/FeePreviewModal";
import Toast from "../../components/Toast";

// Review Analytics Report Generation Function (moved outside component for accessibility)
const generateReviewAnalyticsReport = (data, filters = null) => {
  // Filter reviews
  let filteredReviews = data.reviews || [];
  
  // Only include approved reviews
  filteredReviews = filteredReviews.filter(r => r.status === "approved");
  
  // Create listing to host mapping
  const listingToHost = {};
  (data.listings || []).forEach(listing => {
    if (listing.hostId) {
      listingToHost[listing.id] = listing.hostId;
    }
  });
  
  // Apply listing filter
  if (filters?.listingId) {
    filteredReviews = filteredReviews.filter(r => r.listingId === filters.listingId);
  }
  
  // Apply host filter
  if (filters?.hostId) {
    filteredReviews = filteredReviews.filter(r => {
      const hostId = listingToHost[r.listingId];
      return hostId === filters.hostId;
    });
  }
  
  if (filteredReviews.length === 0) {
    return {
      title: "Review Analytics Report",
      generatedAt: new Date().toLocaleString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      filters: {
        listingId: filters?.listingId || null,
        hostId: filters?.hostId || null
      },
      summary: {
        totalReviews: 0,
        totalListings: 0
      },
      bestReviews: [],
      lowestReviews: []
    };
  }
  
  // Group reviews by listingId and calculate average rating per listing
  const listingRatings = {};
  filteredReviews.forEach(review => {
    if (!listingRatings[review.listingId]) {
      listingRatings[review.listingId] = {
        listingId: review.listingId,
        listingTitle: review.listingTitle || "Unknown Listing",
        ratings: [],
        totalRating: 0,
        count: 0
      };
    }
    listingRatings[review.listingId].ratings.push(review.rating || 0);
    listingRatings[review.listingId].totalRating += review.rating || 0;
    listingRatings[review.listingId].count += 1;
  });
  
  // Calculate average for each listing
  const listingsWithAvg = Object.values(listingRatings).map(listing => ({
    ...listing,
    averageRating: listing.totalRating / listing.count
  }));
  
  // Sort by average rating
  const sorted = listingsWithAvg.sort((a, b) => b.averageRating - a.averageRating);
  
  // Get top 10 best and bottom 10 lowest (for report, show more than dashboard)
  const bestReviews = sorted.slice(0, 10);
  const lowestReviews = sorted.slice(-10).reverse();
  
  // Calculate overall statistics
  const totalAverageRating = filteredReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / filteredReviews.length;
  const ratingDistribution = {
    5: filteredReviews.filter(r => r.rating === 5).length,
    4: filteredReviews.filter(r => r.rating === 4).length,
    3: filteredReviews.filter(r => r.rating === 3).length,
    2: filteredReviews.filter(r => r.rating === 2).length,
    1: filteredReviews.filter(r => r.rating === 1).length
  };
  
  return {
    title: "Review Analytics Report",
    generatedAt: new Date().toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    }),
      filters: {
        listingId: filters?.listingId || null,
        hostId: filters?.hostId || null
      },
      summary: {
        totalReviews: filteredReviews.length,
        totalListings: Object.keys(listingRatings).length,
        overallAverageRating: totalAverageRating,
        ratingDistribution
      },
    bestReviews,
    lowestReviews
  };
};

const AdminDashboard = () => {
  const { currentUser, userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeSection, setActiveSection] = useState("home");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalUsers: 0,
    totalHosts: 0,
    totalGuests: 0,
    platformRevenue: 0,
    grossRevenue: 0,
    hostPayouts: 0,
    activeListings: 0,
    pendingListings: 0,
    rejectedListings: 0,
    totalListings: 0,
    averageRating: 0,
    totalBookings: 0,
    todayBookings: 0,
    todayBookingsList: [],
    upcomingBookings: 0,
    upcomingBookingsList: []
  });
  const [loading, setLoading] = useState(true);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [adminUserData, setAdminUserData] = useState(null);

  useEffect(() => {
    const checkAdminAccess = async () => {
    if (authLoading) return;
    
    if (!currentUser) {
      navigate("/login");
      return;
    }

      // Check if user is admin - only system admin can access
      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const roles = userData.roles || (userData.role ? [userData.role] : []);
          
          // TEMPORARY: Allow access for testing - remove this in production
          // Uncomment the lines below to enable admin-only access
          // if (!roles.includes("admin")) {
          //   // Not an admin - redirect to home
          //   navigate("/");
          //   return;
          // }
          
          console.log("User roles:", roles);
          console.log("Is admin:", roles.includes("admin"));
        } else {
          console.warn("User document not found");
          // User document doesn't exist - allow for now (for testing)
          // navigate("/");
          // return;
        }
      } catch (error) {
        console.error("Error checking admin access:", error);
        // Allow access for now (for testing)
      // navigate("/");
      // return;
    }

    // Set active section based on URL
    const path = location.pathname;
      if (path.includes("/admin/cashout")) setActiveSection("cashout");
      else if (path.includes("/admin/subscriptions")) setActiveSection("subscriptions");
      else if (path.includes("/admin/servicefees")) setActiveSection("servicefees");
      else if (path.includes("/admin/policy")) setActiveSection("policy");
    else if (path.includes("/admin/users")) setActiveSection("users");
      else if (path.includes("/admin/reports")) setActiveSection("reports");
    else setActiveSection("home");

    fetchStats();
      fetchAdminUserData();
    };

    checkAdminAccess();
    
    // Set up real-time listeners for stats updates
    if (currentUser && userRole === "admin") {
      const unsubscribeBookings = onSnapshot(
        collection(db, "bookings"),
        () => {
          fetchStats();
        }
      );
      
      const unsubscribeWithdrawals = onSnapshot(
        collection(db, "withdrawalRequests"),
        () => {
          fetchStats();
        }
      );
      
      const unsubscribeAdminPayments = onSnapshot(
        collection(db, "adminPayments"),
        () => {
          fetchStats();
        }
      );
      
      return () => {
        unsubscribeBookings();
        unsubscribeWithdrawals();
        unsubscribeAdminPayments();
      };
    }
  }, [currentUser, userRole, authLoading, navigate, location]);

  const fetchAdminUserData = async () => {
    if (!currentUser) return;
    try {
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (userDoc.exists()) {
        setAdminUserData({ id: userDoc.id, ...userDoc.data() });
      }
    } catch (error) {
      console.error("Error fetching admin user data:", error);
    }
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [listingsSnapshot, bookingsSnapshot, usersSnapshot, adminPaymentsSnapshot, withdrawalsSnapshot, reviewsSnapshot] = await Promise.all([
        getDocs(collection(db, "listings")),
        getDocs(collection(db, "bookings")),
        getDocs(collection(db, "users")),
        getDocs(collection(db, "adminPayments")),
        getDocs(collection(db, "withdrawalRequests")),
        getDocs(collection(db, "reviews"))
      ]);
      
      const allListings = listingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const allBookings = bookingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const allAdminPayments = adminPaymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const allWithdrawals = withdrawalsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const allReviews = reviewsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(r => r.status === "approved");
      
      // Calculate user stats
      const totalUsers = allUsers.length;
      const totalHosts = allUsers.filter(u => {
        const roles = u.roles || (u.role ? [u.role] : []);
        return roles.includes("host");
      }).length;
      const totalGuests = allUsers.filter(u => {
        const roles = u.roles || (u.role ? [u.role] : []);
        return roles.includes("guest") && !roles.includes("host");
      }).length;
      
      // Calculate financial stats
      // Gross Revenue: All confirmed bookings (total money received by admin from guests)
      const grossRevenue = allBookings
        .filter(b => b.status === "confirmed")
        .reduce((sum, b) => {
          const price = parseFloat(b.totalPrice) || 0;
          return sum + price;
        }, 0);
      
      // Platform revenue (service fees) - 7% of gross revenue
      // This represents the service fee the platform earns from each booking
      const serviceFeePercentage = 0.07;
      const platformRevenue = grossRevenue * serviceFeePercentage;
      
      // Host payouts: Sum of all completed withdrawal amounts
      // This represents money actually sent to hosts via PayPal
      const hostPayouts = allWithdrawals
        .filter(w => w.status === "completed")
        .reduce((sum, w) => {
          const amount = parseFloat(w.amount) || 0;
          return sum + amount;
        }, 0);
      
      // Debug logging
      console.log("📊 Financial Stats Calculation:", {
        totalConfirmedBookings: allBookings.filter(b => b.status === "confirmed").length,
        grossRevenue,
        platformRevenue,
        completedWithdrawals: allWithdrawals.filter(w => w.status === "completed").length,
        hostPayouts,
        allWithdrawals: allWithdrawals.map(w => ({ id: w.id, status: w.status, amount: w.amount }))
      });
      
      // Calculate listing stats
      const activeListings = allListings.filter(l => l.status === "active").length;
      const pendingListings = allListings.filter(l => l.status === "pending").length;
      const rejectedListings = allListings.filter(l => l.status === "rejected").length;
      const totalListings = allListings.length;
      
      // Calculate today's bookings
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayBookingsList = allBookings.filter(b => {
        const checkIn = b.checkIn ? new Date(b.checkIn) : null;
        if (!checkIn) return false;
        checkIn.setHours(0, 0, 0, 0);
        return checkIn.getTime() === today.getTime() && b.status === "confirmed";
      });
      
      // Calculate upcoming bookings
      const upcomingBookingsList = allBookings.filter(b => {
        const checkIn = b.checkIn ? new Date(b.checkIn) : null;
        if (!checkIn) return false;
        return checkIn > today && b.status === "confirmed";
      }).sort((a, b) => {
        const dateA = a.checkIn ? new Date(a.checkIn) : new Date(0);
        const dateB = b.checkIn ? new Date(b.checkIn) : new Date(0);
        return dateA - dateB;
      }).slice(0, 5); // Limit to 5 upcoming bookings
      
      // Calculate average rating from reviews
      const averageRating = allReviews.length > 0 
        ? allReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / allReviews.length 
        : 0;
      
      setStats({
        totalIncome: platformRevenue,
        totalUsers,
        totalHosts,
        totalGuests,
        platformRevenue,
        grossRevenue,
        hostPayouts,
        activeListings,
        pendingListings,
        rejectedListings,
        totalListings,
        averageRating,
        totalBookings: allBookings.length,
        todayBookings: todayBookingsList.length,
        todayBookingsList: todayBookingsList.slice(0, 5), // Limit to 5 today's bookings
        upcomingBookings: upcomingBookingsList.length,
        upcomingBookingsList: upcomingBookingsList,
        allReviews // Store reviews for analytics
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
    navigate(`/admin${section === "home" ? "" : `/${section}`}`);
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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="text-[#1C1C1E] font-light">Loading...</div>
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
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#1C1C1E]">Admin Functions</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden w-6 h-6 flex items-center justify-center text-[#8E8E93] hover:text-[#1C1C1E] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <NavItem
              icon="dashboard"
              label="Dashboard Overview"
              active={activeSection === "home"}
              onClick={() => handleSectionChange("home")}
            />
            <NavItem
              icon="cashout"
              label="Cash-out Approvals"
              active={activeSection === "cashout"}
              onClick={() => handleSectionChange("cashout")}
            />
            <NavItem
              icon="subscriptions"
              label="Subscriptions"
              active={activeSection === "subscriptions"}
              onClick={() => handleSectionChange("subscriptions")}
            />
            <NavItem
              icon="servicefees"
              label="Service Fees"
              active={activeSection === "servicefees"}
              onClick={() => handleSectionChange("servicefees")}
            />
            <NavItem
              icon="policy"
              label="Policy & Compliance"
              active={activeSection === "policy"}
              onClick={() => handleSectionChange("policy")}
            />
            <NavItem
              icon="users"
              label="User Management"
              active={activeSection === "users"}
              onClick={() => handleSectionChange("users")}
            />
            <NavItem
              icon="reports"
              label="Reports"
              active={activeSection === "reports"}
              onClick={() => handleSectionChange("reports")}
            />
          </nav>

          {/* Switch to Guest View */}
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={() => navigate("/")}
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
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log("Profile button clicked, opening modal");
                  setShowProfileModal(true);
                }}
                className="p-2 text-[#1C1C1E] hover:bg-gray-100 rounded-lg transition-colors relative cursor-pointer"
                type="button"
                aria-label="View Profile"
              >
                <div className="w-10 h-10 rounded-full bg-[#0071E3]/10 flex items-center justify-center">
                  {adminUserData?.photoURL ? (
                    <img
                      src={adminUserData.photoURL}
                      alt={adminUserData.displayName || "Admin"}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-medium text-[#0071E3]">
                      {(adminUserData?.displayName || currentUser?.displayName || currentUser?.email || "A")[0].toUpperCase()}
                    </span>
                  )}
                </div>
              </button>
              <button
                onClick={async () => {
                  const { signOut } = await import("firebase/auth");
                  const { auth } = await import("../../firebase");
                  await signOut(auth);
                  navigate("/login");
                }}
                className="px-4 py-2 bg-[#0071E3] text-white rounded-lg text-sm font-light hover:bg-[#0051D0] transition-all"
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-6 sm:p-8 lg:p-10">
          {activeSection === "home" && <HomeContent stats={stats} formatCurrency={formatCurrency} />}
          {activeSection === "cashout" && <CashoutApprovalsContent />}
          {activeSection === "subscriptions" && <SubscriptionsContent />}
          {activeSection === "servicefees" && <ServiceFeesContent />}
          {activeSection === "policy" && <PolicyContent />}
          {activeSection === "users" && <UsersContent />}
          {activeSection === "reports" && <ReportsContent />}
        </main>
      </div>

      {/* Profile Modal */}
      <AdminProfileModal
        isOpen={showProfileModal}
        onClose={() => {
          console.log("Closing profile modal");
          setShowProfileModal(false);
        }}
        adminUserData={adminUserData}
        currentUser={currentUser}
      />
    </div>
  );
};

// Navigation Item Component
const NavItem = ({ icon, label, active, onClick }) => {
  const icons = {
    dashboard: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    cashout: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    subscriptions: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
    servicefees: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    policy: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    users: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    reports: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  };

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-light transition-all duration-200 ${
        active
          ? "bg-[#0071E3] text-white"
          : "text-[#8E8E93] hover:bg-gray-100 hover:text-[#1C1C1E]"
      }`}
    >
      {icons[icon]}
      <span>{label}</span>
    </button>
  );
};

// Home Content Component
const HomeContent = ({ stats, formatCurrency }) => {
  const { currentUser } = useAuth();
  const userName = currentUser?.displayName?.split(" ")[0] || currentUser?.email?.split("@")[0] || "Admin";

  const overviewCards = [
    {
      label: "Total Users",
      value: stats.totalUsers,
      icon: "users",
      color: "bg-[#0071E3]",
      delay: 0
    },
    {
      label: "Total Hosts",
      value: stats.totalHosts,
      icon: "hosts",
      color: "bg-[#34C759]",
      delay: 0.1
    },
    {
      label: "Total Guests",
      value: stats.totalGuests,
      icon: "guests",
      color: "bg-[#AF52DE]",
      delay: 0.2
    },
    {
      label: "Total Listings",
      value: stats.totalListings,
      icon: "listings",
      color: "bg-[#FF9500]",
      delay: 0.3
    }
  ];

  const financialCards = [
    {
      label: "Platform Revenue",
      value: formatCurrency(stats.platformRevenue),
      subtitle: "Service fees earned",
      icon: "revenue",
      color: "bg-[#34C759]",
      delay: 0
    },
    {
      label: "Gross Revenue",
      value: formatCurrency(stats.grossRevenue),
      subtitle: "Total from bookings",
      icon: "gross",
      color: "bg-[#0071E3]",
      delay: 0.1
    },
    {
      label: "Host Payouts",
      value: formatCurrency(stats.hostPayouts),
      subtitle: "Paid to hosts",
      icon: "payouts",
      color: "bg-[#FF3B30]",
      delay: 0.2
    }
  ];

  return (
    <div className="space-y-10 animate-fadeInUp">
      {/* Dashboard Overview Header */}
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
        <h2 className="text-3xl font-light text-[#1C1C1E] mb-2">Dashboard Overview</h2>
        <p className="text-sm text-[#8E8E93] font-light">Welcome back! Here's what's happening on your platform.</p>
      </div>

      {/* Overview Cards - Total Users, Hosts, Guests, Listings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {overviewCards.map((card, index) => (
          <StatCard key={index} {...card} />
        ))}
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {financialCards.map((card, index) => (
          <StatCard key={`financial-${index}`} {...card} />
        ))}
      </div>

      {/* Booking Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <BookingCard
          title="Today's Bookings"
          bookings={stats.todayBookingsList || []}
          icon="calendar"
          emptyMessage="No bookings for today"
        />
        <BookingCard
          title="Upcoming Bookings"
          bookings={stats.upcomingBookingsList || []}
          icon="clock"
          emptyMessage="No upcoming bookings"
        />
      </div>

      <div className="pt-4">
        <GuestReviewsCard stats={stats} />
      </div>
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
    users: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    hosts: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    guests: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    listings: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    revenue: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    gross: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    payouts: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
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
      className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 animate-fadeInUp"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="flex items-center justify-between mb-6">
        <div className={`w-14 h-14 rounded-xl ${color} flex items-center justify-center text-white`}>
          {icons[icon]}
        </div>
      </div>
      <div>
        <p className="text-sm text-[#8E8E93] font-light mb-3">{label}</p>
        <p className="text-3xl sm:text-4xl font-light text-[#1C1C1E] mb-2">{value}</p>
        {subtitle && (
          <p className="text-xs text-[#8E8E93] font-light mt-3">{subtitle}</p>
        )}
      </div>
    </div>
  );
};

// Booking Card Component
const BookingCard = ({ title, bookings, icon, emptyMessage }) => {
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

  const formatDate = (date) => {
    if (!date) return "N/A";
    try {
      const dateObj = date?.toDate ? date.toDate() : new Date(date);
      if (isNaN(dateObj.getTime())) return "N/A";
      return dateObj.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    } catch (error) {
      return "N/A";
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const count = bookings?.length || 0;

  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 animate-fadeInUp">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-xl bg-[#0071E3]/10 flex items-center justify-center text-[#0071E3]">
          {icons[icon]}
        </div>
        <div>
          <h3 className="text-xl font-light text-[#1C1C1E] mb-1">{title}</h3>
          <p className="text-sm text-[#8E8E93] font-light">{count} {count === 1 ? 'booking' : 'bookings'}</p>
        </div>
      </div>
      {count === 0 ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            {icons[icon]}
          </div>
          <p className="text-sm text-[#8E8E93] font-light">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="p-4 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-[#1C1C1E] mb-1">
                    {booking.listingTitle || booking.listingId || "Booking"}
                  </h4>
                  <p className="text-xs text-[#8E8E93] font-light">
                    {booking.guestEmail || booking.guestId || "Guest"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-[#0071E3]">
                    {formatCurrency(booking.totalPrice)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-[#8E8E93] font-light">
                {booking.checkIn && (
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {formatDate(booking.checkIn)}
                  </span>
                )}
                {booking.checkOut && (
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {formatDate(booking.checkOut)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Guest Reviews Card with Best and Lowest Reviews Analytics
const GuestReviewsCard = ({ stats }) => {
  const [bestReviews, setBestReviews] = useState([]);
  const [lowestReviews, setLowestReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [selectedListing, setSelectedListing] = useState("");
  const [selectedHost, setSelectedHost] = useState("");
  const [generating, setGenerating] = useState(false);

  // Fetch listings and hosts for filters
  useEffect(() => {
    const fetchFilterData = async () => {
      try {
        const [listingsSnapshot, usersSnapshot] = await Promise.all([
          getDocs(collection(db, "listings")),
          getDocs(collection(db, "users"))
        ]);
        
        const allListings = listingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        setListings(allListings);
        
        // Filter hosts
        const hostUsers = allUsers.filter(u => {
          const roles = u.roles || (u.role ? [u.role] : []);
          return roles.includes("host");
        });
        setHosts(hostUsers);
      } catch (error) {
        console.error("Error fetching filter data:", error);
      }
    };
    
    fetchFilterData();
  }, []);

  useEffect(() => {
    const fetchReviewAnalytics = async () => {
      try {
        setLoading(true);
        const reviews = stats?.allReviews || [];
        
        if (reviews.length === 0) {
          setBestReviews([]);
          setLowestReviews([]);
          setLoading(false);
          return;
        }

        // Group reviews by listingId and calculate average rating per listing
        const listingRatings = {};
        reviews.forEach(review => {
          if (!listingRatings[review.listingId]) {
            listingRatings[review.listingId] = {
              listingId: review.listingId,
              listingTitle: review.listingTitle || "Unknown Listing",
              ratings: [],
              totalRating: 0,
              count: 0
            };
          }
          listingRatings[review.listingId].ratings.push(review.rating || 0);
          listingRatings[review.listingId].totalRating += review.rating || 0;
          listingRatings[review.listingId].count += 1;
        });

        // Calculate average for each listing
        const listingsWithAvg = Object.values(listingRatings).map(listing => ({
          ...listing,
          averageRating: listing.totalRating / listing.count
        }));

        // Sort by average rating
        const sorted = listingsWithAvg.sort((a, b) => b.averageRating - a.averageRating);
        
        // Get top 3 best and bottom 3 lowest
        setBestReviews(sorted.slice(0, 3));
        setLowestReviews(sorted.slice(-3).reverse());
      } catch (error) {
        console.error("Error fetching review analytics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReviewAnalytics();
  }, [stats]);

  const handleGenerateReviewReport = async () => {
    try {
      setGenerating(true);
      
      // Fetch all data needed for report
      const [listingsSnapshot, reviewsSnapshot] = await Promise.all([
        getDocs(collection(db, "listings")),
        getDocs(collection(db, "reviews"))
      ]);
      
      const allListings = listingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const allReviews = reviewsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Create a mapping of listingId to hostId
      const listingToHost = {};
      allListings.forEach(listing => {
        if (listing.hostId) {
          listingToHost[listing.id] = listing.hostId;
        }
      });
      
      // Prepare data object
      const data = {
        reviews: allReviews,
        listings: allListings
      };
      
      // Apply filters
      const filters = {
        listingId: selectedListing || null,
        hostId: selectedHost || null
      };
      
      // Generate report
      const report = generateReviewAnalyticsReport(data, filters);
      
      // Download PDF - need to access the downloadReport function from parent scope
      // We'll define it locally or access it from window/context
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      let yPosition = margin;
      const lineHeight = 7;
      const sectionSpacing = 15;
      
      // Colors
      const navyBlue = [30, 41, 59];
      const royalBlue = [59, 130, 246];
      const textDark = [30, 41, 59];
      const textMedium = [100, 116, 139];
      const textLight = [148, 163, 184];
      const white = [255, 255, 255];
      const borderGray = [226, 232, 240];
      
      // Helper function to check page break
      const checkPageBreak = (requiredSpace) => {
        if (yPosition + requiredSpace > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }
      };
      
      // Title
      pdf.setFontSize(20);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...navyBlue);
      pdf.text(report.title, margin, yPosition);
      yPosition += 10;
      
      // Generated at and date range
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...textMedium);
      pdf.text(`Generated: ${report.generatedAt}`, margin, yPosition);
      yPosition += 5;
      
      if (report.dateRange && report.dateRange.start && report.dateRange.end) {
        const startDate = new Date(report.dateRange.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const endDate = new Date(report.dateRange.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        pdf.text(`Date Range: ${startDate} - ${endDate}`, margin, yPosition);
        yPosition += 5;
      }
      
      // Filter info
      if (report.filters) {
        const filterTexts = [];
        if (report.filters.listingId) {
          const listing = data.listings.find(l => l.id === report.filters.listingId);
          filterTexts.push(`Listing: ${listing?.title || "Unknown"}`);
        }
        if (report.filters.hostId) {
          const host = hosts.find(h => h.id === report.filters.hostId);
          filterTexts.push(`Host: ${host?.name || host?.email || "Unknown"}`);
        }
        if (filterTexts.length > 0) {
          pdf.text(`Filters: ${filterTexts.join(", ")}`, margin, yPosition);
          yPosition += 5;
        }
      }
      
      yPosition += 5;
      
      // Summary box
      let summaryBoxHeight = 20;
      summaryBoxHeight += 10;
      summaryBoxHeight += (lineHeight + 2) * 3;
      summaryBoxHeight += 5;
      summaryBoxHeight += (lineHeight + 1) * 5;
      summaryBoxHeight += 5;
      
      pdf.setFillColor(...white);
      pdf.setDrawColor(...borderGray);
      pdf.setLineWidth(0.5);
      pdf.roundedRect(margin, yPosition - 8, pageWidth - (margin * 2), summaryBoxHeight, 4, 4, "FD");
      
      pdf.setFillColor(255, 204, 0);
      pdf.rect(margin, yPosition - 8, 4, summaryBoxHeight, "F");
      
      pdf.setFontSize(15);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...navyBlue);
      pdf.text("Review Analytics Summary", margin + 12, yPosition + 3);
      
      pdf.setDrawColor(255, 204, 0);
      pdf.setLineWidth(0.8);
      pdf.line(margin + 12, yPosition + 5, margin + 150, yPosition + 5);
      
      yPosition += 12;
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const valueX = pageWidth - margin - 12;
      
      pdf.setTextColor(...textDark);
      pdf.text(`Total Reviews:`, margin + 12, yPosition);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...royalBlue);
      pdf.text((report.summary?.totalReviews || 0).toString(), valueX, yPosition, { align: "right" });
      yPosition += lineHeight + 2;
      
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...textDark);
      pdf.text(`Total Listings Reviewed:`, margin + 12, yPosition);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...royalBlue);
      pdf.text((report.summary?.totalListings || 0).toString(), valueX, yPosition, { align: "right" });
      yPosition += lineHeight + 2;
      
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...textDark);
      pdf.text(`Overall Average Rating:`, margin + 12, yPosition);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...royalBlue);
      pdf.text((report.summary?.overallAverageRating || 0).toFixed(2), valueX, yPosition, { align: "right" });
      yPosition += lineHeight + 3;
      
      pdf.setDrawColor(255, 204, 0);
      pdf.setLineWidth(0.5);
      pdf.line(margin + 12, yPosition - 2, pageWidth - margin - 12, yPosition - 2);
      yPosition += 5;
      
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(...textDark);
      pdf.text("Rating Distribution:", margin + 12, yPosition);
      yPosition += lineHeight + 1;
      
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...textMedium);
      const dist = report.summary?.ratingDistribution || {};
      pdf.text(`5 Stars: ${dist[5] || 0}`, margin + 18, yPosition);
      yPosition += lineHeight + 1;
      pdf.text(`4 Stars: ${dist[4] || 0}`, margin + 18, yPosition);
      yPosition += lineHeight + 1;
      pdf.text(`3 Stars: ${dist[3] || 0}`, margin + 18, yPosition);
      yPosition += lineHeight + 1;
      pdf.text(`2 Stars: ${dist[2] || 0}`, margin + 18, yPosition);
      yPosition += lineHeight + 1;
      pdf.text(`1 Star: ${dist[1] || 0}`, margin + 18, yPosition);
      yPosition += lineHeight + 5;
      
      yPosition += sectionSpacing + 10;
      
      // Best Reviews Table
      if (report.bestReviews && report.bestReviews.length > 0) {
        checkPageBreak(50);
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...navyBlue);
        pdf.text("Best Rated Listings", margin, yPosition);
        yPosition += 12;
        
        pdf.setFillColor(...navyBlue);
        pdf.roundedRect(margin, yPosition - 7, pageWidth - (margin * 2), 12, 3, 3, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...white);
        pdf.setFontSize(9);
        pdf.text("Rank", margin + 6, yPosition);
        pdf.text("Listing Title", margin + 25, yPosition);
        pdf.text("Rating", pageWidth - margin - 40, yPosition, { align: "right" });
        pdf.text("Reviews", pageWidth - margin - 5, yPosition, { align: "right" });
        yPosition += 14;
        pdf.setFont("helvetica", "normal");
        
        report.bestReviews.forEach((listing, index) => {
          checkPageBreak(12);
          pdf.setFillColor(240, 253, 244);
          pdf.setDrawColor(187, 247, 208);
          pdf.setLineWidth(0.3);
          pdf.roundedRect(margin, yPosition - 6, pageWidth - (margin * 2), lineHeight + 3, 2, 2, "FD");
          
          pdf.setTextColor(...textDark);
          pdf.setFontSize(9);
          pdf.text(`#${index + 1}`, margin + 6, yPosition);
          pdf.text(listing.listingTitle || "Unknown", margin + 25, yPosition);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(34, 197, 94);
          pdf.text(listing.averageRating.toFixed(1), pageWidth - margin - 40, yPosition, { align: "right" });
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(...textMedium);
          pdf.text(`${listing.count}`, pageWidth - margin - 5, yPosition, { align: "right" });
          yPosition += lineHeight + 4;
        });
        
        yPosition += 10;
      }
      
      // Lowest Reviews Table
      if (report.lowestReviews && report.lowestReviews.length > 0) {
        checkPageBreak(50);
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...navyBlue);
        pdf.text("Lowest Rated Listings", margin, yPosition);
        yPosition += 12;
        
        pdf.setFillColor(...navyBlue);
        pdf.roundedRect(margin, yPosition - 7, pageWidth - (margin * 2), 12, 3, 3, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...white);
        pdf.setFontSize(9);
        pdf.text("Rank", margin + 6, yPosition);
        pdf.text("Listing Title", margin + 25, yPosition);
        pdf.text("Rating", pageWidth - margin - 40, yPosition, { align: "right" });
        pdf.text("Reviews", pageWidth - margin - 5, yPosition, { align: "right" });
        yPosition += 14;
        pdf.setFont("helvetica", "normal");
        
        report.lowestReviews.forEach((listing, index) => {
          checkPageBreak(12);
          pdf.setFillColor(254, 242, 242);
          pdf.setDrawColor(254, 202, 202);
          pdf.setLineWidth(0.3);
          pdf.roundedRect(margin, yPosition - 6, pageWidth - (margin * 2), lineHeight + 3, 2, 2, "FD");
          
          pdf.setTextColor(...textDark);
          pdf.setFontSize(9);
          pdf.text(`#${index + 1}`, margin + 6, yPosition);
          pdf.text(listing.listingTitle || "Unknown", margin + 25, yPosition);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(220, 38, 38);
          pdf.text(listing.averageRating.toFixed(1), pageWidth - margin - 40, yPosition, { align: "right" });
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(...textMedium);
          pdf.text(`${listing.count}`, pageWidth - margin - 5, yPosition, { align: "right" });
          yPosition += lineHeight + 4;
        });
      }
      
      // Save PDF
      pdf.save(`${report.title.replace(/\s+/g, "_")}_${new Date().toISOString().split('T')[0]}.pdf`);
      alert("Review Analytics Report generated and downloaded successfully!");
    } catch (error) {
      console.error("Error generating report:", error);
      alert("Error generating report: " + error.message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
  return (
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 animate-fadeInUp">
        <div className="text-center py-12">
          <div className="text-[#8E8E93] font-light">Loading review analytics...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 animate-fadeInUp">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#FFCC00]/10 flex items-center justify-center text-[#FF9500]">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-light text-[#1C1C1E] mb-1">Review Analytics</h3>
            <p className="text-sm text-[#8E8E93] font-light">Best and lowest rated listings</p>
          </div>
        </div>
        <button
          onClick={handleGenerateReviewReport}
          disabled={generating}
          className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-xl px-6 py-3 flex items-center gap-3 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="font-light">{generating ? "Generating..." : "Generate Report"}</span>
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
        <h4 className="text-sm font-medium text-[#1C1C1E] mb-3">Report Filters</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Listing Filter */}
          <div>
            <label className="block text-xs text-[#8E8E93] mb-2">Filter by Listing</label>
            <select
              value={selectedListing}
              onChange={(e) => setSelectedListing(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            >
              <option value="">All Listings</option>
              {listings.map(listing => (
                <option key={listing.id} value={listing.id}>
                  {listing.title || "Untitled Listing"}
                </option>
              ))}
            </select>
          </div>

          {/* Host Filter */}
          <div>
            <label className="block text-xs text-[#8E8E93] mb-2">Filter by Host</label>
            <select
              value={selectedHost}
              onChange={(e) => setSelectedHost(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            >
              <option value="">All Hosts</option>
              {hosts.map(host => (
                <option key={host.id} value={host.id}>
                  {host.name || host.email || "Unknown Host"}
                </option>
              ))}
            </select>
          </div>
        </div>
        {(selectedListing || selectedHost) && (
          <button
            onClick={() => {
              setSelectedListing("");
              setSelectedHost("");
            }}
            className="mt-3 text-xs text-[#8E8E93] hover:text-[#1C1C1E] underline"
          >
            Clear Filters
          </button>
        )}
      </div>

      {bestReviews.length === 0 && lowestReviews.length === 0 ? (
        <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </div>
        <p className="text-sm text-[#8E8E93] font-light">No reviews yet</p>
      </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Best Reviews */}
          <div>
            <h4 className="text-lg font-medium text-[#1C1C1E] mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Best Reviews
            </h4>
            <div className="space-y-3">
              {bestReviews.map((listing, index) => (
                <div key={listing.listingId} className="bg-green-50 rounded-xl p-4 border border-green-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#1C1C1E] mb-1">{listing.listingTitle}</p>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => (
                            <svg
                              key={i}
                              className={`w-4 h-4 ${i < Math.round(listing.averageRating) ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`}
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                        <span className="text-xs text-[#8E8E93] font-light">
                          {listing.averageRating.toFixed(1)} ({listing.count} {listing.count === 1 ? 'review' : 'reviews'})
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                      #{index + 1}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Lowest Reviews */}
          <div>
            <h4 className="text-lg font-medium text-[#1C1C1E] mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
              Lowest Reviews
            </h4>
            <div className="space-y-3">
              {lowestReviews.map((listing, index) => (
                <div key={listing.listingId} className="bg-red-50 rounded-xl p-4 border border-red-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#1C1C1E] mb-1">{listing.listingTitle}</p>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => (
                            <svg
                              key={i}
                              className={`w-4 h-4 ${i < Math.round(listing.averageRating) ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`}
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                        <span className="text-xs text-[#8E8E93] font-light">
                          {listing.averageRating.toFixed(1)} ({listing.count} {listing.count === 1 ? 'review' : 'reviews'})
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                      #{index + 1}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Listings Content Component
const ListingsContent = () => {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedListing, setSelectedListing] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const fetchListings = async () => {
      try {
        setLoading(true);
        const listingsQuery = query(collection(db, "listings"));
        const listingsSnapshot = await getDocs(listingsQuery);
        const listingsData = listingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setListings(listingsData);
      } catch (error) {
        console.error("Error fetching listings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, []);

  const handleViewListing = (listing) => {
    setSelectedListing(listing);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedListing(null);
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: "bg-green-100 text-green-700",
      pending: "bg-yellow-100 text-yellow-700",
      rejected: "bg-red-100 text-red-700",
      draft: "bg-gray-100 text-gray-700"
    };
    return badges[status] || "bg-gray-100 text-gray-700";
  };

  if (loading) {
    return (
  <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 animate-fadeInUp">
        <div className="text-center py-12">
          <div className="text-[#8E8E93] font-light">Loading listings...</div>
        </div>
  </div>
);
  }

  return (
    <>
  <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 animate-fadeInUp">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-light text-[#1C1C1E]">Listings Management</h2>
          <div className="text-sm text-[#8E8E93] font-light">
            {listings.length} {listings.length === 1 ? 'listing' : 'listings'}
  </div>
        </div>

        {listings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#8E8E93] font-light">No listings found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => (
              <div
                key={listing.id}
                className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 cursor-pointer transform hover:-translate-y-1"
                onClick={() => handleViewListing(listing)}
              >
                {/* Image */}
                <div className="relative w-full h-48 overflow-hidden bg-gray-100">
                  {listing.imageUrl ? (
                    <img
                      src={listing.imageUrl}
                      alt={listing.title}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">
                      🏠
                    </div>
                  )}
                  {/* Status Badge */}
                  <div className="absolute top-3 left-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-light capitalize ${getStatusBadge(listing.status)}`}>
                      {listing.status}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="text-lg font-medium text-[#1C1C1E] mb-2 line-clamp-1">{listing.title || "Untitled Listing"}</h3>
                  <p className="text-sm text-[#8E8E93] font-light mb-3 line-clamp-2">{listing.location || "No location"}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-light text-[#1C1C1E]">
                      ${listing.price || 0}<span className="text-sm text-[#8E8E93]">
                        {listing.category === "place" || listing.subcategory || listing.placeType 
                          ? "/night" 
                          : listing.category === "experience" || listing.activityType 
                          ? "/person" 
                          : listing.category === "service" || listing.serviceType 
                          ? "/service" 
                          : "/night"}
                      </span>
                    </span>
                    <button className="text-sm text-[#0071E3] font-light hover:underline">
                      View Details →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Listing Preview Modal */}
      {showModal && selectedListing && (
        <ListingPreviewModal listing={selectedListing} onClose={handleCloseModal} />
      )}
    </>
  );
};

const UsersContent = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("hosts"); // hosts or guests

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const usersQuery = query(collection(db, "users"));
      const snapshot = await getDocs(usersQuery);
      const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(allUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const hosts = users.filter(u => {
    const roles = u.roles || (u.role ? [u.role] : []);
    return roles.includes("host");
  });

  const guests = users.filter(u => {
    const roles = u.roles || (u.role ? [u.role] : []);
    return roles.includes("guest") && !roles.includes("host");
  });

  const displayedUsers = activeTab === "hosts" ? hosts : guests;

  const getInitials = (name, email) => {
    if (name) {
      const parts = name.split(" ");
      if (parts.length > 1) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return name[0].toUpperCase();
    }
    return email ? email[0].toUpperCase() : "U";
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    } catch {
      return "N/A";
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 animate-fadeInUp">
        <div className="text-center py-12">
          <div className="text-[#8E8E93] font-light">Loading users...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeInUp">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-2xl font-light text-[#1C1C1E] mb-6">User Management</h2>
        
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("hosts")}
            className={`px-4 py-2 rounded-lg text-sm font-light transition-all ${
              activeTab === "hosts"
                ? "bg-[#34C759] text-white"
                : "bg-gray-100 text-[#8E8E93] hover:bg-gray-200"
            }`}
          >
            Hosts ({hosts.length})
          </button>
          <button
            onClick={() => setActiveTab("guests")}
            className={`px-4 py-2 rounded-lg text-sm font-light transition-all ${
              activeTab === "guests"
                ? "bg-[#AF52DE] text-white"
                : "bg-gray-100 text-[#8E8E93] hover:bg-gray-200"
            }`}
          >
            Guests ({guests.length})
          </button>
        </div>

        {/* Users Table */}
        {displayedUsers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#8E8E93] font-light">No {activeTab} found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#1C1C1E]">
                    {activeTab === "hosts" ? "HOST" : "GUEST"}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#1C1C1E]">RATING</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#1C1C1E]">STATUS</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#1C1C1E]">JOINED</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#1C1C1E]">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {displayedUsers.map((user) => {
                  const userName = user.displayName || user.firstName && user.lastName 
                    ? `${user.firstName} ${user.lastName}` 
                    : user.email?.split("@")[0] || "User";
                  const userEmail = user.email || "No email";
                  const joinedDate = user.createdAt || user.joinedAt || null;
                  
                  return (
                    <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#0071E3]/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-medium text-[#0071E3]">
                              {getInitials(userName, userEmail)}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[#1C1C1E]">{userName}</p>
                            <p className="text-xs text-[#8E8E93] font-light">{userEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <svg
                              key={star}
                              className="w-4 h-4 text-gray-300"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                          <span className="text-xs text-[#8E8E93] font-light ml-2">No reviews</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-light">
                          active
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-[#1C1C1E] font-light">
                          {formatDate(joinedDate)}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex gap-2">
                          <button className="text-sm text-red-500 font-light hover:underline">
                            Terminate
                          </button>
                          <button className="text-sm text-red-500 font-light hover:underline">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const BookingsContent = () => (
  <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 animate-fadeInUp">
    <h2 className="text-2xl font-light text-[#1C1C1E] mb-4">Bookings Management</h2>
    <p className="text-[#8E8E93] font-light">Bookings management content coming soon...</p>
  </div>
);

const CalendarContent = () => (
  <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 animate-fadeInUp">
    <h2 className="text-2xl font-light text-[#1C1C1E] mb-4">Calendar</h2>
    <p className="text-[#8E8E93] font-light">Calendar content coming soon...</p>
  </div>
);

const MessagesContent = () => (
  <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 animate-fadeInUp">
    <h2 className="text-2xl font-light text-[#1C1C1E] mb-4">Messages</h2>
    <p className="text-[#8E8E93] font-light">Messages content coming soon...</p>
  </div>
);

// Withdrawals Content Component
const WithdrawalsContent = () => {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState("all"); // all, pending, completed, rejected

  useEffect(() => {
    fetchWithdrawals();
    
    // Real-time listener
    const unsubscribe = onSnapshot(
      collection(db, "withdrawalRequests"),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setWithdrawals(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching withdrawals:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const fetchWithdrawals = async () => {
    try {
      setLoading(true);
      const withdrawalsQuery = query(collection(db, "withdrawalRequests"));
      const snapshot = await getDocs(withdrawalsQuery);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setWithdrawals(data);
    } catch (error) {
      console.error("Error fetching withdrawals:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (withdrawalId, newStatus, notes = null) => {
    try {
      const withdrawalRef = doc(db, "withdrawalRequests", withdrawalId);
      const withdrawalDoc = await getDoc(withdrawalRef);
      
      if (!withdrawalDoc.exists()) {
        alert("Withdrawal request not found.");
        return;
      }

      const withdrawal = withdrawalDoc.data();
      const updateData = {
        status: newStatus,
        processedAt: serverTimestamp(),
        adminNotes: notes || null
      };

      // IMPORTANT: When withdrawal is completed, automatically transfer money via PayPal Payouts API
      if (newStatus === "completed") {
        try {
          // Fetch service fees to calculate deductions
          let commissionPercentage = 0;
          let withdrawalFee = 0;
          try {
            const serviceFeesQuery = query(
              collection(db, "adminSettings"),
              where("type", "==", "serviceFees")
            );
            const serviceFeesSnapshot = await getDocs(serviceFeesQuery);
            if (!serviceFeesSnapshot.empty) {
              const feesData = serviceFeesSnapshot.docs[0].data();
              commissionPercentage = feesData.commissionPercentage || 0;
              withdrawalFee = feesData.withdrawalFee || 0;
            }
          } catch (feeError) {
            console.error("Error fetching service fees:", feeError);
            // Continue with 0 fees if fetch fails
          }

          // Calculate fees
          const requestedAmount = parseFloat(withdrawal.amount) || 0;
          const commission = (requestedAmount * commissionPercentage) / 100;
          const totalFees = commission + withdrawalFee;
          const payoutAmount = requestedAmount - totalFees;

          // Update withdrawal record with fee breakdown
          await updateDoc(withdrawalRef, {
            ...updateData,
            requestedAmount: requestedAmount,
            commissionPercentage: commissionPercentage,
            commissionAmount: commission,
            withdrawalFee: withdrawalFee,
            totalFees: totalFees,
            payoutAmount: payoutAmount
          });

          // Call Cloud Function to process PayPal payout with the calculated payout amount
          const payoutResult = await processPayPalPayout({
            withdrawalId: withdrawalId,
            recipientEmail: withdrawal.paypalEmail,
            amount: Math.max(0, payoutAmount).toFixed(2), // Ensure non-negative
            currency: "USD"
          }, auth);

          // Cloud Function handles updating Firestore with payout status
          // Just update admin payments here
        try {
          const adminPaymentsQuery = query(
            collection(db, "adminPayments"),
            where("hostId", "==", withdrawal.hostId),
            where("withdrawalRequestId", "==", withdrawalId)
          );
          const adminPaymentsSnapshot = await getDocs(adminPaymentsQuery);
          
          // Mark all linked payments as completed
          const updatePromises = adminPaymentsSnapshot.docs.map(paymentDoc =>
            updateDoc(doc(db, "adminPayments", paymentDoc.id), {
              withdrawalCompletedAt: serverTimestamp(),
              status: "completed"
            })
          );
          
          await Promise.all(updatePromises);
        } catch (error) {
          console.error("Error updating admin payment records:", error);
          }
        } catch (payoutError) {
          console.error("PayPal Payout Error:", payoutError);
          // If payout fails, still update status but mark as failed
          await updateDoc(withdrawalRef, {
            ...updateData,
            payoutError: payoutError.message,
            payoutStatus: "FAILED"
          });
          throw payoutError;
        }
      } else if (newStatus === "rejected") {
        // If rejected, return amount to wallet balance and unlink payments
        const hostRef = doc(db, "users", withdrawal.hostId);
        const hostDoc = await getDoc(hostRef);
        
        if (hostDoc.exists()) {
          const hostData = hostDoc.data();
          const currentWalletBalance = hostData.walletBalance || 0;
          const transactions = hostData.transactions || [];
          
          // Update the existing withdrawal_request transaction instead of creating a new one
          const updatedTransactions = transactions.map(t => {
            if (t.withdrawalRequestId === withdrawalId && t.type === "withdrawal_request") {
              return {
                ...t,
                status: "rejected",
                description: `Withdrawal rejected: $${withdrawal.amount.toFixed(2)} returned to wallet balance`
              };
            }
            return t;
          });

          await updateDoc(hostRef, {
            walletBalance: currentWalletBalance + withdrawal.amount,
            transactions: updatedTransactions
          });
        }
        
        // Unlink admin payments from this withdrawal so they show as pending again
        try {
          const adminPaymentsQuery = query(
            collection(db, "adminPayments"),
            where("hostId", "==", withdrawal.hostId),
            where("withdrawalRequestId", "==", withdrawalId)
          );
          const adminPaymentsSnapshot = await getDocs(adminPaymentsQuery);
          
          // Unlink all payments linked to this withdrawal
          const updatePromises = adminPaymentsSnapshot.docs.map(paymentDoc =>
            updateDoc(doc(db, "adminPayments", paymentDoc.id), {
              withdrawalRequestId: null,
              withdrawalRequestedAt: null,
              withdrawalCompletedAt: null,
              status: "received"
            })
          );
          
          await Promise.all(updatePromises);
        } catch (error) {
          console.error("Error unlinking admin payment records:", error);
        }
      }

      await updateDoc(withdrawalRef, updateData);
      
      if (newStatus === "completed") {
        alert(`Withdrawal marked as completed! Please ensure you have sent $${withdrawal.amount.toFixed(2)} from your Business Account 1 (admin account) to the host's Business Account 2 (${withdrawal.paypalEmail}).`);
      } else {
        alert(`Withdrawal ${newStatus} successfully!`);
      }
    } catch (error) {
      console.error("Error updating withdrawal status:", error);
      alert("Failed to update withdrawal status. Please try again.");
    }
  };

  const filteredWithdrawals = withdrawals.filter(w => w.status === selectedFilter);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: "bg-yellow-100 text-yellow-700",
      approved: "bg-blue-100 text-blue-700",
      completed: "bg-green-100 text-green-700",
      rejected: "bg-red-100 text-red-700"
    };
    return badges[status] || "bg-gray-100 text-gray-700";
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 animate-fadeInUp">
        <div className="text-center py-12">
          <div className="text-[#8E8E93] font-light">Loading withdrawals...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeInUp">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-2xl font-light text-[#1C1C1E] mb-4">Withdrawal Requests</h2>
        
        {/* Filter Tabs */}
        <div className="flex gap-2 flex-wrap">
          {["pending", "approved", "completed", "rejected"].map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className={`px-4 py-2 rounded-xl text-sm font-light transition-all ${
                selectedFilter === filter
                  ? "bg-[#0071E3] text-white"
                  : "bg-gray-100 text-[#8E8E93] hover:bg-gray-200"
              }`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)} ({withdrawals.filter(w => w.status === filter).length})
            </button>
          ))}
        </div>
      </div>

      {/* Withdrawals List */}
      {filteredWithdrawals.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
          <p className="text-[#8E8E93] font-light">No {selectedFilter} withdrawal requests</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredWithdrawals.map((withdrawal) => (
            <div
              key={withdrawal.id}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-medium text-[#1C1C1E]">{withdrawal.hostName || withdrawal.hostEmail}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-light capitalize ${getStatusBadge(withdrawal.status)}`}>
                      {withdrawal.status}
                    </span>
                  </div>
                  <p className="text-sm text-[#8E8E93] font-light mb-1">Email: {withdrawal.hostEmail}</p>
                  <p className="text-sm text-[#8E8E93] font-light mb-1">PayPal: {withdrawal.paypalEmail}</p>
                  <p className="text-2xl font-light text-[#1C1C1E] mt-3">{formatCurrency(withdrawal.amount)}</p>
                  {withdrawal.requestedAt && (
                    <p className="text-xs text-[#8E8E93] font-light mt-2">
                      Requested: {withdrawal.requestedAt.toDate ? withdrawal.requestedAt.toDate().toLocaleString() : new Date(withdrawal.requestedAt).toLocaleString()}
                    </p>
                  )}
                  {withdrawal.adminNotes && (
                    <p className="text-sm text-[#8E8E93] font-light mt-2 italic">
                      Notes: {withdrawal.adminNotes}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              {withdrawal.status === "pending" && (
                <div className="flex gap-3 mt-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => handleUpdateStatus(withdrawal.id, "approved")}
                    className="flex-1 bg-[#0071E3] text-white rounded-xl px-4 py-2 font-light hover:bg-[#0051D0] transition-all"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      const notes = prompt("Enter rejection reason (optional):");
                      if (notes !== null) {
                        handleUpdateStatus(withdrawal.id, "rejected", notes);
                      }
                    }}
                    className="flex-1 bg-red-500 text-white rounded-xl px-4 py-2 font-light hover:bg-red-600 transition-all"
                  >
                    Reject
                  </button>
                </div>
              )}
              {withdrawal.status === "approved" && (
                <div className="flex gap-3 mt-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      const notes = prompt("Enter completion notes (optional):");
                      if (notes !== null) {
                        handleUpdateStatus(withdrawal.id, "completed", notes);
                      }
                    }}
                    className="flex-1 bg-[#34C759] text-white rounded-xl px-4 py-2 font-light hover:bg-[#30D158] transition-all"
                  >
                    Mark as Completed
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn"
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
                    "bg-gray-100 text-gray-700"
                  }`}>
                    {listing.status}
                  </span>
                )}
                {listing.price && (
                  <span className="text-2xl font-light text-[#1C1C1E]">
                    ${listing.price}<span className="text-base text-[#8E8E93]">/night</span>
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

// Transactions Content Component
const TransactionsContent = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const transactionsPerPage = 5;

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      // Fetch all transactions from adminPayments, withdrawalRequests, and user transactions
      const [adminPayments, withdrawals, usersSnapshot] = await Promise.all([
        getDocs(collection(db, "adminPayments")),
        getDocs(collection(db, "withdrawalRequests")),
        getDocs(collection(db, "users"))
      ]);

      const allTransactions = [];

      // Process admin payments
      adminPayments.docs.forEach(doc => {
        const data = doc.data();
        allTransactions.push({
          id: doc.id,
          type: "admin_payment",
          description: `Booking payment from ${data.guestId || "guest"} - ${data.bookingId || ""}`,
          amount: data.amount || 0,
          date: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          status: data.status || "received",
          icon: "dollar"
        });
      });

      // Process withdrawals
      withdrawals.docs.forEach(doc => {
        const data = doc.data();
        allTransactions.push({
          id: doc.id,
          type: "withdrawal",
          description: `Withdrawal request from ${data.hostName || data.hostEmail} - ${data.paypalEmail}`,
          amount: data.amount || 0,
          date: data.requestedAt?.toDate ? data.requestedAt.toDate() : new Date(),
          status: data.status || "pending",
          icon: "withdrawal"
        });
      });

      // Process user transactions (from all users)
      usersSnapshot.docs.forEach(userDoc => {
        const userData = userDoc.data();
        const userTransactions = userData.transactions || [];
        userTransactions.forEach((tx, index) => {
          allTransactions.push({
            id: `${userDoc.id}_${index}`,
            type: tx.type || "transaction",
            description: tx.description || `${tx.type}`,
            amount: tx.amount || 0,
            date: tx.date ? new Date(tx.date) : new Date(),
            status: tx.status || "completed",
            icon: tx.type?.includes("refund") ? "refund" : tx.type?.includes("payout") ? "payout" : "transaction"
          });
        });
      });

      // Sort by date (newest first)
      allTransactions.sort((a, b) => b.date - a.date);
      setTransactions(allTransactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (iconType) => {
    const icons = {
      dollar: (
        <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      ),
      withdrawal: (
        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
      ),
      refund: (
        <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
      ),
      payout: (
        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
      ),
      transaction: (
        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
      )
    };
    return icons[iconType] || icons.transaction;
  };

  const getStatusBadge = (status) => {
    const badges = {
      completed: "text-gray-600",
      pending: "text-yellow-600",
      received: "text-green-600",
      cancelled: "text-red-600"
    };
    return badges[status] || "text-gray-600";
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const totalPages = Math.ceil(transactions.length / transactionsPerPage);
  const startIndex = (currentPage - 1) * transactionsPerPage;
  const endIndex = startIndex + transactionsPerPage;
  const currentTransactions = transactions.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 animate-fadeInUp">
        <div className="text-center py-12">
          <div className="text-[#8E8E93] font-light">Loading transactions...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeInUp">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-light text-[#1C1C1E] mb-1">Transaction History</h2>
            <p className="text-sm text-[#8E8E93] font-light">Recent financial transactions and activities</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-[#8E8E93] font-light">Total Transactions</p>
            <p className="text-2xl font-light text-[#1C1C1E]">{transactions.length}</p>
          </div>
        </div>
        <p className="text-sm text-[#8E8E93] font-light mb-4">
          Showing {startIndex + 1}-{Math.min(endIndex, transactions.length)} of {transactions.length} transactions
        </p>

        {currentTransactions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#8E8E93] font-light">No transactions found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {currentTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all"
              >
                <div className="flex items-center gap-4">
                  {getIcon(transaction.icon)}
                  <div>
                    <p className="text-sm font-medium text-[#1C1C1E]">{transaction.description}</p>
                    <p className="text-xs text-[#8E8E93] font-light">
                      {transaction.date.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-base font-medium ${
                    transaction.type === "withdrawal" || transaction.type.includes("refund") 
                      ? "text-red-500" 
                      : "text-green-500"
                  }`}>
                    {transaction.type === "withdrawal" || transaction.type.includes("refund") ? "-" : "+"}
                    {formatCurrency(transaction.amount)}
                  </p>
                  <p className={`text-xs font-light ${getStatusBadge(transaction.status)}`}>
                    {transaction.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded-lg text-sm font-light disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              Prev
            </button>
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i + 1}
                onClick={() => setCurrentPage(i + 1)}
                className={`px-4 py-2 rounded-lg text-sm font-light ${
                  currentPage === i + 1
                    ? "bg-[#0071E3] text-white"
                    : "hover:bg-gray-100"
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 rounded-lg text-sm font-light disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Reports Content Component
const ReportsContent = () => {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [reportData, setReportData] = useState(null);

  // Helper function to safely convert Firestore timestamps to Date objects
  const safeDateConvert = (timestamp) => {
    if (!timestamp) return null;
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    if (timestamp instanceof Date) {
      return timestamp;
    }
    if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? null : date;
    }
    return null;
  };

  const fetchReportData = async (reportType, filterStartDate = null, filterEndDate = null) => {
    try {
      const [listingsSnapshot, bookingsSnapshot, usersSnapshot, reviewsSnapshot, withdrawalsSnapshot, adminPaymentsSnapshot] = await Promise.all([
        getDocs(collection(db, "listings")),
        getDocs(collection(db, "bookings")),
        getDocs(collection(db, "users")),
        getDocs(collection(db, "reviews")),
        getDocs(collection(db, "withdrawalRequests")),
        getDocs(collection(db, "adminPayments"))
      ]);

      const allListings = listingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const allBookings = bookingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const allReviews = reviewsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const allWithdrawals = withdrawalsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const allAdminPayments = adminPaymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Improved date filtering with proper handling
      const filterByDate = (item, dateFields) => {
        if (!filterStartDate || !filterEndDate) return true;
        
        // Try multiple date fields (for different transaction types)
        const dateFieldsArray = Array.isArray(dateFields) ? dateFields : [dateFields];
        
        for (const dateField of dateFieldsArray) {
          const itemDate = safeDateConvert(item[dateField]);
          if (itemDate) {
            // Normalize dates to start of day for comparison
            const itemDateOnly = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());
            const startDateOnly = new Date(filterStartDate.getFullYear(), filterStartDate.getMonth(), filterStartDate.getDate());
            const endDateOnly = new Date(filterEndDate.getFullYear(), filterEndDate.getMonth(), filterEndDate.getDate());
            
            if (itemDateOnly >= startDateOnly && itemDateOnly <= endDateOnly) {
              return true;
            }
          }
        }
        return false;
      };

      return {
        listings: allListings,
        bookings: allBookings.filter(b => filterByDate(b, ["createdAt", "checkIn", "checkOut"])),
        users: allUsers,
        reviews: allReviews.filter(r => filterByDate(r, "createdAt")),
        withdrawals: allWithdrawals.filter(w => filterByDate(w, ["createdAt", "requestedAt", "processedAt"])),
        adminPayments: allAdminPayments.filter(p => filterByDate(p, ["createdAt", "processedAt"]))
      };
    } catch (error) {
      console.error("Error fetching report data:", error);
      throw error;
    }
  };

  const generateFinancialReport = (data, dateRange = null) => {
    try {
      // Create a map of userId -> firstName for quick lookup
      const userFirstNameMap = new Map();
      (data.users || []).forEach(user => {
        if (user.id) {
          const firstName = user.firstName || user.displayName?.split(' ')[0] || "User";
          userFirstNameMap.set(user.id, firstName);
        }
      });

      // Helper function to get first name by user ID
      const getFirstName = (userId) => {
        if (!userId) return "User";
        return userFirstNameMap.get(userId) || "User";
      };

      // Safely filter and process bookings
      const confirmedBookings = (data.bookings || []).filter(b => {
        const status = (b.status || "").toLowerCase();
        const paymentStatus = (b.paymentStatus || "").toLowerCase();
        return status === "confirmed" && paymentStatus === "paid";
      });

      // Calculate revenue metrics with proper null handling
      const totalRevenue = confirmedBookings.reduce((sum, b) => {
        const price = parseFloat(b.totalPrice) || 0;
        return sum + price;
      }, 0);

      const averageBookingValue = confirmedBookings.length > 0 
        ? totalRevenue / confirmedBookings.length 
        : 0;

      // Process withdrawals with proper filtering
      const completedWithdrawals = (data.withdrawals || []).filter(w => {
        const status = (w.status || "").toLowerCase();
        return status === "completed";
      });

      const totalWithdrawals = completedWithdrawals.reduce((sum, w) => {
        const amount = parseFloat(w.amount) || 0;
        return sum + amount;
      }, 0);

      // Process admin payments
      const totalAdminPayments = (data.adminPayments || []).reduce((sum, p) => {
        const amount = parseFloat(p.amount) || 0;
        return sum + amount;
      }, 0);

      // Calculate net metrics
      const totalExpenses = totalWithdrawals + totalAdminPayments;
      const netRevenue = totalRevenue - totalExpenses;
      const profitMargin = totalRevenue > 0 ? (netRevenue / totalRevenue) * 100 : 0;

      // Prepare comprehensive transactions array
      const transactions = [];
      
      // Add booking payments (revenue) with enhanced details
      confirmedBookings.forEach(booking => {
        const bookingDate = safeDateConvert(booking.createdAt) || 
                           safeDateConvert(booking.checkIn) || 
                           new Date();
        
        const guestFirstName = getFirstName(booking.guestId);
        const listingTitle = booking.listingTitle || booking.listingId || "Listing";
        
        transactions.push({
          id: booking.id || `booking-${Date.now()}-${Math.random()}`,
          type: "Revenue",
          category: "Booking Payment",
          description: `Booking from ${guestFirstName} - ${listingTitle}`,
          amount: parseFloat(booking.totalPrice) || 0,
          date: bookingDate,
          status: "completed",
          reference: booking.id,
          bookingId: booking.id,
          guestEmail: booking.guestEmail || "N/A",
          listingId: booking.listingId || "N/A"
        });
      });

      // Add withdrawals (outgoing) with enhanced details
      completedWithdrawals.forEach(withdrawal => {
        const withdrawalDate = safeDateConvert(withdrawal.processedAt) || 
                              safeDateConvert(withdrawal.requestedAt) || 
                              safeDateConvert(withdrawal.createdAt) || 
                              new Date();
        
        const hostFirstName = getFirstName(withdrawal.hostId) || 
                             withdrawal.hostName?.split(' ')[0] || 
                             "Host";
        
        transactions.push({
          id: withdrawal.id || `withdrawal-${Date.now()}-${Math.random()}`,
          type: "Expense",
          category: "Host Payout",
          description: `Payout to ${hostFirstName}`,
          amount: -(parseFloat(withdrawal.amount) || 0),
          date: withdrawalDate,
          status: "completed",
          reference: withdrawal.id,
          withdrawalId: withdrawal.id,
          paypalEmail: withdrawal.paypalEmail || "N/A"
        });
      });

      // Add admin payments (outgoing) with enhanced details
      (data.adminPayments || []).forEach(payment => {
        const paymentDate = safeDateConvert(payment.processedAt) || 
                           safeDateConvert(payment.createdAt) || 
                           new Date();
        
        transactions.push({
          id: payment.id || `admin-payment-${Date.now()}-${Math.random()}`,
          type: "Expense",
          category: "Admin Payment",
          description: `Admin Payment${payment.bookingId ? ` - Booking ${payment.bookingId}` : ""}`,
          amount: -(parseFloat(payment.amount) || 0),
          date: paymentDate,
          status: (payment.status || "completed").toLowerCase(),
          reference: payment.id,
          paymentId: payment.id,
          bookingId: payment.bookingId || "N/A"
        });
      });

      // Sort transactions by date (newest first) with proper date handling
      transactions.sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date.getTime() : 0;
        const dateB = b.date instanceof Date ? b.date.getTime() : 0;
        return dateB - dateA;
      });

      // Calculate transaction statistics
      const revenueTransactions = transactions.filter(t => t.amount > 0);
      const expenseTransactions = transactions.filter(t => t.amount < 0);
      const totalTransactions = transactions.length;

      // Get date range for report period
      const reportDateRange = transactions.length > 0 
        ? {
            earliest: transactions[transactions.length - 1]?.date || new Date(),
            latest: transactions[0]?.date || new Date()
          }
        : null;

      return {
        title: "Financial Report",
        generatedAt: new Date().toLocaleString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        reportPeriod: reportDateRange,
        dateRange: dateRange,
        summary: {
          totalRevenue: totalRevenue,
          totalExpenses: totalExpenses,
          totalWithdrawals: totalWithdrawals,
          totalAdminPayments: totalAdminPayments,
          netRevenue: netRevenue,
          profitMargin: profitMargin,
          averageBookingValue: averageBookingValue
        },
        metrics: {
          totalBookings: confirmedBookings.length,
          totalWithdrawals: completedWithdrawals.length,
          totalAdminPayments: (data.adminPayments || []).length,
          totalTransactions: totalTransactions,
          revenueTransactions: revenueTransactions.length,
          expenseTransactions: expenseTransactions.length
        },
        transactions: transactions
      };
    } catch (error) {
      console.error("Error generating financial report:", error);
      // Return empty report structure on error
        return {
          title: "Financial Report",
          generatedAt: new Date().toLocaleString(),
          dateRange: dateRange,
          summary: {
          totalRevenue: 0,
          totalExpenses: 0,
          totalWithdrawals: 0,
          totalAdminPayments: 0,
          netRevenue: 0,
          profitMargin: 0,
          averageBookingValue: 0
        },
        metrics: {
          totalBookings: 0,
          totalWithdrawals: 0,
          totalAdminPayments: 0,
          totalTransactions: 0,
          revenueTransactions: 0,
          expenseTransactions: 0
        },
        transactions: []
      };
    }
  };

  const generateUserReport = (data, dateRange = null) => {
    const hosts = data.users.filter(u => {
      const roles = u.roles || (u.role ? [u.role] : []);
      return roles.includes("host");
    });
    const guests = data.users.filter(u => {
      const roles = u.roles || (u.role ? [u.role] : []);
      return roles.includes("guest") && !roles.includes("host");
    });

    return {
      title: "User Report",
      generatedAt: new Date().toLocaleString(),
      dateRange: dateRange,
      summary: {
        totalUsers: data.users.length,
        totalHosts: hosts.length,
        totalGuests: guests.length
      },
      users: data.users
    };
  };

  const generateListingPerformanceReport = (data, dateRange = null) => {
    const listingsWithStats = data.listings.map(listing => {
      const listingBookings = data.bookings.filter(b => b.listingId === listing.id);
      const listingReviews = data.reviews.filter(r => r.listingId === listing.id && r.status === "approved");
      const totalRevenue = listingBookings
        .filter(b => b.status === "confirmed" && b.paymentStatus === "paid")
        .reduce((sum, b) => sum + (b.totalPrice || 0), 0);
      const averageRating = listingReviews.length > 0
        ? listingReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / listingReviews.length
        : 0;

      return {
        id: listing.id,
        title: listing.title,
        status: listing.status,
        totalBookings: listingBookings.length,
        confirmedBookings: listingBookings.filter(b => b.status === "confirmed").length,
        totalRevenue: totalRevenue,
        averageRating: averageRating,
        reviewCount: listingReviews.length
      };
    });

    return {
      title: "Listing Performance Report",
      generatedAt: new Date().toLocaleString(),
      dateRange: dateRange,
      summary: {
        totalListings: data.listings.length,
        activeListings: data.listings.filter(l => l.status === "active").length
      },
      listings: listingsWithStats.sort((a, b) => b.totalRevenue - a.totalRevenue)
    };
  };

  const generateFinancialMetricsReport = (data, dateRange = null) => {
    // Filter bookings by date range if provided
    let filteredBookings = data.bookings || [];
    let filteredWithdrawals = data.withdrawals || [];
    
    if (dateRange && dateRange.start && dateRange.end) {
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999); // Include entire end date
      
      filteredBookings = filteredBookings.filter(b => {
        const bookingDate = b.createdAt ? new Date(b.createdAt) : null;
        if (!bookingDate) return false;
        return bookingDate >= startDate && bookingDate <= endDate;
      });
      
      filteredWithdrawals = filteredWithdrawals.filter(w => {
        const withdrawalDate = w.processedAt 
          ? new Date(w.processedAt) 
          : (w.requestedAt ? new Date(w.requestedAt) : null);
        if (!withdrawalDate) return false;
        return withdrawalDate >= startDate && withdrawalDate <= endDate;
      });
    }
    
    // Calculate Gross Revenue: All confirmed bookings
    const grossRevenue = filteredBookings
      .filter(b => b.status === "confirmed")
      .reduce((sum, b) => {
        const price = parseFloat(b.totalPrice) || 0;
        return sum + price;
      }, 0);
    
    // Platform Revenue: 7% of gross revenue
    const serviceFeePercentage = 0.07;
    const platformRevenue = grossRevenue * serviceFeePercentage;
    
    // Host Payouts: Sum of all completed withdrawal amounts
    const hostPayouts = filteredWithdrawals
      .filter(w => w.status === "completed")
      .reduce((sum, w) => {
        const amount = parseFloat(w.amount) || 0;
        return sum + amount;
      }, 0);
    
    // Additional metrics
    const totalConfirmedBookings = filteredBookings.filter(b => b.status === "confirmed").length;
    const totalCompletedWithdrawals = filteredWithdrawals.filter(w => w.status === "completed").length;
    const averageBookingValue = totalConfirmedBookings > 0 ? grossRevenue / totalConfirmedBookings : 0;
    const averageWithdrawalAmount = totalCompletedWithdrawals > 0 ? hostPayouts / totalCompletedWithdrawals : 0;
    
    return {
      title: "Financial Metrics Report",
      generatedAt: new Date().toLocaleString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      dateRange: dateRange,
      summary: {
        grossRevenue,
        platformRevenue,
        hostPayouts,
        serviceFeePercentage: serviceFeePercentage * 100, // Convert to percentage
        totalConfirmedBookings,
        totalCompletedWithdrawals,
        averageBookingValue,
        averageWithdrawalAmount
      }
    };
  };


  const downloadReport = (report, reportType) => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let yPosition = 0;
    const margin = 20;
    const lineHeight = 8;
    const sectionSpacing = 15;
    
    // Professional white and blue color scheme
    const navyBlue = [0, 51, 102]; // #003366 - Deep professional blue
    const royalBlue = [25, 118, 210]; // #1976D2 - Primary blue
    const lightBlue = [227, 242, 253]; // #E3F2FD - Light blue background
    const accentBlue = [13, 71, 161]; // #0D47A1 - Darker accent
    const textDark = [33, 33, 33]; // #212121 - Dark text
    const textMedium = [97, 97, 97]; // #616161 - Medium gray text
    const textLight = [158, 158, 158]; // #9E9E9E - Light gray text
    const white = [255, 255, 255]; // Pure white
    const borderGray = [224, 224, 224]; // #E0E0E0 - Subtle borders

    // Helper function to add header on each page
    const addHeader = () => {
      // Clean white background with blue accent bar
      pdf.setFillColor(...white);
      pdf.rect(0, 0, pageWidth, 70, "F");
      
      // Blue accent bar at top
      pdf.setFillColor(...navyBlue);
      pdf.rect(0, 0, pageWidth, 8, "F");
      
      // Voyago brand text in navy blue
      pdf.setTextColor(...navyBlue);
      pdf.setFontSize(28);
      pdf.setFont("helvetica", "bold");
      pdf.text("Voyago", margin, 25);
      
      // Elegant subtitle
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...textMedium);
      pdf.text("Administrative Report", margin, 35);
      
      // Professional blue underline
      pdf.setDrawColor(...royalBlue);
      pdf.setLineWidth(1.5);
      pdf.line(margin, 40, margin + 80, 40);
      
      // Date and report type in top right
      pdf.setFontSize(9);
      pdf.setTextColor(...textLight);
      pdf.text(reportType, pageWidth - margin, 25, { align: "right" });
      pdf.text(`Generated: ${report.generatedAt}`, pageWidth - margin, 35, { align: "right" });
      if (report.dateRange) {
        pdf.text(`Period: ${report.dateRange.start} - ${report.dateRange.end}`, pageWidth - margin, 45, { align: "right" });
      } else {
        pdf.text(`Period: All Time`, pageWidth - margin, 45, { align: "right" });
      }
      
      // Subtle separator line
      pdf.setDrawColor(...borderGray);
      pdf.setLineWidth(0.5);
      pdf.line(margin, 65, pageWidth - margin, 65);
      
      // Reset text color
      pdf.setTextColor(...textDark);
      yPosition = 80;
    };

    // Helper function to add a new page if needed
    const checkPageBreak = (requiredSpace = 20) => {
      if (yPosition + requiredSpace > pageHeight - margin) {
        pdf.addPage();
        addHeader();
        return true;
      }
      return false;
    };

    // Add header to first page
    addHeader();

    // Report Title with professional styling
    pdf.setFontSize(20);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...navyBlue);
    pdf.text(report.title, margin, yPosition);
    yPosition += sectionSpacing;

    // Display date range if available
    if (report.dateRange) {
      checkPageBreak(15);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...textMedium);
      pdf.text(`Report Period: ${report.dateRange.start} - ${report.dateRange.end}`, margin, yPosition);
      yPosition += lineHeight + 5;
    } else {
      checkPageBreak(15);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...textMedium);
      pdf.text("Report Period: All Time", margin, yPosition);
      yPosition += lineHeight + 5;
    }

    // Summary Section with professional white box and blue accent
    checkPageBreak(100);
    const summaryStartY = yPosition;
    
    if (reportType === "Financial Report") {
      const formatCurrency = (amount) => {
        const numAmount = parseFloat(amount) || 0;
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(numAmount);
      };

      // Calculate summary box height based on content
      let summaryBoxHeight = 20; // Base height for title
      summaryBoxHeight += 10; // Title spacing
      summaryBoxHeight += (lineHeight + 2) * 4; // 4 main lines (Revenue, Expenses, Host Payouts, Admin Payments)
      summaryBoxHeight += 5; // Divider spacing
      summaryBoxHeight += (lineHeight + 3); // Net Revenue
      if (report.summary?.profitMargin !== undefined) summaryBoxHeight += (lineHeight + 1);
      if (report.summary?.averageBookingValue !== undefined) summaryBoxHeight += (lineHeight + 1);
      summaryBoxHeight += 25; // Info box
      summaryBoxHeight += 5; // Bottom padding
      
      // Draw summary box once with calculated height
      pdf.setFillColor(...white);
      pdf.setDrawColor(...borderGray);
      pdf.setLineWidth(0.5);
      pdf.roundedRect(margin, yPosition - 8, pageWidth - (margin * 2), summaryBoxHeight, 4, 4, "FD");
      
      // Blue accent bar on left side
      pdf.setFillColor(...royalBlue);
      pdf.rect(margin, yPosition - 8, 4, summaryBoxHeight, "F");
      
      // Section title with blue accent
      pdf.setFontSize(15);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...navyBlue);
      pdf.text("Executive Summary", margin + 12, yPosition + 3);
      
      // Subtle underline
      pdf.setDrawColor(...royalBlue);
      pdf.setLineWidth(0.8);
      pdf.line(margin + 12, yPosition + 5, margin + 100, yPosition + 5);
      
      yPosition += 12;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");

      // Professional key-value pairs with better spacing and right-aligned values
      const valueX = pageWidth - margin - 12; // Right-align values
      
      pdf.setTextColor(...textDark);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Total Revenue:`, margin + 12, yPosition);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...royalBlue);
      pdf.text(formatCurrency(report.summary?.totalRevenue || 0), valueX, yPosition, { align: "right" });
      yPosition += lineHeight + 2;
      
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...textDark);
      pdf.text(`Total Expenses:`, margin + 12, yPosition);
      pdf.setTextColor(...textMedium);
      pdf.text(formatCurrency(report.summary?.totalExpenses || 0), valueX, yPosition, { align: "right" });
      yPosition += lineHeight + 2;
      
      pdf.setTextColor(...textDark);
      pdf.text(`  • Host Payouts:`, margin + 18, yPosition);
      pdf.setTextColor(...textMedium);
      pdf.text(formatCurrency(report.summary?.totalWithdrawals || 0), valueX, yPosition, { align: "right" });
      yPosition += lineHeight + 1;
      
      pdf.setTextColor(...textDark);
      pdf.text(`  • Admin Payments:`, margin + 18, yPosition);
      pdf.setTextColor(...textMedium);
      pdf.text(formatCurrency(report.summary?.totalAdminPayments || 0), valueX, yPosition, { align: "right" });
      yPosition += lineHeight + 2;
      
      // Net Revenue highlighted with divider
      pdf.setDrawColor(...royalBlue);
      pdf.setLineWidth(0.5);
      pdf.line(margin + 12, yPosition - 2, pageWidth - margin - 12, yPosition - 2);
      yPosition += 3;
      
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...navyBlue);
      pdf.text(`Net Revenue:`, margin + 12, yPosition);
      
      // Color code Net Revenue: blue for positive, darker blue for negative
      const netRevenue = parseFloat(report.summary?.netRevenue) || 0;
      const netRevenueColor = netRevenue >= 0 ? royalBlue : accentBlue;
      pdf.setTextColor(...netRevenueColor);
      pdf.setFontSize(12);
      pdf.text(formatCurrency(netRevenue), valueX, yPosition, { align: "right" });
      pdf.setFontSize(10);
      yPosition += lineHeight + 3;
      
      // Additional financial metrics
      if (report.summary?.profitMargin !== undefined) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(...textMedium);
        pdf.text(`Profit Margin: ${(report.summary.profitMargin || 0).toFixed(2)}%`, margin + 12, yPosition);
        yPosition += lineHeight + 1;
      }
      
      if (report.summary?.averageBookingValue !== undefined) {
        pdf.text(`Average Booking Value: ${formatCurrency(report.summary.averageBookingValue || 0)}`, margin + 12, yPosition);
        yPosition += lineHeight + 1;
      }
      
      // Metrics info box
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(...textMedium);
      
      const infoBoxY = yPosition - 2;
      const infoBoxHeight = 20;
      pdf.setFillColor(...lightBlue);
      pdf.setDrawColor(...borderGray);
      pdf.setLineWidth(0.3);
      pdf.roundedRect(margin + 12, infoBoxY, pageWidth - (margin * 2) - 12, infoBoxHeight, 2, 2, "FD");
      
      if (report.metrics) {
        pdf.text(`Total Bookings: ${report.metrics.totalBookings || 0}`, margin + 18, infoBoxY + 5);
        pdf.text(`Revenue Transactions: ${report.metrics.revenueTransactions || 0}`, margin + 18, infoBoxY + 10);
        pdf.text(`Expense Transactions: ${report.metrics.expenseTransactions || 0}`, margin + 18, infoBoxY + 15);
      } else {
        // Fallback for old report structure
        pdf.text(`Total Bookings: ${report.bookings || 0}`, margin + 18, infoBoxY + 5);
        pdf.text(`Completed Withdrawals: ${report.withdrawals || 0}`, margin + 18, infoBoxY + 10);
      }
      
      yPosition += infoBoxHeight + 3;
      pdf.setFontSize(10);
    } else if (reportType === "User Report") {
      // Draw summary box for User Report
      const userSummaryHeight = 50;
      pdf.setFillColor(...white);
      pdf.setDrawColor(...borderGray);
      pdf.setLineWidth(0.5);
      pdf.roundedRect(margin, yPosition - 8, pageWidth - (margin * 2), userSummaryHeight, 4, 4, "FD");
      
      pdf.setFillColor(...royalBlue);
      pdf.rect(margin, yPosition - 8, 4, userSummaryHeight, "F");
      
      pdf.setFontSize(15);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...navyBlue);
      pdf.text("Executive Summary", margin + 12, yPosition + 3);
      
      pdf.setDrawColor(...royalBlue);
      pdf.setLineWidth(0.8);
      pdf.line(margin + 12, yPosition + 5, margin + 100, yPosition + 5);
      
      yPosition += 12;
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      
      pdf.setTextColor(...textDark);
      pdf.text(`Total Users:`, margin + 12, yPosition);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...royalBlue);
      pdf.text(report.summary.totalUsers.toString(), margin + 75, yPosition);
      yPosition += lineHeight + 2;
      
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...textDark);
      pdf.text(`Total Hosts:`, margin + 12, yPosition);
      pdf.setTextColor(...textMedium);
      pdf.text(report.summary.totalHosts.toString(), margin + 75, yPosition);
      yPosition += lineHeight + 2;
      
      pdf.setTextColor(...textDark);
      pdf.text(`Total Guests:`, margin + 12, yPosition);
      pdf.setTextColor(...textMedium);
      pdf.text(report.summary.totalGuests.toString(), margin + 75, yPosition);
    } else if (reportType === "Financial Metrics Report") {
      // Draw summary box for Financial Metrics Report
      const formatCurrency = (amount) => {
        const numAmount = parseFloat(amount) || 0;
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(numAmount);
      };

      // Calculate summary box height
      let summaryBoxHeight = 20; // Base height for title
      summaryBoxHeight += 10; // Title spacing
      summaryBoxHeight += (lineHeight + 2) * 3; // 3 main metrics (Gross Revenue, Platform Revenue, Host Payouts)
      summaryBoxHeight += 5; // Divider spacing
      summaryBoxHeight += (lineHeight + 2) * 4; // Additional metrics
      summaryBoxHeight += 5; // Bottom padding
      
      // Draw summary box
      pdf.setFillColor(...white);
      pdf.setDrawColor(...borderGray);
      pdf.setLineWidth(0.5);
      pdf.roundedRect(margin, yPosition - 8, pageWidth - (margin * 2), summaryBoxHeight, 4, 4, "FD");
      
      // Green accent bar on left side
      pdf.setFillColor(...royalBlue);
      pdf.rect(margin, yPosition - 8, 4, summaryBoxHeight, "F");
      
      // Section title
      pdf.setFontSize(15);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...navyBlue);
      pdf.text("Financial Metrics Summary", margin + 12, yPosition + 3);
      
      // Subtle underline
      pdf.setDrawColor(...royalBlue);
      pdf.setLineWidth(0.8);
      pdf.line(margin + 12, yPosition + 5, margin + 150, yPosition + 5);
      
      yPosition += 12;
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const valueX = pageWidth - margin - 12;
      
      // Gross Revenue
      pdf.setTextColor(...textDark);
      pdf.text(`Gross Revenue:`, margin + 12, yPosition);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...royalBlue);
      pdf.text(formatCurrency(report.summary?.grossRevenue || 0), valueX, yPosition, { align: "right" });
      yPosition += lineHeight + 2;
      
      // Platform Revenue
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...textDark);
      pdf.text(`Platform Revenue (${report.summary?.serviceFeePercentage || 7}%):`, margin + 12, yPosition);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...royalBlue);
      pdf.text(formatCurrency(report.summary?.platformRevenue || 0), valueX, yPosition, { align: "right" });
      yPosition += lineHeight + 2;
      
      // Host Payouts
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...textDark);
      pdf.text(`Host Payouts:`, margin + 12, yPosition);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...royalBlue);
      pdf.text(formatCurrency(report.summary?.hostPayouts || 0), valueX, yPosition, { align: "right" });
      yPosition += lineHeight + 3;
      
      // Divider
      pdf.setDrawColor(...royalBlue);
      pdf.setLineWidth(0.5);
      pdf.line(margin + 12, yPosition - 2, pageWidth - margin - 12, yPosition - 2);
      yPosition += 5;
      
      // Additional metrics
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(...textMedium);
      
      pdf.text(`Total Confirmed Bookings: ${report.summary?.totalConfirmedBookings || 0}`, margin + 12, yPosition);
      yPosition += lineHeight + 2;
      
      pdf.text(`Total Completed Withdrawals: ${report.summary?.totalCompletedWithdrawals || 0}`, margin + 12, yPosition);
      yPosition += lineHeight + 2;
      
      pdf.text(`Average Booking Value: ${formatCurrency(report.summary?.averageBookingValue || 0)}`, margin + 12, yPosition);
      yPosition += lineHeight + 2;
      
      pdf.text(`Average Withdrawal Amount: ${formatCurrency(report.summary?.averageWithdrawalAmount || 0)}`, margin + 12, yPosition);
      yPosition += lineHeight + 5;
      
      pdf.setFontSize(10);
    } else if (reportType === "Review Analytics Report") {
      // Draw summary box for Review Analytics Report
      const formatCurrency = (amount) => {
        const numAmount = parseFloat(amount) || 0;
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(numAmount);
      };

      // Calculate summary box height
      let summaryBoxHeight = 20; // Base height for title
      summaryBoxHeight += 10; // Title spacing
      summaryBoxHeight += (lineHeight + 2) * 3; // Main stats
      summaryBoxHeight += 5; // Divider spacing
      summaryBoxHeight += (lineHeight + 1) * 5; // Rating distribution
      summaryBoxHeight += 5; // Bottom padding
      
      // Draw summary box
      pdf.setFillColor(...white);
      pdf.setDrawColor(...borderGray);
      pdf.setLineWidth(0.5);
      pdf.roundedRect(margin, yPosition - 8, pageWidth - (margin * 2), summaryBoxHeight, 4, 4, "FD");
      
      // Yellow accent bar on left side
      pdf.setFillColor(255, 204, 0); // #FFCC00
      pdf.rect(margin, yPosition - 8, 4, summaryBoxHeight, "F");
      
      // Section title
      pdf.setFontSize(15);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...navyBlue);
      pdf.text("Review Analytics Summary", margin + 12, yPosition + 3);
      
      // Subtle underline
      pdf.setDrawColor(255, 204, 0);
      pdf.setLineWidth(0.8);
      pdf.line(margin + 12, yPosition + 5, margin + 150, yPosition + 5);
      
      yPosition += 12;
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const valueX = pageWidth - margin - 12;
      
      // Total Reviews
      pdf.setTextColor(...textDark);
      pdf.text(`Total Reviews:`, margin + 12, yPosition);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...royalBlue);
      pdf.text((report.summary?.totalReviews || 0).toString(), valueX, yPosition, { align: "right" });
      yPosition += lineHeight + 2;
      
      // Total Listings
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...textDark);
      pdf.text(`Total Listings Reviewed:`, margin + 12, yPosition);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...royalBlue);
      pdf.text((report.summary?.totalListings || 0).toString(), valueX, yPosition, { align: "right" });
      yPosition += lineHeight + 2;
      
      // Overall Average Rating
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...textDark);
      pdf.text(`Overall Average Rating:`, margin + 12, yPosition);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...royalBlue);
      pdf.text((report.summary?.overallAverageRating || 0).toFixed(2), valueX, yPosition, { align: "right" });
      yPosition += lineHeight + 3;
      
      // Divider
      pdf.setDrawColor(255, 204, 0);
      pdf.setLineWidth(0.5);
      pdf.line(margin + 12, yPosition - 2, pageWidth - margin - 12, yPosition - 2);
      yPosition += 5;
      
      // Rating Distribution
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(...textDark);
      pdf.text("Rating Distribution:", margin + 12, yPosition);
      yPosition += lineHeight + 1;
      
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...textMedium);
      const dist = report.summary?.ratingDistribution || {};
      pdf.text(`5 Stars: ${dist[5] || 0}`, margin + 18, yPosition);
      yPosition += lineHeight + 1;
      pdf.text(`4 Stars: ${dist[4] || 0}`, margin + 18, yPosition);
      yPosition += lineHeight + 1;
      pdf.text(`3 Stars: ${dist[3] || 0}`, margin + 18, yPosition);
      yPosition += lineHeight + 1;
      pdf.text(`2 Stars: ${dist[2] || 0}`, margin + 18, yPosition);
      yPosition += lineHeight + 1;
      pdf.text(`1 Star: ${dist[1] || 0}`, margin + 18, yPosition);
      yPosition += lineHeight + 5;
      
      pdf.setFontSize(10);
    } else if (reportType === "Listing Performance Report") {
      // Draw summary box for Listing Performance Report
      const listingSummaryHeight = 50;
      pdf.setFillColor(...white);
      pdf.setDrawColor(...borderGray);
      pdf.setLineWidth(0.5);
      pdf.roundedRect(margin, yPosition - 8, pageWidth - (margin * 2), listingSummaryHeight, 4, 4, "FD");
      
      pdf.setFillColor(...royalBlue);
      pdf.rect(margin, yPosition - 8, 4, listingSummaryHeight, "F");
      
      pdf.setFontSize(15);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...navyBlue);
      pdf.text("Executive Summary", margin + 12, yPosition + 3);
      
      pdf.setDrawColor(...royalBlue);
      pdf.setLineWidth(0.8);
      pdf.line(margin + 12, yPosition + 5, margin + 100, yPosition + 5);
      
      yPosition += 12;
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      
      pdf.setTextColor(...textDark);
      pdf.text(`Total Listings:`, margin + 12, yPosition);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...royalBlue);
      pdf.text(report.summary.totalListings.toString(), margin + 75, yPosition);
      yPosition += lineHeight + 2;
      
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...textDark);
      pdf.text(`Active Listings:`, margin + 12, yPosition);
      pdf.setTextColor(...textMedium);
      pdf.text(report.summary.activeListings.toString(), margin + 75, yPosition);
    }

    yPosition += sectionSpacing + 10;

    // Detailed Data Section
    // Transactions Table for Financial Report (skip for Financial Metrics Report)
    if (reportType === "Financial Metrics Report") {
      // Financial Metrics Report is summary-only, no table needed
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(...textMedium);
      pdf.text("This report provides a summary of key financial metrics for the selected period.", margin, yPosition);
      yPosition += lineHeight + 5;
    } else if (reportType === "Review Analytics Report") {
      // Best Reviews Table
      if (report.bestReviews && report.bestReviews.length > 0) {
        checkPageBreak(50);
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...navyBlue);
        pdf.text("Best Rated Listings", margin, yPosition);
        yPosition += 12;
        
        // Table header
        pdf.setFillColor(...navyBlue);
        pdf.roundedRect(margin, yPosition - 7, pageWidth - (margin * 2), 12, 3, 3, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...white);
        pdf.setFontSize(9);
        pdf.text("Rank", margin + 6, yPosition);
        pdf.text("Listing Title", margin + 25, yPosition);
        pdf.text("Rating", pageWidth - margin - 40, yPosition, { align: "right" });
        pdf.text("Reviews", pageWidth - margin - 5, yPosition, { align: "right" });
        yPosition += 14;
        pdf.setFont("helvetica", "normal");
        
        report.bestReviews.forEach((listing, index) => {
          checkPageBreak(12);
          
          // Green background for best reviews
          pdf.setFillColor(240, 253, 244); // green-50
          pdf.setDrawColor(187, 247, 208); // green-200
          pdf.setLineWidth(0.3);
          pdf.roundedRect(margin, yPosition - 6, pageWidth - (margin * 2), lineHeight + 3, 2, 2, "FD");
          
          pdf.setTextColor(...textDark);
          pdf.setFontSize(9);
          pdf.text(`#${index + 1}`, margin + 6, yPosition);
          pdf.text(listing.listingTitle || "Unknown", margin + 25, yPosition);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(34, 197, 94); // green-600
          pdf.text(listing.averageRating.toFixed(1), pageWidth - margin - 40, yPosition, { align: "right" });
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(...textMedium);
          pdf.text(`${listing.count}`, pageWidth - margin - 5, yPosition, { align: "right" });
          yPosition += lineHeight + 4;
        });
        
        yPosition += 10;
      }
      
      // Lowest Reviews Table
      if (report.lowestReviews && report.lowestReviews.length > 0) {
        checkPageBreak(50);
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...navyBlue);
        pdf.text("Lowest Rated Listings", margin, yPosition);
        yPosition += 12;
        
        // Table header
        pdf.setFillColor(...navyBlue);
        pdf.roundedRect(margin, yPosition - 7, pageWidth - (margin * 2), 12, 3, 3, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...white);
        pdf.setFontSize(9);
        pdf.text("Rank", margin + 6, yPosition);
        pdf.text("Listing Title", margin + 25, yPosition);
        pdf.text("Rating", pageWidth - margin - 40, yPosition, { align: "right" });
        pdf.text("Reviews", pageWidth - margin - 5, yPosition, { align: "right" });
        yPosition += 14;
        pdf.setFont("helvetica", "normal");
        
        report.lowestReviews.forEach((listing, index) => {
          checkPageBreak(12);
          
          // Red background for lowest reviews
          pdf.setFillColor(254, 242, 242); // red-50
          pdf.setDrawColor(254, 202, 202); // red-200
          pdf.setLineWidth(0.3);
          pdf.roundedRect(margin, yPosition - 6, pageWidth - (margin * 2), lineHeight + 3, 2, 2, "FD");
          
          pdf.setTextColor(...textDark);
          pdf.setFontSize(9);
          pdf.text(`#${index + 1}`, margin + 6, yPosition);
          pdf.text(listing.listingTitle || "Unknown", margin + 25, yPosition);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(220, 38, 38); // red-600
          pdf.text(listing.averageRating.toFixed(1), pageWidth - margin - 40, yPosition, { align: "right" });
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(...textMedium);
          pdf.text(`${listing.count}`, pageWidth - margin - 5, yPosition, { align: "right" });
          yPosition += lineHeight + 4;
        });
      } else if (report.bestReviews && report.bestReviews.length === 0 && report.lowestReviews && report.lowestReviews.length === 0) {
        checkPageBreak(30);
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...textMedium);
        pdf.text("No reviews found for the selected period.", margin, yPosition);
        yPosition += lineHeight + 5;
      }
    } else if (reportType === "Financial Report" && report.transactions && report.transactions.length > 0) {
      checkPageBreak(50);
      
      // Section title with proper spacing
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...navyBlue);
      pdf.text("Transaction History", margin, yPosition);
      yPosition += 15;

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      
      const formatCurrency = (amount) => {
        const numAmount = parseFloat(amount) || 0;
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(numAmount);
      };

      const formatDate = (date) => {
        if (!date) return "N/A";
        try {
          let dateObj;
          if (date instanceof Date) {
            dateObj = date;
          } else if (date.toDate && typeof date.toDate === 'function') {
            dateObj = date.toDate();
          } else {
            dateObj = new Date(date);
          }
          
          if (isNaN(dateObj.getTime())) return "N/A";
          
          return dateObj.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
          });
        } catch (error) {
          return "N/A";
        }
      };
      
      // Define column positions for better spacing
      const colDate = margin + 6;
      const colType = margin + 35;
      const colDescription = margin + 58;
      const colAmount = pageWidth - margin - 55;
      const colStatus = pageWidth - margin - 5;
      const descriptionMaxWidth = colAmount - colDescription - 8; // Leave 8px gap before amount
      
      // Professional table header with navy blue background
      pdf.setFillColor(...navyBlue);
      pdf.roundedRect(margin, yPosition - 7, pageWidth - (margin * 2), 12, 3, 3, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...white);
      pdf.setFontSize(9);
      pdf.text("Date", colDate, yPosition);
      pdf.text("Type", colType, yPosition);
      pdf.text("Description", colDescription, yPosition);
      pdf.text("Amount", colAmount, yPosition, { align: "right" });
      pdf.text("Status", colStatus, yPosition, { align: "right" });
      yPosition += 14;
      pdf.setFont("helvetica", "normal");

      // Limit to first 100 transactions to avoid PDF being too long
      const transactionsToShow = (report.transactions || []).slice(0, 100);
      transactionsToShow.forEach((transaction, index) => {
        checkPageBreak(12);
        
        // White background with subtle border for each row
        pdf.setFillColor(...white);
        pdf.setDrawColor(...borderGray);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(margin, yPosition - 6, pageWidth - (margin * 2), lineHeight + 3, 2, 2, "FD");
        
        // Light blue background for alternate rows
        if (index % 2 === 0) {
          pdf.setFillColor(...lightBlue);
          pdf.roundedRect(margin, yPosition - 6, pageWidth - (margin * 2), lineHeight + 3, 2, 2, "F");
        }
        
        // Date - safely format (smaller font for compact display)
        pdf.setTextColor(...textMedium);
        pdf.setFontSize(8);
        pdf.text(formatDate(transaction.date), colDate, yPosition);
        
        // Type with color coding
        const transactionType = transaction.type || "N/A";
        const typeColor = transactionType === "Revenue" ? royalBlue : (transaction.amount < 0 ? accentBlue : textDark);
        pdf.setTextColor(...typeColor);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.text(transactionType, colType, yPosition);
        pdf.setFont("helvetica", "normal");
        
        // Description (truncate to fit available space)
        const description = (transaction.description || "N/A");
        // Calculate max characters that fit in the available width (approx 4.5px per character at 8pt font)
        const maxChars = Math.floor(descriptionMaxWidth / 4.5);
        const truncatedDesc = description.length > maxChars 
          ? description.substring(0, maxChars - 3) + "..." 
          : description;
        pdf.setTextColor(...textDark);
        pdf.setFontSize(8);
        pdf.text(truncatedDesc, colDescription, yPosition);
        
        // Amount with color coding (blue for positive, darker blue for negative)
        const amount = parseFloat(transaction.amount) || 0;
        const amountColor = amount >= 0 ? royalBlue : accentBlue;
        pdf.setTextColor(...amountColor);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        // Format amount - formatCurrency already handles the sign correctly
        const amountText = formatCurrency(Math.abs(amount));
        const signedAmountText = amount >= 0 ? `+${amountText}` : `-${amountText}`;
        pdf.text(signedAmountText, colAmount, yPosition, { align: "right" });
        pdf.setFont("helvetica", "normal");
        
        // Status - properly capitalize (smaller font)
        pdf.setTextColor(...textMedium);
        pdf.setFontSize(7);
        const status = (transaction.status || "N/A").toString();
        const statusText = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
        pdf.text(statusText, colStatus, yPosition, { align: "right" });
        
        yPosition += lineHeight + 4;
      });

      if ((report.transactions || []).length > 100) {
        yPosition += 5;
        pdf.setFontSize(8);
        pdf.setTextColor(...textLight);
        pdf.text(`(Showing first 100 of ${report.transactions.length} transactions)`, margin, yPosition);
        pdf.setTextColor(...textDark);
        pdf.setFontSize(9);
      }
    } else if (reportType === "Financial Report") {
      // No transactions message
      checkPageBreak(30);
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...textMedium);
      pdf.text("No transactions found for the selected period.", margin, yPosition);
      yPosition += lineHeight + 5;
    } else if (reportType === "User Report" && report.users && report.users.length > 0) {
      checkPageBreak(50);
      
      // Section title
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...navyBlue);
      pdf.text("User Details", margin, yPosition);
      yPosition += 12;

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      
      // Professional table header with navy blue background
      pdf.setFillColor(...navyBlue);
      pdf.roundedRect(margin, yPosition - 7, pageWidth - (margin * 2), 12, 3, 3, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...white);
      pdf.text("Email", margin + 6, yPosition);
      pdf.text("Role", margin + 90, yPosition);
      pdf.text("Joined", margin + 140, yPosition);
      yPosition += 14;
      pdf.setFont("helvetica", "normal");

      // Limit to first 50 users to avoid PDF being too long
      const usersToShow = report.users.slice(0, 50);
      usersToShow.forEach((user, index) => {
        checkPageBreak(12);
        
        // White background with subtle border for each row
        pdf.setFillColor(...white);
        pdf.setDrawColor(...borderGray);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(margin, yPosition - 6, pageWidth - (margin * 2), lineHeight + 3, 2, 2, "FD");
        
        // Light blue background for alternate rows
        if (index % 2 === 0) {
          pdf.setFillColor(...lightBlue);
          pdf.roundedRect(margin, yPosition - 6, pageWidth - (margin * 2), lineHeight + 3, 2, 2, "F");
        }
        
        const roles = user.roles || (user.role ? [user.role] : []);
        const roleText = roles.join(", ") || "N/A";
        const joinedDate = user.createdAt?.toDate 
          ? user.createdAt.toDate().toLocaleDateString()
          : user.createdAt 
          ? new Date(user.createdAt).toLocaleDateString()
          : "N/A";

        pdf.setTextColor(...textDark);
        pdf.text(user.email || "N/A", margin + 6, yPosition);
        pdf.setTextColor(...textMedium);
        pdf.text(roleText, margin + 90, yPosition);
        pdf.setTextColor(...textLight);
        pdf.text(joinedDate, margin + 140, yPosition);
        yPosition += lineHeight + 4;
      });

      if (report.users.length > 50) {
        yPosition += 5;
        pdf.setFontSize(8);
        pdf.setTextColor(...textLight);
        pdf.text(`(Showing first 50 of ${report.users.length} users)`, margin, yPosition);
        pdf.setTextColor(...textDark);
      }
    } else if (reportType === "Listing Performance Report" && report.listings && report.listings.length > 0) {
      checkPageBreak(50);
      
      // Section title
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...navyBlue);
      pdf.text("Listing Performance", margin, yPosition);
      yPosition += 12;

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      
      // Professional table header with navy blue background
      pdf.setFillColor(...navyBlue);
      pdf.roundedRect(margin, yPosition - 7, pageWidth - (margin * 2), 12, 3, 3, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...white);
      pdf.text("Title", margin + 6, yPosition);
      pdf.text("Status", margin + 75, yPosition);
      pdf.text("Bookings", margin + 100, yPosition);
      pdf.text("Revenue", margin + 125, yPosition);
      pdf.text("Rating", margin + 160, yPosition);
      yPosition += 14;
      pdf.setFont("helvetica", "normal");

      const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(amount);
      };

      // Limit to first 50 listings
      const listingsToShow = report.listings.slice(0, 50);
      listingsToShow.forEach((listing, index) => {
        checkPageBreak(12);
        
        // White background with subtle border for each row
        pdf.setFillColor(...white);
        pdf.setDrawColor(...borderGray);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(margin, yPosition - 6, pageWidth - (margin * 2), lineHeight + 3, 2, 2, "FD");
        
        // Light blue background for alternate rows
        if (index % 2 === 0) {
          pdf.setFillColor(...lightBlue);
          pdf.roundedRect(margin, yPosition - 6, pageWidth - (margin * 2), lineHeight + 3, 2, 2, "F");
        }
        
        const title = listing.title.length > 25 ? listing.title.substring(0, 22) + "..." : listing.title;
        pdf.setTextColor(...textDark);
        pdf.text(title, margin + 6, yPosition);
        pdf.setTextColor(...textMedium);
        pdf.text(listing.status || "N/A", margin + 75, yPosition);
        pdf.text(listing.confirmedBookings?.toString() || "0", margin + 100, yPosition);
        pdf.setTextColor(...royalBlue);
        pdf.setFont("helvetica", "bold");
        pdf.text(formatCurrency(listing.totalRevenue || 0), margin + 125, yPosition);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...textDark);
        pdf.text(listing.averageRating ? listing.averageRating.toFixed(1) : "N/A", margin + 160, yPosition);
        yPosition += lineHeight + 4;
      });

      if (report.listings.length > 50) {
        yPosition += 5;
        pdf.setFontSize(8);
        pdf.setTextColor(...textLight);
        pdf.text(`(Showing first 50 of ${report.listings.length} listings)`, margin, yPosition);
        pdf.setTextColor(...textDark);
      }
    }

    // Professional footer on each page with branding
    const pageCount = pdf.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      
      // Subtle blue accent line at footer
      pdf.setDrawColor(...royalBlue);
      pdf.setLineWidth(0.8);
      pdf.line(margin, pageHeight - 30, pageWidth - margin, pageHeight - 30);
      
      // Footer background with light blue tint
      pdf.setFillColor(...lightBlue);
      pdf.rect(0, pageHeight - 28, pageWidth, 28, "F");
      
      // Footer text with professional styling
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...textMedium);
      pdf.text(
        `Voyago Administrative Report`,
        margin,
        pageHeight - 18,
        { align: "left" }
      );
      
      pdf.setTextColor(...navyBlue);
      pdf.setFont("helvetica", "bold");
      pdf.text(
        `Page ${i} of ${pageCount}`,
        pageWidth - margin,
        pageHeight - 18,
        { align: "right" }
      );
      
      // Generated date in footer
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...textLight);
      pdf.text(
        `Generated: ${report.generatedAt}`,
        pageWidth / 2,
        pageHeight - 18,
        { align: "center" }
      );
      
      // Confidentiality notice
      pdf.setFontSize(7);
      pdf.setTextColor(...textLight);
      pdf.text(
        `Confidential - For Internal Use Only`,
        pageWidth / 2,
        pageHeight - 10,
        { align: "center" }
      );
    }

    // Save the PDF
    const fileName = `${reportType.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;
    pdf.save(fileName);
  };

  const handleGenerateReport = async (reportType) => {
    try {
      setGenerating(true);
      setReportData(null);

      // Use date range if provided
      let reportStartDate = null;
      let reportEndDate = null;
      if (startDate && endDate) {
        reportStartDate = new Date(startDate);
        reportEndDate = new Date(endDate);
        reportEndDate.setHours(23, 59, 59, 999);
      }

      const data = await fetchReportData(reportType, reportStartDate, reportEndDate);
      let report;

      // Format date range for display
      const dateRange = reportStartDate && reportEndDate
        ? {
            start: reportStartDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            end: reportEndDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            startDate: reportStartDate,
            endDate: reportEndDate
          }
        : null;

      switch (reportType) {
        case "Financial Report":
          report = generateFinancialReport(data, dateRange);
          break;
        case "User Report":
          report = generateUserReport(data, dateRange);
          break;
        case "Listing Performance Report":
          report = generateListingPerformanceReport(data, dateRange);
          break;
        case "Financial Metrics Report":
          report = generateFinancialMetricsReport(data, dateRange);
          break;
        case "Review Analytics Report":
          report = generateReviewAnalyticsReport(data, dateRange);
          break;
        default:
          throw new Error("Unknown report type");
      }

      setReportData(report);
      downloadReport(report, reportType);
      alert(`${reportType} generated and downloaded successfully!`);
    } catch (error) {
      console.error("Error generating report:", error);
      alert(`Failed to generate ${reportType}. Please try again.`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeInUp">
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100">
        <h2 className="text-2xl font-light text-[#1C1C1E] mb-2">Report Generation</h2>
        <p className="text-sm text-[#8E8E93] font-light mb-6">
          Generate comprehensive reports for financial data, user activity, and listing performance.
        </p>

        <div className="bg-gray-50 rounded-xl p-6 mb-6">
          <label className="block text-sm font-medium text-[#1C1C1E] mb-4">
            Date Range (Optional)
          </label>
          <div className="mb-4">
            <DatePicker
              selected={startDate}
              onChange={(dates) => {
                const [start, end] = dates || [null, null];
                setStartDate(start);
                setEndDate(end);
              }}
              startDate={startDate}
              endDate={endDate}
              selectsRange
              maxDate={new Date()}
              placeholderText="Select date range"
              dateFormat="yyyy-MM-dd"
              isClearable
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/10 bg-white text-[#1C1C1E] font-light cursor-pointer"
              calendarClassName="!rounded-xl !border-gray-200 !shadow-lg"
              wrapperClassName="w-full"
            />
          </div>
          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate(null);
                setEndDate(null);
              }}
              className="text-sm text-[#0071E3] font-light hover:underline flex items-center gap-2 mb-4"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear dates
            </button>
          )}
          <p className="text-xs text-[#8E8E93] font-light mt-4 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Leave empty for all-time reports. Click to select start date, then click again to select end date.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            onClick={() => handleGenerateReport("Financial Report")}
            disabled={generating}
            className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl p-6 flex items-center gap-4 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-lg font-light">{generating ? "Generating..." : "Financial Report"}</span>
          </button>

          <button
            onClick={() => handleGenerateReport("Financial Metrics Report")}
            disabled={generating}
            className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl p-6 flex items-center gap-4 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-lg font-light">{generating ? "Generating..." : "Financial Metrics"}</span>
          </button>

          <button
            onClick={() => handleGenerateReport("User Report")}
            disabled={generating}
            className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl p-6 flex items-center gap-4 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span className="text-lg font-light">{generating ? "Generating..." : "User Report"}</span>
          </button>

          <button
            onClick={() => handleGenerateReport("Listing Performance Report")}
            disabled={generating}
            className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl p-6 flex items-center gap-4 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span className="text-lg font-light">{generating ? "Generating..." : "Listing Performance Report"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Policy Content Component
const PolicyContent = () => {
  const [loading, setLoading] = useState(true);
  const [policySections, setPolicySections] = useState({
    introduction: "",
    generalPlatformRules: "",
    bookingPaymentPolicy: "",
    cancellationRefundPolicy: "",
    hostResponsibilities: "",
    codeOfConduct: "",
    privacyDataProtection: ""
  });
  const [savingSection, setSavingSection] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchAdminSettings();
  }, []);

  const fetchAdminSettings = async () => {
    try {
      setLoading(true);
      
      // Fetch narrative policy content
      const policyContentDoc = await getDoc(doc(db, "adminSettings", "policyContent"));
      if (policyContentDoc.exists()) {
        const data = policyContentDoc.data();
        // Check if it's the new structure (sections) or old structure (single content)
        if (data.sections) {
          setPolicySections(data.sections);
        } else if (data.content) {
          // Migrate old format to new format
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
          // Set default content
          setPolicySections({
            introduction: "Welcome to Voyago, a peer-to-peer accommodation booking platform connecting guests with verified hosts offering unique stays and experiences. By using Voyago, you agree to comply with these policies, which are designed to ensure a safe, fair, and transparent environment for all users.",
            generalPlatformRules: "All users must provide accurate and up-to-date information in their profiles and listings. Any attempt to mislead, defraud, or manipulate the platform or its users will result in immediate account suspension. Voyago reserves the right to review, remove, or suspend any listing or booking that violates these policies. All communication and transactions must occur within the Voyago platform for security and tracking purposes.",
            bookingPaymentPolicy: "Guests must complete full payment through Voyago's secure payment system before a booking is confirmed. The host will receive their payout 24 hours after the check-in date, once the booking is verified as completed. Payments are held temporarily by Voyago to ensure proper transaction processing and compliance.",
            cancellationRefundPolicy: "Cancellation policies vary by listing and are clearly displayed before booking. Guests may cancel according to the host's cancellation policy. Refunds will be processed according to the policy terms. Hosts who cancel confirmed bookings may face penalties and account restrictions.",
            hostResponsibilities: "Hosts are responsible for maintaining accurate listing information, providing clean and safe accommodations, responding to guest inquiries promptly, and honoring confirmed bookings. Hosts must comply with all local laws and regulations regarding short-term rentals.",
            codeOfConduct: "All hosts must maintain professional conduct, treat guests with respect, and provide accurate descriptions of their properties. Discrimination of any kind is strictly prohibited. Hosts must respond to booking requests and messages in a timely manner.",
            privacyDataProtection: "Voyago is committed to protecting user privacy. All personal information is handled according to our Privacy Policy. Hosts must respect guest privacy and not share guest information with third parties without consent."
          });
        }
      } else {
        // Set default content
        setPolicySections({
          introduction: "Welcome to Voyago, a peer-to-peer accommodation booking platform connecting guests with verified hosts offering unique stays and experiences. By using Voyago, you agree to comply with these policies, which are designed to ensure a safe, fair, and transparent environment for all users.",
          generalPlatformRules: "All users must provide accurate and up-to-date information in their profiles and listings. Any attempt to mislead, defraud, or manipulate the platform or its users will result in immediate account suspension. Voyago reserves the right to review, remove, or suspend any listing or booking that violates these policies. All communication and transactions must occur within the Voyago platform for security and tracking purposes.",
          bookingPaymentPolicy: "Guests must complete full payment through Voyago's secure payment system before a booking is confirmed. The host will receive their payout 24 hours after the check-in date, once the booking is verified as completed. Payments are held temporarily by Voyago to ensure proper transaction processing and compliance.",
          cancellationRefundPolicy: "Cancellation policies vary by listing and are clearly displayed before booking. Guests may cancel according to the host's cancellation policy. Refunds will be processed according to the policy terms. Hosts who cancel confirmed bookings may face penalties and account restrictions.",
          hostResponsibilities: "Hosts are responsible for maintaining accurate listing information, providing clean and safe accommodations, responding to guest inquiries promptly, and honoring confirmed bookings. Hosts must comply with all local laws and regulations regarding short-term rentals.",
          codeOfConduct: "All hosts must maintain professional conduct, treat guests with respect, and provide accurate descriptions of their properties. Discrimination of any kind is strictly prohibited. Hosts must respond to booking requests and messages in a timely manner.",
          privacyDataProtection: "Voyago is committed to protecting user privacy. All personal information is handled according to our Privacy Policy. Hosts must respect guest privacy and not share guest information with third parties without consent."
        });
      }
    } catch (error) {
      console.error("Error fetching admin settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSection = async (sectionKey) => {
    try {
      setSavingSection(sectionKey);
      await setDoc(doc(db, "adminSettings", "policyContent"), {
        sections: policySections,
        type: "policyContent",
          updatedAt: serverTimestamp()
      }, { merge: true });
      alert(`${getSectionTitle(sectionKey)} saved successfully!`);
    } catch (error) {
      console.error("Error saving policy section:", error);
      alert("Failed to save policy section. Please try again.");
    } finally {
      setSavingSection(null);
    }
  };

  const getSectionTitle = (key) => {
    const titles = {
      introduction: "Introduction",
      generalPlatformRules: "General Platform Rules",
      bookingPaymentPolicy: "Booking & Payment Policy",
      cancellationRefundPolicy: "Cancellation & Refund Policy",
      hostResponsibilities: "Host Responsibilities",
      codeOfConduct: "Code of Conduct",
      privacyDataProtection: "Privacy & Data Protection"
    };
    return titles[key] || key;
  };

  const policySectionsList = [
    { key: "introduction", title: "Introduction", icon: "📝", color: "blue" },
    { key: "generalPlatformRules", title: "General Platform Rules", icon: "🛡️", color: "blue" },
    { key: "bookingPaymentPolicy", title: "Booking & Payment Policy", icon: "💳", color: "green" },
    { key: "cancellationRefundPolicy", title: "Cancellation & Refund Policy", icon: "↩️", color: "orange" },
    { key: "hostResponsibilities", title: "Host Responsibilities", icon: "🏠", color: "purple" },
    { key: "codeOfConduct", title: "Code of Conduct", icon: "✅", color: "indigo" },
    { key: "privacyDataProtection", title: "Privacy & Data Protection", icon: "🔒", color: "gray" }
  ];

  const handleGeneratePolicyReport = () => {
    try {
      setGenerating(true);
      
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let yPosition = 0;
      const margin = 20;
      const lineHeight = 8;
      const sectionSpacing = 15;
      
      // Professional white and blue color scheme (same as financial report)
      const navyBlue = [0, 51, 102]; // #003366 - Deep professional blue
      const royalBlue = [25, 118, 210]; // #1976D2 - Primary blue
      const lightBlue = [227, 242, 253]; // #E3F2FD - Light blue background
      const textDark = [33, 33, 33]; // #212121 - Dark text
      const textMedium = [97, 97, 97]; // #616161 - Medium gray text
      const textLight = [158, 158, 158]; // #9E9E9E - Light gray text
      const white = [255, 255, 255]; // Pure white
      const borderGray = [224, 224, 224]; // #E0E0E0 - Subtle borders

      // Helper function to add header on each page
      const addHeader = () => {
        // Clean white background with blue accent bar
        pdf.setFillColor(...white);
        pdf.rect(0, 0, pageWidth, 60, "F");
        
        // Blue accent bar at top
        pdf.setFillColor(...navyBlue);
        pdf.rect(0, 0, pageWidth, 8, "F");
        
        // Voyago brand text in navy blue
        pdf.setTextColor(...navyBlue);
        pdf.setFontSize(28);
        pdf.setFont("helvetica", "bold");
        pdf.text("Voyago", margin, 25);
        
        // Elegant subtitle
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...textMedium);
        pdf.text("Administrative Report", margin, 35);
        
        // Professional blue underline
        pdf.setDrawColor(...royalBlue);
        pdf.setLineWidth(1.5);
        pdf.line(margin, 40, margin + 80, 40);
        
        // Date and report type in top right
        pdf.setFontSize(9);
        pdf.setTextColor(...textLight);
        pdf.text("Policy & Compliance Report", pageWidth - margin, 25, { align: "right" });
        pdf.text(`Generated: ${new Date().toLocaleString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        })}`, pageWidth - margin, 35, { align: "right" });
        
        // Subtle separator line
        pdf.setDrawColor(...borderGray);
        pdf.setLineWidth(0.5);
        pdf.line(margin, 55, pageWidth - margin, 55);
        
        // Reset text color
        pdf.setTextColor(...textDark);
        yPosition = 70;
      };

      // Helper function to add a new page if needed
      const checkPageBreak = (requiredSpace = 20) => {
        if (yPosition + requiredSpace > pageHeight - margin) {
          pdf.addPage();
          addHeader();
          return true;
        }
        return false;
      };

      // Helper function to split text into lines that fit the page width
      const splitTextIntoLines = (text, maxWidth) => {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        words.forEach(word => {
          const testLine = currentLine + (currentLine ? ' ' : '') + word;
          const testWidth = pdf.getTextWidth(testLine);
          
          if (testWidth > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        });
        
        if (currentLine) {
          lines.push(currentLine);
        }
        
        return lines;
      };

      // Add header to first page
      addHeader();

      // Report Title with professional styling
      pdf.setFontSize(20);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...navyBlue);
      pdf.text("Policy & Compliance Report", margin, yPosition);
      yPosition += sectionSpacing + 5;

      // Executive Summary Section (same style as financial report)
      checkPageBreak(80);
      const summaryStartY = yPosition;
      const summaryBoxHeight = 50;
      
      // Draw summary box
      pdf.setFillColor(...white);
      pdf.setDrawColor(...borderGray);
      pdf.setLineWidth(0.5);
      pdf.roundedRect(margin, yPosition - 8, pageWidth - (margin * 2), summaryBoxHeight, 4, 4, "FD");
      
      // Blue accent bar on left side
      pdf.setFillColor(...royalBlue);
      pdf.rect(margin, yPosition - 8, 4, summaryBoxHeight, "F");
      
      // Section title with blue accent
      pdf.setFontSize(15);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...navyBlue);
      pdf.text("Executive Summary", margin + 12, yPosition + 3);
      
      // Subtle underline
      pdf.setDrawColor(...royalBlue);
      pdf.setLineWidth(0.8);
      pdf.line(margin + 12, yPosition + 5, margin + 100, yPosition + 5);
      
      yPosition += 12;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...textDark);
      
      // Count sections
      const totalSections = Object.keys(policySections).length;
      const filledSections = Object.values(policySections).filter(s => s && s.trim()).length;
      
      pdf.text(`Total Policy Sections: ${totalSections}`, margin + 12, yPosition);
      yPosition += lineHeight + 2;
      pdf.text(`Active Sections: ${filledSections}`, margin + 12, yPosition);
      yPosition += lineHeight + 2;
      
      const lastUpdated = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      pdf.text(`Report Date: ${lastUpdated}`, margin + 12, yPosition);
      
      yPosition += summaryBoxHeight - 25;
      pdf.setFontSize(10);

      // Policy Sections Content
      yPosition += sectionSpacing;
      checkPageBreak(50);

      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...navyBlue);
      pdf.text("Policy Sections", margin, yPosition);
      yPosition += sectionSpacing;

      // Iterate through policy sections
      policySectionsList.forEach((section) => {
        checkPageBreak(60);
        
        const sectionContent = policySections[section.key] || "";
        if (!sectionContent.trim()) return; // Skip empty sections
        
        // Section header with blue accent box
        pdf.setFillColor(...lightBlue);
        pdf.setDrawColor(...borderGray);
        pdf.setLineWidth(0.5);
        pdf.roundedRect(margin, yPosition - 6, pageWidth - (margin * 2), 12, 3, 3, "FD");
        
        // Blue accent bar on left
        pdf.setFillColor(...royalBlue);
        pdf.rect(margin, yPosition - 6, 4, 12, "F");
        
        pdf.setFontSize(13);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...navyBlue);
        pdf.text(section.title, margin + 10, yPosition + 2);
        yPosition += 15;

        // Section content
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...textDark);
        
        const contentWidth = pageWidth - (margin * 2) - 10;
        const contentLines = splitTextIntoLines(sectionContent, contentWidth);
        
        contentLines.forEach(line => {
          checkPageBreak(10);
          pdf.text(line, margin + 10, yPosition);
          yPosition += lineHeight + 1;
        });
        
        yPosition += sectionSpacing;
      });

      // Professional footer on each page with branding
      const pageCount = pdf.internal.pages.length - 1;
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        
        // Subtle blue accent line at footer
        pdf.setDrawColor(...royalBlue);
        pdf.setLineWidth(0.8);
        pdf.line(margin, pageHeight - 30, pageWidth - margin, pageHeight - 30);
        
        // Footer background with light blue tint
        pdf.setFillColor(...lightBlue);
        pdf.rect(0, pageHeight - 28, pageWidth, 28, "F");
        
        // Footer text with professional styling
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...textMedium);
        pdf.text(
          `Voyago Administrative Report`,
          margin,
          pageHeight - 18,
          { align: "left" }
        );
        
        pdf.setTextColor(...navyBlue);
        pdf.setFont("helvetica", "bold");
        pdf.text(
          `Page ${i} of ${pageCount}`,
          pageWidth - margin,
          pageHeight - 18,
          { align: "right" }
        );
        
        // Generated date in footer
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...textLight);
        pdf.text(
          `Generated: ${new Date().toLocaleString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
          })}`,
          pageWidth / 2,
          pageHeight - 18,
          { align: "center" }
        );
        
        // Confidentiality notice
        pdf.setFontSize(7);
        pdf.setTextColor(...textLight);
        pdf.text(
          `Confidential - For Internal Use Only`,
          pageWidth / 2,
          pageHeight - 10,
          { align: "center" }
        );
      }

      // Save the PDF
      const fileName = `Policy_Compliance_Report_${new Date().toISOString().split("T")[0]}.pdf`;
      pdf.save(fileName);
      
      alert("Policy & Compliance Report generated and downloaded successfully!");
    } catch (error) {
      console.error("Error generating policy report:", error);
      alert("Failed to generate Policy & Compliance Report. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 animate-fadeInUp">
        <div className="text-center py-12">
          <div className="text-[#8E8E93] font-light">Loading settings...</div>
        </div>
      </div>
    );
  }

  const getColorClasses = (color) => {
    const colors = {
      blue: "bg-blue-100 text-blue-600 border-blue-200",
      green: "bg-green-100 text-green-600 border-green-200",
      orange: "bg-orange-100 text-orange-600 border-orange-200",
      purple: "bg-purple-100 text-purple-600 border-purple-200",
      indigo: "bg-indigo-100 text-indigo-600 border-indigo-200",
      gray: "bg-gray-100 text-gray-600 border-gray-200"
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="space-y-6 animate-fadeInUp">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#0071E3] flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-medium text-[#1C1C1E] mb-1">Policy & Compliance Guidelines</h2>
              <p className="text-sm text-[#8E8E93] font-light">Edit individual policy sections that appear on the guest side</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
          <a
            href="/policy"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-white border-2 border-[#0071E3] text-[#0071E3] rounded-xl text-sm font-medium hover:bg-[#0071E3]/5 transition-all"
          >
            Preview on Guest Side
          </a>
          <button
            onClick={handleGeneratePolicyReport}
            disabled={generating}
            className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl px-4 py-2 flex items-center gap-2 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>{generating ? "Generating..." : "Generate Report"}</span>
          </button>
          </div>
        </div>
      </div>
            
      {/* Policy Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {policySectionsList.map((section) => (
          <div key={section.key} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-lg ${getColorClasses(section.color)} flex items-center justify-center text-xl border`}>
                {section.icon}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-[#1C1C1E]">{section.title}</h3>
            </div>
          </div>

            <div className="space-y-4">
              <div>
                <textarea
                  value={policySections[section.key] || ""}
                  onChange={(e) => setPolicySections(prev => ({ ...prev, [section.key]: e.target.value }))}
                  placeholder={`Enter ${section.title.toLowerCase()} content...`}
                  rows={8}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/10 bg-white text-[#1C1C1E] font-light transition-all resize-y text-sm"
                />
                </div>
                <button
                onClick={() => handleSaveSection(section.key)}
                disabled={savingSection === section.key}
                className="w-full px-4 py-2 bg-[#0071E3] text-white rounded-xl text-sm font-medium hover:bg-[#0051D0] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#0071E3]/20 hover:shadow-xl hover:shadow-[#0071E3]/30"
              >
                {savingSection === section.key ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                    Saving...
                  </span>
                ) : (
                  `Save ${section.title}`
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Cash-out Approvals Content Component
const CashoutApprovalsContent = () => {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date"); // date, amount
  const [sortOrder, setSortOrder] = useState("desc"); // asc, desc
  
  // Modal states
  const [confirmModal, setConfirmModal] = useState({ show: false });
  const [notesModal, setNotesModal] = useState({ show: false });
  const [feePreviewModal, setFeePreviewModal] = useState({ show: false });
  const [processingId, setProcessingId] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  
  // Toast notification
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    fetchWithdrawals();
    
    const unsubscribe = onSnapshot(
      collection(db, "withdrawalRequests"),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setWithdrawals(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching withdrawals:", error);
        setLoading(false);
        showToast("Error loading cash-out requests", "error");
      }
    );

    return () => unsubscribe();
  }, []);

  const fetchWithdrawals = async () => {
    try {
      setLoading(true);
      const withdrawalsQuery = query(collection(db, "withdrawalRequests"));
      const snapshot = await getDocs(withdrawalsQuery);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setWithdrawals(data);
    } catch (error) {
      console.error("Error fetching withdrawals:", error);
      showToast("Error loading cash-out requests", "error");
    } finally {
      setLoading(false);
    }
  };

  // Calculate fees for a withdrawal
  const calculateFees = async (withdrawal) => {
    let commissionPercentage = 0;
    let withdrawalFee = 0;
    
    try {
      const serviceFeesQuery = query(
        collection(db, "adminSettings"),
        where("type", "==", "serviceFees")
      );
      const serviceFeesSnapshot = await getDocs(serviceFeesQuery);
      if (!serviceFeesSnapshot.empty) {
        const feesData = serviceFeesSnapshot.docs[0].data();
        commissionPercentage = feesData.commissionPercentage || 0;
        withdrawalFee = feesData.withdrawalFee || 0;
      }
    } catch (feeError) {
      console.error("Error fetching service fees:", feeError);
    }

    const requestedAmount = parseFloat(withdrawal.amount) || 0;
    const commission = (requestedAmount * commissionPercentage) / 100;
    const totalFees = commission + withdrawalFee;
    const payoutAmount = Math.max(0, requestedAmount - totalFees);

    return {
      requestedAmount,
      commissionPercentage,
      commissionAmount: commission,
      withdrawalFee,
      totalFees,
      payoutAmount
    };
  };

  // Validate PayPal email
  const isValidPayPalEmail = (email) => {
    if (!email || !email.includes("@")) return false;
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: "bg-yellow-100 text-yellow-700",
      completed: "bg-green-100 text-green-700",
      rejected: "bg-red-100 text-red-700"
    };
    return badges[status] || "bg-gray-100 text-gray-700";
  };

  const handleUpdateStatus = async (withdrawalId, newStatus, notes = null, processPayout = false) => {
    setProcessingId(withdrawalId);
    
    try {
      const withdrawalRef = doc(db, "withdrawalRequests", withdrawalId);
      const withdrawalDoc = await getDoc(withdrawalRef);
      
      if (!withdrawalDoc.exists()) {
        showToast("Withdrawal request not found.", "error");
        setProcessingId(null);
        return;
      }

      const withdrawal = withdrawalDoc.data();
      
      // Validate PayPal email if processing payout
      if (processPayout && !isValidPayPalEmail(withdrawal.paypalEmail)) {
        showToast("Invalid PayPal email address. Cannot process payout.", "error");
        setProcessingId(null);
        return;
      }

      const updateData = {
        status: newStatus,
        processedAt: serverTimestamp(),
        adminNotes: notes || null
      };

      // IMPORTANT: Process PayPal payout when approved (processPayout flag is true)
      // Note: "completed" status is now set automatically when processing payout on approval
      if (processPayout) {
        try {
          const feeBreakdown = await calculateFees(withdrawal);

          // Update withdrawal record with fee breakdown
          await updateDoc(withdrawalRef, {
            ...updateData,
            ...feeBreakdown
          });

          // Call Cloud Function to process PayPal payout
          const payoutResult = await processPayPalPayout({
            withdrawalId: withdrawalId,
            recipientEmail: withdrawal.paypalEmail,
            amount: feeBreakdown.payoutAmount.toFixed(2),
            currency: "USD"
          }, auth);

          // Check if payout was successful
          if (!payoutResult || !payoutResult.success) {
            throw new Error(payoutResult?.error || "PayPal payout failed - no success response");
          }

          // Update withdrawal with payout details
          await updateDoc(withdrawalRef, {
            ...updateData,
            payoutBatchId: payoutResult.payoutBatchId,
            payoutStatus: payoutResult.batchStatus || "PENDING",
            payoutCompletedAt: serverTimestamp()
          });

          // Update admin payments
          try {
            const adminPaymentsQuery = query(
              collection(db, "adminPayments"),
              where("withdrawalRequestId", "==", withdrawalId)
            );
            const adminPaymentsSnapshot = await getDocs(adminPaymentsQuery);
            
            const updatePromises = adminPaymentsSnapshot.docs.map(paymentDoc =>
              updateDoc(doc(db, "adminPayments", paymentDoc.id), {
                status: "completed",
                completedAt: serverTimestamp()
              })
            );
            
            await Promise.all(updatePromises);
          } catch (error) {
            console.error("Error updating admin payment records:", error);
          }

          // If processing payout on approval, also update status to completed
          if (processPayout) {
            updateData.status = "completed";
          }

          showToast(
            `Cash-out processed successfully! $${feeBreakdown.payoutAmount.toFixed(2)} sent to ${withdrawal.paypalEmail}`,
            "success"
          );
        } catch (payoutError) {
          console.error("PayPal Payout Error:", payoutError);
          
          // Don't update status if payout fails - keep it as pending
          showToast(
            `PayPal payout failed: ${payoutError.message || payoutError.error || "Unknown error"}. Please check PayPal credentials and try again.`,
            "error"
          );
          setProcessingId(null);
          return; // Exit early, don't update status
        }
      } else if (newStatus === "rejected") {
        const hostRef = doc(db, "users", withdrawal.hostId);
        const hostDoc = await getDoc(hostRef);
        
        if (hostDoc.exists()) {
          const hostData = hostDoc.data();
          const currentWalletBalance = hostData.walletBalance || 0;
          const transactions = hostData.transactions || [];
          
          const transaction = {
            type: "withdrawal_rejected",
            amount: withdrawal.amount,
            withdrawalRequestId: withdrawalId,
            date: new Date().toISOString(),
            status: "rejected",
            description: `Withdrawal rejected: $${withdrawal.amount.toFixed(2)} returned to wallet balance`
          };

          await updateDoc(hostRef, {
            walletBalance: currentWalletBalance + withdrawal.amount,
            transactions: [transaction, ...transactions].slice(0, 10)
          });
        }
        
        showToast("Withdrawal request rejected. Funds returned to host wallet.", "success");
      } else if (newStatus === "completed") {
        showToast(`Cash-out request completed successfully!`, "success");
      } else {
        showToast(`Cash-out request ${newStatus} successfully!`, "success");
      }

      await updateDoc(withdrawalRef, updateData);
    } catch (error) {
      console.error("Error updating withdrawal status:", error);
      showToast("Failed to update withdrawal status. Please try again.", "error");
    } finally {
      setProcessingId(null);
    }
  };

  // Handle approve action - now automatically processes payout
  const handleApprove = async (withdrawal) => {
    try {
      // Calculate fees first to show in confirmation
      const feeBreakdown = await calculateFees(withdrawal);
      
      setFeePreviewModal({
        show: true,
        withdrawal,
        feeBreakdown,
        onConfirm: async () => {
          setFeePreviewModal({ show: false });
          // Show notes modal for approval notes (optional)
          setNotesModal({
            show: true,
            title: "Approve & Process Cash-out",
            placeholder: "Enter approval notes (optional)...",
            onConfirm: async (notes) => {
              setNotesModal({ show: false });
              // Process payout immediately - status will be set to "completed" automatically
              await handleUpdateStatus(withdrawal.id, "pending", notes || null, true); // true = process payout, status becomes "completed"
            },
            onCancel: () => setNotesModal({ show: false })
          });
        },
        onCancel: () => setFeePreviewModal({ show: false })
      });
    } catch (error) {
      console.error("Error calculating fees:", error);
      showToast("Error calculating fees. Please try again.", "error");
    }
  };

  // Handle reject action
  const handleReject = (withdrawal) => {
    setNotesModal({
      show: true,
      title: "Reject Cash-out Request",
      placeholder: "Enter rejection reason (optional)...",
      onConfirm: async (notes) => {
        setNotesModal({ show: false });
        await handleUpdateStatus(withdrawal.id, "rejected", notes || null);
      },
      onCancel: () => setNotesModal({ show: false })
    });
  };

  // Handle refresh payout status
  const handleRefreshPayoutStatus = async (withdrawal) => {
    if (!withdrawal.payoutBatchId) {
      showToast("No payout batch ID found for this withdrawal.", "error");
      return;
    }

    setProcessingId(withdrawal.id);
    try {
      const statusResult = await checkPayPalPayoutStatus(withdrawal.payoutBatchId, auth);
      
      // Update the withdrawal with the latest status
      const withdrawalRef = doc(db, "withdrawalRequests", withdrawal.id);
      const newStatus = statusResult.batchStatus || statusResult.payoutStatus || withdrawal.payoutStatus;
      
      await updateDoc(withdrawalRef, {
        payoutStatus: newStatus,
        payoutLastChecked: serverTimestamp()
      });

      // Map PayPal statuses to our statuses
      let statusMessage = "Status updated";
      if (newStatus === "SUCCESS" || newStatus === "COMPLETED") {
        statusMessage = "Payout completed successfully!";
      } else if (newStatus === "FAILED") {
        statusMessage = "Payout failed. Please check PayPal for details.";
      } else if (newStatus === "PENDING") {
        statusMessage = "Payout is still processing...";
      }

      showToast(statusMessage, newStatus === "SUCCESS" || newStatus === "COMPLETED" ? "success" : "info");
    } catch (error) {
      console.error("Error refreshing payout status:", error);
      showToast(`Failed to refresh status: ${error.message}`, "error");
    } finally {
      setProcessingId(null);
    }
  };


  // Generate Cash-out Approvals Report
  const generateCashoutReport = () => {
    try {
      const filteredData = getFilteredAndSortedWithdrawals();
      
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let yPosition = 0;
      const margin = 20;
      const lineHeight = 8;
      const sectionSpacing = 15;
      
      // Professional white and blue color scheme (same as financial report)
      const navyBlue = [0, 51, 102];
      const royalBlue = [25, 118, 210];
      const lightBlue = [227, 242, 253];
      const textDark = [33, 33, 33];
      const textMedium = [97, 97, 97];
      const textLight = [158, 158, 158];
      const white = [255, 255, 255];
      const borderGray = [224, 224, 224];
      const green = [52, 199, 89];
      const red = [255, 59, 48];
      const yellow = [255, 149, 0];

      // Helper function to add header (same style as financial report)
      const addHeader = () => {
        pdf.setFillColor(...white);
        pdf.rect(0, 0, pageWidth, 60, "F");
        
        pdf.setFillColor(...navyBlue);
        pdf.rect(0, 0, pageWidth, 8, "F");
        
        pdf.setTextColor(...navyBlue);
        pdf.setFontSize(28);
        pdf.setFont("helvetica", "bold");
        pdf.text("Voyago", margin, 25);
        
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...textMedium);
        pdf.text("Administrative Report", margin, 35);
        
        pdf.setDrawColor(...royalBlue);
        pdf.setLineWidth(1.5);
        pdf.line(margin, 40, margin + 80, 40);
        
        pdf.setFontSize(9);
        pdf.setTextColor(...textLight);
        pdf.text("Cash-out Approvals Report", pageWidth - margin, 25, { align: "right" });
        pdf.text(`Generated: ${new Date().toLocaleString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        })}`, pageWidth - margin, 35, { align: "right" });
        
        pdf.setDrawColor(...borderGray);
        pdf.setLineWidth(0.5);
        pdf.line(margin, 65, pageWidth - margin, 65);
        
        pdf.setTextColor(...textDark);
        yPosition = 80;
      };

      const checkPageBreak = (requiredSpace = 20) => {
        if (yPosition + requiredSpace > pageHeight - margin) {
          pdf.addPage();
          addHeader();
          return true;
        }
        return false;
      };

      addHeader();

      // Report Title
      pdf.setFontSize(20);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...navyBlue);
      pdf.text("Cash-out Approvals Report", margin, yPosition);
      yPosition += sectionSpacing;

      // Filter Info
      checkPageBreak(15);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...textMedium);
      const filterText = selectedFilter === "all" ? "All Statuses" : selectedFilter.charAt(0).toUpperCase() + selectedFilter.slice(1);
      pdf.text(`Filter: ${filterText} | Total Records: ${filteredData.length}`, margin, yPosition);
      yPosition += lineHeight + 5;

      // Summary Statistics (same style as financial report)
      checkPageBreak(100);
      const summaryStartY = yPosition;
      
      // Calculate summary box height
      let summaryBoxHeight = 15; // Title spacing
      summaryBoxHeight += (lineHeight + 2) * 4; // 4 status lines
      summaryBoxHeight += 5; // Divider spacing
      summaryBoxHeight += (lineHeight + 2) * 3; // 3 total lines
      summaryBoxHeight += 10; // Bottom padding
      
      pdf.setFillColor(...lightBlue);
      pdf.roundedRect(margin, yPosition, pageWidth - (margin * 2), summaryBoxHeight, 3, 3, "F");
      
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...navyBlue);
      pdf.text("Summary Statistics", margin + 12, yPosition + 10);
      
      yPosition += 15;
      
      const totalAmount = filteredData.reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0);
      const totalPayout = filteredData.reduce((sum, w) => sum + (parseFloat(w.payoutAmount) || 0), 0);
      const totalFees = filteredData.reduce((sum, w) => sum + (parseFloat(w.totalFees) || 0), 0);
      
      const pendingCount = filteredData.filter(w => w.status === "pending").length;
      const completedCount = filteredData.filter(w => w.status === "completed").length;
      const rejectedCount = filteredData.filter(w => w.status === "rejected").length;

      // Calculate amounts by status
      const pendingAmount = filteredData.filter(w => w.status === "pending").reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0);
      const completedAmount = filteredData.filter(w => w.status === "completed").reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0);
      const rejectedAmount = filteredData.filter(w => w.status === "rejected").reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0);

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...textDark);
      
      const valueX = pageWidth - margin - 12;
      
      pdf.text(`Total Requests: ${filteredData.length}`, margin + 12, yPosition);
      pdf.text(`$${totalAmount.toFixed(2)}`, valueX, yPosition, { align: "right" });
      yPosition += lineHeight + 2;
      
      pdf.text(`Pending: ${pendingCount}`, margin + 12, yPosition);
      pdf.text(`$${pendingAmount.toFixed(2)}`, valueX, yPosition, { align: "right" });
      yPosition += lineHeight + 2;
      
      pdf.text(`Completed: ${completedCount}`, margin + 12, yPosition);
      pdf.text(`$${completedAmount.toFixed(2)}`, valueX, yPosition, { align: "right" });
      yPosition += lineHeight + 2;
      
      pdf.text(`Rejected: ${rejectedCount}`, margin + 12, yPosition);
      pdf.text(`$${rejectedAmount.toFixed(2)}`, valueX, yPosition, { align: "right" });
      yPosition += lineHeight + 3;
      
      // Add total financial summary below with divider
      pdf.setDrawColor(...royalBlue);
      pdf.setLineWidth(0.5);
      pdf.line(margin + 12, yPosition - 2, pageWidth - margin - 12, yPosition - 2);
      yPosition += 5;
      
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...navyBlue);
      pdf.text("Total Amount:", margin + 12, yPosition);
      pdf.setTextColor(...royalBlue);
      pdf.text(`$${totalAmount.toFixed(2)}`, valueX, yPosition, { align: "right" });
      yPosition += lineHeight + 2;
      
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...navyBlue);
      pdf.text("Total Payout:", margin + 12, yPosition);
      pdf.setTextColor(...royalBlue);
      pdf.text(`$${totalPayout.toFixed(2)}`, valueX, yPosition, { align: "right" });
      yPosition += lineHeight + 2;
      
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...navyBlue);
      pdf.text("Total Fees:", margin + 12, yPosition);
      pdf.setTextColor(...royalBlue);
      pdf.text(`$${totalFees.toFixed(2)}`, valueX, yPosition, { align: "right" });
      yPosition += lineHeight + 5;

      // Withdrawals Table
      checkPageBreak(30);
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...navyBlue);
      pdf.text("Withdrawal Requests", margin, yPosition);
      yPosition += lineHeight + 5;

      if (filteredData.length === 0) {
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...textMedium);
        pdf.text("No withdrawal requests found for the selected filter.", margin, yPosition);
      } else {
        // Table Header
        checkPageBreak(30);
        pdf.setFillColor(...navyBlue);
        pdf.rect(margin, yPosition, pageWidth - (margin * 2), 12, "F");
        
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...white);
        pdf.text("Host", margin + 5, yPosition + 8);
        pdf.text("Amount", margin + 60, yPosition + 8);
        pdf.text("Payout", margin + 90, yPosition + 8);
        pdf.text("Status", margin + 120, yPosition + 8);
        pdf.text("Date", margin + 150, yPosition + 8);
        
        yPosition += 15;

        // Table Rows
        filteredData.forEach((withdrawal, index) => {
          checkPageBreak(20);
          
          if (index % 2 === 0) {
            pdf.setFillColor(...lightBlue);
            pdf.rect(margin, yPosition - 5, pageWidth - (margin * 2), 10, "F");
          }

          pdf.setFontSize(8);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(...textDark);
          
          const hostName = (withdrawal.hostName || "N/A").substring(0, 20);
          const amount = `$${(parseFloat(withdrawal.amount) || 0).toFixed(2)}`;
          const payout = withdrawal.payoutAmount ? `$${(parseFloat(withdrawal.payoutAmount) || 0).toFixed(2)}` : "N/A";
          const status = withdrawal.status || "N/A";
          const date = withdrawal.requestedAt?.toDate 
            ? withdrawal.requestedAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : withdrawal.requestedAt 
            ? new Date(withdrawal.requestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : "N/A";

          // Status color
          if (status === "completed") {
            pdf.setTextColor(...green);
          } else if (status === "rejected") {
            pdf.setTextColor(...red);
          } else if (status === "pending") {
            pdf.setTextColor(...yellow);
          } else {
            pdf.setTextColor(...textDark);
          }

          pdf.text(hostName, margin + 5, yPosition);
          pdf.setTextColor(...textDark);
          pdf.text(amount, margin + 60, yPosition);
          pdf.text(payout, margin + 90, yPosition);
          
          // Status with color
          if (status === "completed") {
            pdf.setTextColor(...green);
          } else if (status === "rejected") {
            pdf.setTextColor(...red);
          } else if (status === "pending") {
            pdf.setTextColor(...yellow);
          }
          pdf.text(status.charAt(0).toUpperCase() + status.slice(1), margin + 120, yPosition);
          pdf.setTextColor(...textDark);
          pdf.text(date, margin + 150, yPosition);
          
          yPosition += 10;
        });
      }

      // Save PDF
      pdf.save(`Cash-out-Approvals-Report-${new Date().toISOString().split('T')[0]}.pdf`);
      
      showToast("Cash-out Approvals report generated successfully!", "success");
    } catch (error) {
      console.error("Error generating cash-out report:", error);
      showToast("Failed to generate report. Please try again.", "error");
    }
  };

  // Filter and sort withdrawals
  const getFilteredAndSortedWithdrawals = () => {
    let filtered = withdrawals.filter(w => {
      // Status filter
      if (selectedFilter !== "all" && w.status !== selectedFilter) return false;
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const hostName = (w.hostName || "").toLowerCase();
        const hostEmail = (w.hostEmail || "").toLowerCase();
        const paypalEmail = (w.paypalEmail || "").toLowerCase();
        
        if (!hostName.includes(query) && !hostEmail.includes(query) && !paypalEmail.includes(query)) {
          return false;
        }
      }
      
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      if (sortBy === "date") {
        aValue = a.requestedAt?.toDate ? a.requestedAt.toDate().getTime() : (a.requestedAt ? new Date(a.requestedAt).getTime() : 0);
        bValue = b.requestedAt?.toDate ? b.requestedAt.toDate().getTime() : (b.requestedAt ? new Date(b.requestedAt).getTime() : 0);
      } else if (sortBy === "amount") {
        aValue = parseFloat(a.amount) || 0;
        bValue = parseFloat(b.amount) || 0;
      } else {
        return 0;
      }
      
      if (sortOrder === "asc") {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });

    return filtered;
  };

  const filteredWithdrawals = getFilteredAndSortedWithdrawals();

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 animate-fadeInUp">
        <div className="text-center py-12">
          <div className="text-[#8E8E93] font-light">Loading cash-out requests...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeInUp">
      {/* Header with Search and Filters */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-light text-[#1C1C1E]">Cash-out Approvals</h2>
          <button
            onClick={generateCashoutReport}
            disabled={loading}
            className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl px-6 py-3 flex items-center gap-3 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="font-light">Generate Report</span>
          </button>
        </div>
        
        {/* Search Bar */}
        <div className="mb-4">
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
              placeholder="Search by host name or email..."
              className="w-full pl-11 pr-4 py-2.5 bg-[#F2F2F7] rounded-xl text-sm text-[#1C1C1E] placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Filter Tabs and Sort */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {["all", "pending", "completed", "rejected"].map((filter) => (
              <button
                key={filter}
                onClick={() => setSelectedFilter(filter)}
                className={`px-4 py-2 rounded-xl text-sm font-light transition-all ${
                  selectedFilter === filter
                    ? "bg-[#0071E3] text-white"
                    : "bg-gray-100 text-[#8E8E93] hover:bg-gray-200"
                }`}
              >
                {filter === "all" ? "All" : filter.charAt(0).toUpperCase() + filter.slice(1)} ({filter === "all" ? withdrawals.length : withdrawals.filter(w => w.status === filter).length})
              </button>
            ))}
          </div>
          
          {/* Sort Controls */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#8E8E93]">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 bg-[#F2F2F7] rounded-xl text-sm text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20"
            >
              <option value="date">Date</option>
              <option value="amount">Amount</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              className="p-2 bg-[#F2F2F7] rounded-xl hover:bg-gray-200 transition-all"
              title={`Sort ${sortOrder === "asc" ? "Descending" : "Ascending"}`}
            >
              <svg className="w-4 h-4 text-[#1C1C1E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {sortOrder === "asc" ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Withdrawals List */}
      {filteredWithdrawals.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
          <p className="text-[#8E8E93] font-light">
            {searchQuery 
              ? `No ${selectedFilter} cash-out requests match your search`
              : `No ${selectedFilter} cash-out requests`
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredWithdrawals.map((withdrawal) => {
            const isProcessing = processingId === withdrawal.id;
            
            return (
              <div
                key={withdrawal.id}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-medium text-[#1C1C1E]">{withdrawal.hostName || withdrawal.hostEmail}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-light capitalize ${getStatusBadge(withdrawal.status)}`}>
                        {withdrawal.status}
                      </span>
                      {isProcessing && (
                        <span className="px-3 py-1 rounded-full text-xs font-light bg-blue-100 text-blue-700 flex items-center gap-1">
                          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#8E8E93] font-light mb-1">Email: {withdrawal.hostEmail}</p>
                    <p className="text-sm text-[#8E8E93] font-light mb-1">PayPal: {withdrawal.paypalEmail}</p>
                    <p className="text-2xl font-light text-[#1C1C1E] mt-3">{formatCurrency(withdrawal.amount)}</p>
                    {withdrawal.requestedAt && (
                      <p className="text-xs text-[#8E8E93] font-light mt-2">
                        Requested: {withdrawal.requestedAt.toDate ? withdrawal.requestedAt.toDate().toLocaleString() : new Date(withdrawal.requestedAt).toLocaleString()}
                      </p>
                    )}
                    {withdrawal.payoutAmount && (
                      <p className="text-sm text-green-600 font-medium mt-2">
                        Payout: {formatCurrency(withdrawal.payoutAmount)}
                        {withdrawal.totalFees > 0 && (
                          <span className="text-xs text-[#8E8E93] ml-2">
                            (Fees: {formatCurrency(withdrawal.totalFees)})
                          </span>
                        )}
                      </p>
                    )}
                    {withdrawal.adminNotes && (
                      <p className="text-sm text-[#8E8E93] font-light mt-2 italic">
                        Notes: {withdrawal.adminNotes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                {withdrawal.status === "pending" && (
                  <div className="flex gap-3 mt-4 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => handleApprove(withdrawal)}
                      disabled={isProcessing}
                      className="flex-1 bg-[#0071E3] text-white rounded-xl px-4 py-2 font-light hover:bg-[#0051D0] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isProcessing ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </>
                      ) : (
                        "Approve & Send Payment"
                      )}
                    </button>
                    <button
                      onClick={() => handleReject(withdrawal)}
                      disabled={isProcessing}
                      className="flex-1 bg-red-500 text-white rounded-xl px-4 py-2 font-light hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {confirmModal.show && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          type={confirmModal.type}
          confirmText={confirmModal.confirmText}
          onConfirm={confirmModal.onConfirm}
          onCancel={confirmModal.onCancel}
        />
      )}

      {notesModal.show && (
        <NotesModal
          title={notesModal.title}
          placeholder={notesModal.placeholder}
          onConfirm={notesModal.onConfirm}
          onCancel={notesModal.onCancel}
        />
      )}

      {feePreviewModal.show && (
        <FeePreviewModal
          withdrawal={feePreviewModal.withdrawal}
          feeBreakdown={feePreviewModal.feeBreakdown}
          onConfirm={feePreviewModal.onConfirm}
          onCancel={feePreviewModal.onCancel}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

// Service Fees Content Component
const ServiceFeesContent = () => {
  const { currentUser } = useAuth();
  const [serviceFees, setServiceFees] = useState({
    commissionPercentage: 0, // Platform commission percentage
    withdrawalFee: 0, // Fixed fee per withdrawal
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchServiceFees();
  }, []);

  const fetchServiceFees = async () => {
    try {
      setLoading(true);
      const settingsQuery = query(
        collection(db, "adminSettings"),
        where("type", "==", "serviceFees")
      );
      const snapshot = await getDocs(settingsQuery);
      
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setServiceFees({
          commissionPercentage: data.commissionPercentage || 0,
          withdrawalFee: data.withdrawalFee || 0,
        });
      }
    } catch (error) {
      console.error("Error fetching service fees:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateFee = async (feeType, newValue) => {
    try {
      setSaving(true);
      
      // Update in Firestore
      const settingsQuery = query(
        collection(db, "adminSettings"),
        where("type", "==", "serviceFees")
      );
      const snapshot = await getDocs(settingsQuery);
      
      const feeData = {
        ...serviceFees,
        [feeType]: parseFloat(newValue) || 0,
        updatedAt: serverTimestamp()
      };
      
      if (!snapshot.empty) {
        await updateDoc(doc(db, "adminSettings", snapshot.docs[0].id), feeData);
      } else {
        await addDoc(collection(db, "adminSettings"), {
          type: "serviceFees",
          ...feeData,
          createdAt: serverTimestamp()
        });
      }
      
      setServiceFees(feeData);
      alert(`${feeType === 'commissionPercentage' ? 'Commission' : 'Withdrawal fee'} updated successfully!`);
    } catch (error) {
      console.error("Error updating service fee:", error);
      alert("Failed to update. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 flex items-center justify-center">
        <div className="text-[#8E8E93] font-light">Loading service fees...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeInUp">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-2xl font-light text-[#1C1C1E] mb-2">Commission & Fees</h2>
        <p className="text-sm text-[#8E8E93] font-light mb-6">
          Configure commission and withdrawal fees for host payouts. These fees are deducted when processing withdrawals.
        </p>
        
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm text-blue-800 font-medium mb-1">How It Works</p>
              <p className="text-xs text-blue-700 font-light leading-relaxed">
                Since you're using an escrow system where all payments go to your PayPal account, these fees are optional. 
                You can set a commission percentage and/or withdrawal fee that will be deducted from host payouts when you process withdrawals manually.
                If set to 0, hosts receive the full amount.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gray-50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-[#1C1C1E] mb-1">Platform Commission</h3>
                <p className="text-sm text-[#8E8E93] font-light">
                  Percentage deducted from host payouts (optional)
                </p>
                <p className="text-xs text-[#8E8E93] font-light mt-1">
                  Example: 5% commission on $100 withdrawal = $5 deducted, host receives $95
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={serviceFees.commissionPercentage}
                  onChange={(e) => setServiceFees(prev => ({ ...prev, commissionPercentage: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/10 bg-white text-[#1C1C1E] font-light"
                />
              </div>
              <span className="text-lg text-[#8E8E93] font-light">%</span>
              <button
                onClick={() => handleUpdateFee("commissionPercentage", serviceFees.commissionPercentage)}
                disabled={saving}
                className="px-6 py-3 bg-[#0071E3] text-white rounded-xl font-medium hover:bg-[#0051D0] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : "Update"}
              </button>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-[#1C1C1E] mb-1">Withdrawal Processing Fee</h3>
                <p className="text-sm text-[#8E8E93] font-light">
                  Fixed amount deducted per withdrawal (optional)
                </p>
                <p className="text-xs text-[#8E8E93] font-light mt-1">
                  Example: $2.50 fee per withdrawal regardless of amount
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <span className="text-lg text-[#8E8E93] font-light mr-2">$</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={serviceFees.withdrawalFee}
                  onChange={(e) => setServiceFees(prev => ({ ...prev, withdrawalFee: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/10 bg-white text-[#1C1C1E] font-light inline-block"
                />
              </div>
              <button
                onClick={() => handleUpdateFee("withdrawalFee", serviceFees.withdrawalFee)}
                disabled={saving}
                className="px-6 py-3 bg-[#0071E3] text-white rounded-xl font-medium hover:bg-[#0051D0] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : "Update"}
              </button>
            </div>
          </div>

          {/* Info Section */}
          <div className="bg-gradient-to-r from-[#0071E3]/5 to-[#0051D0]/5 rounded-xl p-6 border border-[#0071E3]/10">
            <h4 className="text-base font-medium text-[#1C1C1E] mb-3">💡 How Fees Are Applied</h4>
            <div className="space-y-2 text-sm text-[#8E8E93] font-light">
              <p>• <strong className="text-[#1C1C1E]">Commission:</strong> Calculated as a percentage of the withdrawal amount</p>
              <p>• <strong className="text-[#1C1C1E]">Withdrawal Fee:</strong> Fixed amount deducted from each withdrawal</p>
              <p>• <strong className="text-[#1C1C1E]">Both fees are optional</strong> - set to 0 if you don't want to charge fees</p>
              <p>• Fees are deducted when you process withdrawals in the "Cash-out Approvals" section</p>
              <p>• The final payout amount = Requested Amount - Commission - Withdrawal Fee</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Admin Profile Modal Component
const AdminProfileModal = ({ isOpen, onClose, adminUserData, currentUser }) => {
  if (!isOpen) return null;

  const userName = adminUserData?.displayName || currentUser?.displayName || currentUser?.email?.split("@")[0] || "Admin";
  const userEmail = adminUserData?.email || currentUser?.email || "admin@voyago.com";
  const userPhoto = adminUserData?.photoURL || currentUser?.photoURL;
  const userId = adminUserData?.id || currentUser?.uid || "N/A";
  const joinedDate = adminUserData?.createdAt || adminUserData?.joinedAt || null;
  const phoneNumber = adminUserData?.phoneNumber || adminUserData?.phone || "Not provided";
  const bio = adminUserData?.bio || "Not provided";

  const formatDate = (dateValue) => {
    if (!dateValue) return "N/A";
    try {
      if (dateValue.toDate) {
        return dateValue.toDate().toLocaleDateString('en-US', { 
          month: '2-digit', 
          day: '2-digit', 
          year: 'numeric' 
        });
      }
      const date = new Date(dateValue);
      return date.toLocaleDateString('en-US', { 
        month: '2-digit', 
        day: '2-digit', 
        year: 'numeric' 
      });
    } catch {
      return "N/A";
    }
  };

  const getInitials = (name, email) => {
    if (name && name !== email) {
      const parts = name.split(" ");
      if (parts.length > 1) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return name[0].toUpperCase();
    }
    return email ? email[0].toUpperCase() : "A";
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Blurred Background */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-md transition-opacity"
        onClick={onClose}
        style={{ animation: 'fadeIn 0.2s ease-out' }}
      ></div>

      {/* Profile Card */}
      <div 
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col transform transition-all"
        style={{ animation: 'fadeInUp 0.3s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0071E3] to-[#0051D0] p-6 sm:p-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white/20 backdrop-blur-sm border-4 border-white/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {userPhoto ? (
                  <img
                    src={userPhoto}
                    alt={userName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl sm:text-4xl font-light text-white">
                    {getInitials(userName, userEmail)}
                  </span>
                )}
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-light text-white mb-1">
                  {userName}
                </h2>
                <p className="text-white/80 font-light text-sm sm:text-base">{userEmail}</p>
                {joinedDate && (
                  <p className="text-white/60 font-light text-xs sm:text-sm mt-1">
                    Joined {formatDate(joinedDate)}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          <div className="space-y-6">
            {/* User ID Section */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                </svg>
                <p className="text-sm font-medium text-[#1C1C1E]">User ID</p>
              </div>
              <p className="text-sm text-[#8E8E93] font-mono font-light break-all">{userId}</p>
            </div>

            {/* Personal Information */}
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-[#0071E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <h3 className="text-lg font-medium text-[#1C1C1E]">Personal Information</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-[#8E8E93] font-light mb-1">Bio</p>
                  <p className="text-sm text-[#1C1C1E] font-light">{bio}</p>
                </div>
                <div>
                  <p className="text-xs text-[#8E8E93] font-light mb-1">Phone Number</p>
                  <p className="text-sm text-[#1C1C1E] font-light">{phoneNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-[#8E8E93] font-light mb-1">Email</p>
                  <p className="text-sm text-[#1C1C1E] font-light">{userEmail}</p>
                  {adminUserData?.emailVerified !== false && (
                    <span className="inline-flex items-center gap-1 text-xs text-[#34C759] font-light mt-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Verified
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Account Details */}
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-[#0071E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <h3 className="text-lg font-medium text-[#1C1C1E]">Account Details</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-[#8E8E93] font-light mb-1">Role</p>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-[#0071E3]/10 text-[#0071E3] rounded-full text-xs font-medium">
                      Administrator
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-[#8E8E93] font-light mb-1">Account Created</p>
                  <p className="text-sm text-[#1C1C1E] font-light">{formatDate(joinedDate)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 sm:p-6 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-[#0071E3] text-white rounded-xl font-medium hover:bg-[#0051D0] transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Subscriptions Content Component
const SubscriptionsContent = () => {
  const [hosts, setHosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, active, inactive
  const [planFilter, setPlanFilter] = useState("all"); // all, starter, pro, elite
  const [searchTerm, setSearchTerm] = useState("");
  const [generatingReport, setGeneratingReport] = useState(false);

  useEffect(() => {
    fetchSubscribedHosts();
    
    const unsubscribe = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        const data = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(user => {
            const roles = user.roles || (user.role ? [user.role] : []);
            return roles.includes("host") || user.role === "host";
          });
        processHostsData(data);
      },
      (error) => {
        console.error("Error fetching hosts:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const fetchSubscribedHosts = async () => {
    try {
      setLoading(true);
      const usersQuery = query(collection(db, "users"));
      const snapshot = await getDocs(usersQuery);
      const data = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(user => {
          const roles = user.roles || (user.role ? [user.role] : []);
          return roles.includes("host") || user.role === "host";
        });
      processHostsData(data);
    } catch (error) {
      console.error("Error fetching subscribed hosts:", error);
    } finally {
      setLoading(false);
    }
  };

  const processHostsData = async (hostsData) => {
    // Fetch active listings count for each host
    const hostsWithListings = await Promise.all(
      hostsData.map(async (host) => {
        try {
          const listingsQuery = query(
            collection(db, "listings"),
            where("hostId", "==", host.id),
            where("status", "==", "active")
          );
          const listingsSnapshot = await getDocs(listingsQuery);
          const activeListingsCount = listingsSnapshot.size;

          // Get plan limits
          const planLimits = {
            starter: 3,
            pro: 10,
            elite: 1000
          };

          const subscriptionPlan = host.subscriptionPlan || "starter";
          const subscriptionStatus = host.subscriptionStatus || "inactive";
          const listingLimit = planLimits[subscriptionPlan] || 3;

          return {
            ...host,
            activeListingsCount,
            listingLimit,
            subscriptionPlan,
            subscriptionStatus
          };
        } catch (error) {
          console.error(`Error fetching listings for host ${host.id}:`, error);
          return {
            ...host,
            activeListingsCount: 0,
            listingLimit: 3,
            subscriptionPlan: host.subscriptionPlan || "starter",
            subscriptionStatus: host.subscriptionStatus || "inactive"
          };
        }
      })
    );

    setHosts(hostsWithListings);
  };

  const getPlanDetails = (plan) => {
    const plans = {
      starter: { name: "Starter", price: "$29", limit: 3, color: "bg-gray-100 text-gray-800" },
      pro: { name: "Pro", price: "$79", limit: 10, color: "bg-blue-100 text-blue-800" },
      elite: { name: "Elite", price: "$199", limit: "Unlimited", color: "bg-purple-100 text-purple-800" }
    };
    return plans[plan] || plans.starter;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = dateString.toDate ? dateString.toDate() : new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (error) {
      return "N/A";
    }
  };

  const filteredHosts = hosts.filter(host => {
    // Filter by subscription status
    if (filter === "active" && host.subscriptionStatus !== "active") return false;
    if (filter === "inactive" && host.subscriptionStatus === "active") return false;

    // Filter by plan
    if (planFilter !== "all" && host.subscriptionPlan !== planFilter) return false;

    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const name = (host.displayName || host.name || host.email || "").toLowerCase();
      const email = (host.email || "").toLowerCase();
      const plan = (host.subscriptionPlan || "").toLowerCase();
      
      if (!name.includes(searchLower) && !email.includes(searchLower) && !plan.includes(searchLower)) {
        return false;
      }
    }

    return true;
  });

  const activeSubscriptions = hosts.filter(h => h.subscriptionStatus === "active").length;
  const inactiveSubscriptions = hosts.filter(h => h.subscriptionStatus !== "active").length;

  // Helper function to safely convert Firestore timestamps to Date objects
  const safeDateConvert = (timestamp) => {
    if (!timestamp) return null;
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    if (timestamp instanceof Date) {
      return timestamp;
    }
    if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? null : date;
    }
    return null;
  };

  // Generate subscription report data
  const generateSubscriptionReport = () => {
    try {
      // Calculate plan statistics
      const planStats = {
        starter: { count: 0, active: 0, inactive: 0 },
        pro: { count: 0, active: 0, inactive: 0 },
        elite: { count: 0, active: 0, inactive: 0 }
      };

      filteredHosts.forEach(host => {
        const plan = host.subscriptionPlan || "starter";
        if (planStats[plan]) {
          planStats[plan].count++;
          if (host.subscriptionStatus === "active") {
            planStats[plan].active++;
          } else {
            planStats[plan].inactive++;
          }
        }
      });

      // Calculate revenue from subscriptions
      const planPrices = {
        starter: 29,
        pro: 79,
        elite: 199
      };

      const monthlyRevenue = filteredHosts
        .filter(h => h.subscriptionStatus === "active")
        .reduce((sum, host) => {
          const plan = host.subscriptionPlan || "starter";
          return sum + (planPrices[plan] || 0);
        }, 0);

      return {
        title: "Subscription Report",
        generatedAt: new Date().toLocaleString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        summary: {
          totalHosts: filteredHosts.length,
          activeSubscriptions: activeSubscriptions,
          inactiveSubscriptions: inactiveSubscriptions,
          monthlyRevenue: monthlyRevenue,
          planStats: planStats
        },
        hosts: filteredHosts.map(host => ({
          id: host.id,
          name: host.displayName || host.name || "Unknown",
          email: host.email || "N/A",
          plan: host.subscriptionPlan || "starter",
          status: host.subscriptionStatus || "inactive",
          activeListings: host.activeListingsCount || 0,
          listingLimit: host.listingLimit || 3,
          startDate: safeDateConvert(host.subscriptionStartDate) || safeDateConvert(host.createdAt)
        }))
      };
    } catch (error) {
      console.error("Error generating subscription report:", error);
      return {
        title: "Subscription Report",
        generatedAt: new Date().toLocaleString(),
        summary: {
          totalHosts: 0,
          activeSubscriptions: 0,
          inactiveSubscriptions: 0,
          monthlyRevenue: 0,
          planStats: { starter: { count: 0, active: 0, inactive: 0 }, pro: { count: 0, active: 0, inactive: 0 }, elite: { count: 0, active: 0, inactive: 0 } }
        },
        hosts: []
      };
    }
  };

  // Download subscription report as PDF
  const downloadSubscriptionReport = (report) => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let yPosition = 0;
    const margin = 20;
    const lineHeight = 8;
    const sectionSpacing = 15;
    
    // Professional white and blue color scheme (same as financial report)
    const navyBlue = [0, 51, 102];
    const royalBlue = [25, 118, 210];
    const lightBlue = [227, 242, 253];
    const accentBlue = [13, 71, 161];
    const textDark = [33, 33, 33];
    const textMedium = [97, 97, 97];
    const textLight = [158, 158, 158];
    const white = [255, 255, 255];
    const borderGray = [224, 224, 224];

    // Helper function to add header on each page
    const addHeader = () => {
      pdf.setFillColor(...white);
      pdf.rect(0, 0, pageWidth, 60, "F");
      
      pdf.setFillColor(...navyBlue);
      pdf.rect(0, 0, pageWidth, 8, "F");
      
      pdf.setTextColor(...navyBlue);
      pdf.setFontSize(28);
      pdf.setFont("helvetica", "bold");
      pdf.text("Voyago", margin, 25);
      
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...textMedium);
      pdf.text("Administrative Report", margin, 35);
      
      pdf.setDrawColor(...royalBlue);
      pdf.setLineWidth(1.5);
      pdf.line(margin, 40, margin + 80, 40);
      
      pdf.setFontSize(9);
      pdf.setTextColor(...textLight);
      pdf.text("Subscription Report", pageWidth - margin, 25, { align: "right" });
      pdf.text(`Generated: ${report.generatedAt}`, pageWidth - margin, 35, { align: "right" });
      
      pdf.setDrawColor(...borderGray);
      pdf.setLineWidth(0.5);
      pdf.line(margin, 55, pageWidth - margin, 55);
      
      pdf.setTextColor(...textDark);
      yPosition = 70;
    };

    // Helper function to add a new page if needed
    const checkPageBreak = (requiredSpace = 20) => {
      if (yPosition + requiredSpace > pageHeight - margin) {
        pdf.addPage();
        addHeader();
        return true;
      }
      return false;
    };

    // Add header to first page
    addHeader();

    // Report Title
    pdf.setFontSize(20);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...navyBlue);
    pdf.text(report.title, margin, yPosition);
    yPosition += sectionSpacing;

    // Executive Summary Section (same style as financial report)
    checkPageBreak(100);
    
    const formatCurrency = (amount) => {
      const numAmount = parseFloat(amount) || 0;
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(numAmount);
    };

    // Calculate summary box height based on content
    let summaryBoxHeight = 20; // Base height for title
    summaryBoxHeight += 10; // Title spacing
    summaryBoxHeight += (lineHeight + 2) * 3; // 3 main lines (Total Hosts, Active, Inactive)
    summaryBoxHeight += 5; // Divider spacing
    summaryBoxHeight += (lineHeight + 3); // Monthly Revenue
    summaryBoxHeight += (lineHeight + 1) * 3; // Plan breakdown (3 lines)
    summaryBoxHeight += 25; // Info box
    summaryBoxHeight += 5; // Bottom padding
    
    // Draw summary box once with calculated height
    pdf.setFillColor(...white);
    pdf.setDrawColor(...borderGray);
    pdf.setLineWidth(0.5);
    pdf.roundedRect(margin, yPosition - 8, pageWidth - (margin * 2), summaryBoxHeight, 4, 4, "FD");
    
    // Blue accent bar on left side
    pdf.setFillColor(...royalBlue);
    pdf.rect(margin, yPosition - 8, 4, summaryBoxHeight, "F");
    
    // Section title with blue accent
    pdf.setFontSize(15);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...navyBlue);
    pdf.text("Executive Summary", margin + 12, yPosition + 3);
    
    // Subtle underline
    pdf.setDrawColor(...royalBlue);
    pdf.setLineWidth(0.8);
    pdf.line(margin + 12, yPosition + 5, margin + 100, yPosition + 5);
    
    yPosition += 12;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");

    // Professional key-value pairs with better spacing and right-aligned values
    const valueX = pageWidth - margin - 12; // Right-align values
    
    pdf.setTextColor(...textDark);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Total Hosts:`, margin + 12, yPosition);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...royalBlue);
    pdf.text(report.summary.totalHosts.toString(), valueX, yPosition, { align: "right" });
    yPosition += lineHeight + 2;
    
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...textDark);
    pdf.text(`Active Subscriptions:`, margin + 12, yPosition);
    pdf.setTextColor(...textMedium);
    pdf.text(report.summary.activeSubscriptions.toString(), valueX, yPosition, { align: "right" });
    yPosition += lineHeight + 2;
    
    pdf.setTextColor(...textDark);
    pdf.text(`Inactive Subscriptions:`, margin + 12, yPosition);
    pdf.setTextColor(...textMedium);
    pdf.text(report.summary.inactiveSubscriptions.toString(), valueX, yPosition, { align: "right" });
    yPosition += lineHeight + 2;
    
    // Monthly Revenue highlighted with divider
    pdf.setDrawColor(...royalBlue);
    pdf.setLineWidth(0.5);
    pdf.line(margin + 12, yPosition - 2, pageWidth - margin - 12, yPosition - 2);
    yPosition += 3;
    
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...navyBlue);
    pdf.text(`Monthly Revenue:`, margin + 12, yPosition);
    
    pdf.setTextColor(...royalBlue);
    pdf.setFontSize(12);
    pdf.text(formatCurrency(report.summary.monthlyRevenue), valueX, yPosition, { align: "right" });
    pdf.setFontSize(10);
    yPosition += lineHeight + 3;

    // Plan breakdown
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...textMedium);
    pdf.text(`  • Starter: ${report.summary.planStats.starter.count} (${report.summary.planStats.starter.active} active)`, margin + 12, yPosition);
    yPosition += lineHeight + 1;
    pdf.text(`  • Pro: ${report.summary.planStats.pro.count} (${report.summary.planStats.pro.active} active)`, margin + 12, yPosition);
    yPosition += lineHeight + 1;
    pdf.text(`  • Elite: ${report.summary.planStats.elite.count} (${report.summary.planStats.elite.active} active)`, margin + 12, yPosition);
    yPosition += lineHeight + 1;
    
    // Metrics info box
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...textMedium);
    
    const infoBoxY = yPosition - 2;
    const infoBoxHeight = 20;
    const infoBoxWidth = pageWidth - (margin * 2) - 12;
    const infoBoxCenterX = margin + 12 + (infoBoxWidth / 2);
    pdf.setFillColor(...lightBlue);
    pdf.setDrawColor(...borderGray);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(margin + 12, infoBoxY, infoBoxWidth, infoBoxHeight, 2, 2, "FD");
    
    pdf.text(`Total Subscriptions: ${report.summary.totalHosts}`, infoBoxCenterX, infoBoxY + 5, { align: "center" });
    pdf.text(`Active Rate: ${report.summary.totalHosts > 0 ? ((report.summary.activeSubscriptions / report.summary.totalHosts) * 100).toFixed(1) : 0}%`, infoBoxCenterX, infoBoxY + 10, { align: "center" });
    pdf.text(`Average Monthly Revenue per Active: ${report.summary.activeSubscriptions > 0 ? formatCurrency(report.summary.monthlyRevenue / report.summary.activeSubscriptions) : formatCurrency(0)}`, infoBoxCenterX, infoBoxY + 15, { align: "center" });
    
    yPosition += infoBoxHeight + 3;
    pdf.setFontSize(10);
    yPosition += sectionSpacing + 10;

    // Hosts Table
    if (report.hosts && report.hosts.length > 0) {
      checkPageBreak(50);
      
      // Section title
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...navyBlue);
      pdf.text("Host Subscriptions", margin, yPosition);
      yPosition += 15;

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      
      // Define column positions for better spacing (similar to financial report)
      const colHost = margin + 6;
      const colPlan = margin + 50;
      const colStatus = margin + 75;
      const colListingDate = pageWidth - margin - 50;
      
      // Professional table header with navy blue background
      pdf.setFillColor(...navyBlue);
      pdf.roundedRect(margin, yPosition - 7, pageWidth - (margin * 2), 12, 3, 3, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...white);
      pdf.setFontSize(9);
      pdf.text("Host", colHost, yPosition);
      pdf.text("Plan", colPlan, yPosition);
      pdf.text("Status", colStatus, yPosition);
      pdf.text("Listing Date", colListingDate, yPosition, { align: "right" });
      yPosition += 14;
      pdf.setFont("helvetica", "normal");

      const formatDate = (date) => {
        if (!date) return "N/A";
        try {
          let dateObj;
          if (date instanceof Date) {
            dateObj = date;
          } else if (date.toDate && typeof date.toDate === 'function') {
            dateObj = date.toDate();
          } else {
            dateObj = new Date(date);
          }
          
          if (isNaN(dateObj.getTime())) return "N/A";
          
          return dateObj.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
          });
        } catch (error) {
          return "N/A";
        }
      };

      // Limit to first 100 hosts to avoid PDF being too long
      const hostsToShow = report.hosts.slice(0, 100);
      hostsToShow.forEach((host, index) => {
        checkPageBreak(12);
        
        // White background with subtle border for each row
        pdf.setFillColor(...white);
        pdf.setDrawColor(...borderGray);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(margin, yPosition - 6, pageWidth - (margin * 2), lineHeight + 3, 2, 2, "FD");
        
        // Light blue background for alternate rows
        if (index % 2 === 0) {
          pdf.setFillColor(...lightBlue);
          pdf.roundedRect(margin, yPosition - 6, pageWidth - (margin * 2), lineHeight + 3, 2, 2, "F");
        }
        
        // Host name (truncate to fit available space)
        const name = (host.name || "N/A");
        const maxChars = 20;
        const truncatedName = name.length > maxChars 
          ? name.substring(0, maxChars - 3) + "..." 
          : name;
        pdf.setTextColor(...textDark);
        pdf.setFontSize(8);
        pdf.text(truncatedName, colHost, yPosition);
        
        // Plan with color coding
        const plan = host.plan.charAt(0).toUpperCase() + host.plan.slice(1);
        pdf.setTextColor(...textMedium);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.text(plan, colPlan, yPosition);
        
        // Status with color coding
        const status = host.status.charAt(0).toUpperCase() + host.status.slice(1);
        const statusColor = host.status === "active" ? royalBlue : textMedium;
        pdf.setTextColor(...statusColor);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.text(status, colStatus, yPosition);
        pdf.setFont("helvetica", "normal");
        
        // Listing Date - just the date
        const dateText = formatDate(host.startDate);
        pdf.setTextColor(...textMedium);
        pdf.setFontSize(7);
        pdf.text(dateText, colListingDate, yPosition, { align: "right" });
        
        yPosition += lineHeight + 4;
      });

      if (report.hosts.length > 100) {
        yPosition += 5;
        pdf.setFontSize(8);
        pdf.setTextColor(...textLight);
        pdf.text(`(Showing first 100 of ${report.hosts.length} hosts)`, margin, yPosition);
        pdf.setTextColor(...textDark);
        pdf.setFontSize(9);
      }
    }

    // Professional footer on each page with branding
    const pageCount = pdf.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      
      // Subtle blue accent line at footer
      pdf.setDrawColor(...royalBlue);
      pdf.setLineWidth(0.8);
      pdf.line(margin, pageHeight - 30, pageWidth - margin, pageHeight - 30);
      
      // Footer background with light blue tint
      pdf.setFillColor(...lightBlue);
      pdf.rect(0, pageHeight - 28, pageWidth, 28, "F");
      
      // Footer text with professional styling
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...textMedium);
      pdf.text(
        `Voyago Administrative Report`,
        margin,
        pageHeight - 18,
        { align: "left" }
      );
      
      pdf.setTextColor(...navyBlue);
      pdf.setFont("helvetica", "bold");
      pdf.text(
        `Page ${i} of ${pageCount}`,
        pageWidth - margin,
        pageHeight - 18,
        { align: "right" }
      );
      
      // Generated date in footer
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...textLight);
      pdf.text(
        `Generated: ${report.generatedAt}`,
        pageWidth / 2,
        pageHeight - 18,
        { align: "center" }
      );
      
      // Confidentiality notice
      pdf.setFontSize(7);
      pdf.setTextColor(...textLight);
      pdf.text(
        `Confidential - For Internal Use Only`,
        pageWidth / 2,
        pageHeight - 10,
        { align: "center" }
      );
    }

    // Save the PDF
    const fileName = `Subscription_Report_${new Date().toISOString().split("T")[0]}.pdf`;
    pdf.save(fileName);
  };

  // Handle generate report button click
  const handleGenerateSubscriptionReport = async () => {
    try {
      setGeneratingReport(true);
      const report = generateSubscriptionReport();
      downloadSubscriptionReport(report);
      alert("Subscription report generated and downloaded successfully!");
    } catch (error) {
      console.error("Error generating subscription report:", error);
      alert("Failed to generate subscription report. Please try again.");
    } finally {
      setGeneratingReport(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 animate-fadeInUp">
        <div className="text-center py-12">
          <div className="w-16 h-16 border-4 border-[#0071E3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#8E8E93] font-light">Loading subscriptions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeInUp">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-light text-[#1C1C1E] mb-2">Subscriptions</h2>
          <p className="text-sm text-[#8E8E93] font-light">View all hosts and their subscription plans</p>
        </div>
        <button
          onClick={handleGenerateSubscriptionReport}
          disabled={generatingReport || filteredHosts.length === 0}
          className="px-6 py-3 bg-[#0071E3] text-white rounded-xl font-medium hover:bg-[#0051D0] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-md hover:shadow-lg"
        >
          {generatingReport ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Generating...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Generate Report</span>
            </>
          )}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200 shadow-sm">
          <p className="text-sm text-[#8E8E93] font-light mb-2">Total Hosts</p>
          <p className="text-2xl sm:text-3xl font-light text-[#1C1C1E]">{hosts.length}</p>
        </div>
        <div className="bg-gradient-to-r from-[#34C759] to-[#30D158] rounded-xl p-4 sm:p-6 text-white shadow-lg">
          <p className="text-sm text-white/90 font-light mb-2">Active Subscriptions</p>
          <p className="text-2xl sm:text-3xl font-light text-white">{activeSubscriptions}</p>
        </div>
        <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200 shadow-sm">
          <p className="text-sm text-[#8E8E93] font-light mb-2">Inactive Subscriptions</p>
          <p className="text-2xl sm:text-3xl font-light text-[#1C1C1E]">{inactiveSubscriptions}</p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200 shadow-sm">
        <div className="flex flex-col gap-4">
          {/* Status Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs font-medium text-[#8E8E93] self-center mr-2">Status:</span>
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 rounded-lg text-sm font-light transition-all ${
                filter === "all"
                  ? "bg-[#0071E3] text-white"
                  : "bg-gray-100 text-[#1C1C1E] hover:bg-gray-200"
              }`}
            >
              All ({hosts.length})
            </button>
            <button
              onClick={() => setFilter("active")}
              className={`px-4 py-2 rounded-lg text-sm font-light transition-all ${
                filter === "active"
                  ? "bg-[#34C759] text-white"
                  : "bg-gray-100 text-[#1C1C1E] hover:bg-gray-200"
              }`}
            >
              Active ({activeSubscriptions})
            </button>
            <button
              onClick={() => setFilter("inactive")}
              className={`px-4 py-2 rounded-lg text-sm font-light transition-all ${
                filter === "inactive"
                  ? "bg-red-100 text-red-700"
                  : "bg-gray-100 text-[#1C1C1E] hover:bg-gray-200"
              }`}
            >
              Inactive ({inactiveSubscriptions})
            </button>
          </div>

          {/* Plan Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs font-medium text-[#8E8E93] self-center mr-2">Plan:</span>
            <button
              onClick={() => setPlanFilter("all")}
              className={`px-4 py-2 rounded-lg text-sm font-light transition-all ${
                planFilter === "all"
                  ? "bg-[#0071E3] text-white"
                  : "bg-gray-100 text-[#1C1C1E] hover:bg-gray-200"
              }`}
            >
              All Plans
            </button>
            <button
              onClick={() => setPlanFilter("starter")}
              className={`px-4 py-2 rounded-lg text-sm font-light transition-all ${
                planFilter === "starter"
                  ? "bg-gray-800 text-white"
                  : "bg-gray-100 text-[#1C1C1E] hover:bg-gray-200"
              }`}
            >
              Starter
            </button>
            <button
              onClick={() => setPlanFilter("pro")}
              className={`px-4 py-2 rounded-lg text-sm font-light transition-all ${
                planFilter === "pro"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-[#1C1C1E] hover:bg-gray-200"
              }`}
            >
              Pro
            </button>
            <button
              onClick={() => setPlanFilter("elite")}
              className={`px-4 py-2 rounded-lg text-sm font-light transition-all ${
                planFilter === "elite"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-[#1C1C1E] hover:bg-gray-200"
              }`}
            >
              Elite
            </button>
          </div>

          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name, email, or plan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] text-sm"
            />
          </div>
        </div>
      </div>

      {/* Hosts List */}
      {filteredHosts.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-gray-200 shadow-sm">
          <div className="text-5xl mb-4">👥</div>
          <h3 className="text-xl font-light text-[#1C1C1E] mb-2">No hosts found</h3>
          <p className="text-sm text-[#8E8E93] font-light">
            {searchTerm ? "Try adjusting your search criteria." : "No hosts with subscriptions found."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-[#8E8E93] uppercase tracking-wider">Host</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-[#8E8E93] uppercase tracking-wider">Email</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-[#8E8E93] uppercase tracking-wider">Plan</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-[#8E8E93] uppercase tracking-wider">Status</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-[#8E8E93] uppercase tracking-wider">Listings</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-[#8E8E93] uppercase tracking-wider">Start Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredHosts.map((host, index) => {
                  const planDetails = getPlanDetails(host.subscriptionPlan);
                  const isActive = host.subscriptionStatus === "active";
                  
                  return (
                    <tr key={host.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0071E3] to-[#0051D0] flex items-center justify-center text-white font-medium text-sm overflow-hidden">
                            {host.photoURL || host.profilePhotoUrl ? (
                              <img
                                src={host.photoURL || host.profilePhotoUrl}
                                alt={host.displayName || host.name || "Host"}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span>{(host.displayName || host.name || host.email || "H")[0].toUpperCase()}</span>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[#1C1C1E]">
                              {host.displayName || host.name || "Unknown"}
                            </p>
                            {host.firstName && host.lastName && (
                              <p className="text-xs text-[#8E8E93] font-light">
                                {host.firstName} {host.lastName}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <p className="text-sm text-[#1C1C1E] font-light">{host.email || "N/A"}</p>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${planDetails.color}`}>
                          {planDetails.name}
                        </span>
                        <p className="text-xs text-[#8E8E93] font-light mt-1">{planDetails.price}</p>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          isActive 
                            ? "bg-green-100 text-green-800" 
                            : "bg-red-100 text-red-800"
                        }`}>
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[#1C1C1E]">
                            {host.activeListingsCount}
                          </span>
                          <span className="text-xs text-[#8E8E93] font-light">
                            / {host.listingLimit === 1000 ? "∞" : host.listingLimit}
                          </span>
                        </div>
                        {host.activeListingsCount >= host.listingLimit && host.listingLimit < 1000 && (
                          <p className="text-xs text-red-600 font-light mt-1">Limit reached</p>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <p className="text-sm text-[#1C1C1E] font-light">
                          {formatDate(host.subscriptionStartDate)}
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;


