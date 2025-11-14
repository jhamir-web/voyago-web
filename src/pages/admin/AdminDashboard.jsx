import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { collection, query, getDocs, onSnapshot, where, doc, getDoc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import jsPDF from "jspdf";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

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
    upcomingBookings: 0
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
      else if (path.includes("/admin/pending")) setActiveSection("pending");
      else if (path.includes("/admin/termination")) setActiveSection("termination");
      else if (path.includes("/admin/servicefees")) setActiveSection("servicefees");
      else if (path.includes("/admin/policy")) setActiveSection("policy");
      else if (path.includes("/admin/users")) setActiveSection("users");
      else if (path.includes("/admin/reports")) setActiveSection("reports");
      else setActiveSection("home");

      fetchStats();
      fetchAdminUserData();
    };

    checkAdminAccess();
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
      const grossRevenue = allBookings
        .filter(b => b.status === "confirmed" && b.paymentStatus === "paid")
        .reduce((sum, b) => sum + (b.totalPrice || 0), 0);
      
      // Platform revenue (service fees) - typically a percentage of gross revenue
      // For now, calculate as 7% of gross revenue (you can adjust this)
      const serviceFeePercentage = 0.07;
      const platformRevenue = grossRevenue * serviceFeePercentage;
      
      // Host payouts (completed withdrawals)
      const hostPayouts = allWithdrawals
        .filter(w => w.status === "completed")
        .reduce((sum, w) => sum + (w.amount || 0), 0);
      
      // Calculate listing stats
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
        todayBookings,
        upcomingBookings,
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
              icon="pending"
              label="Pending Payouts"
              active={activeSection === "pending"}
              onClick={() => handleSectionChange("pending")}
            />
            <NavItem
              icon="termination"
              label="Termination Appeals"
              active={activeSection === "termination"}
              onClick={() => handleSectionChange("termination")}
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
          {activeSection === "pending" && <PendingPayoutsContent />}
          {activeSection === "termination" && <TerminationAppealsContent />}
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
    pending: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    termination: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
          count={stats.todayBookings}
          icon="calendar"
          emptyMessage="No bookings for today"
        />
        <BookingCard
          title="Upcoming Bookings"
          count={stats.upcomingBookings}
          icon="clock"
          emptyMessage="No upcoming bookings"
        />
      </div>

      {/* Charts and Additional Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <MonthlyEarningsCard />
        <RecentMessagesCard />
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
const BookingCard = ({ title, count, icon, emptyMessage }) => {
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
          {/* Booking items would go here */}
        </div>
      )}
    </div>
  );
};

// Monthly Earnings Card
const MonthlyEarningsCard = () => {
  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 animate-fadeInUp">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-xl bg-[#FF9500]/10 flex items-center justify-center text-[#FF9500]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h3 className="text-xl font-light text-[#1C1C1E] mb-1">Monthly Earnings</h3>
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
const RecentMessagesCard = () => {
  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 animate-fadeInUp">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-xl bg-[#AF52DE]/10 flex items-center justify-center text-[#AF52DE]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <div>
          <h3 className="text-xl font-light text-[#1C1C1E] mb-1">Recent Messages</h3>
          <p className="text-sm text-[#8E8E93] font-light">Latest conversations</p>
        </div>
      </div>
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <p className="text-sm text-[#8E8E93] font-light">No messages yet</p>
      </div>
    </div>
  );
};

// Guest Reviews Card with Best and Lowest Reviews Analytics
const GuestReviewsCard = ({ stats }) => {
  const [bestReviews, setBestReviews] = useState([]);
  const [lowestReviews, setLowestReviews] = useState([]);
  const [loading, setLoading] = useState(true);

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
      <div className="flex items-center gap-4 mb-8">
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
  const [selectedFilter, setSelectedFilter] = useState("pending"); // pending, approved, completed, rejected

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

      // IMPORTANT: When withdrawal is completed, admin has manually sent PayPal transfer
      // We do NOT add to walletBalance - all balances are virtual/preview only
      // The real money transfer happens via PayPal from admin to host (outside this system)
      if (newStatus === "completed") {
        const hostRef = doc(db, "users", withdrawal.hostId);
        const hostDoc = await getDoc(hostRef);
        
        if (hostDoc.exists()) {
          const hostData = hostDoc.data();
          const transactions = hostData.transactions || [];
          
          const transaction = {
            type: "withdrawal_completed",
            amount: withdrawal.amount,
            withdrawalRequestId: withdrawalId,
            date: new Date().toISOString(),
            status: "completed",
            description: `Withdrawal completed: $${withdrawal.amount.toFixed(2)} sent to ${withdrawal.paypalEmail} via PayPal. Real transfer processed by admin.`
          };

          // Only update transaction history - do NOT update walletBalance
          // walletBalance remains virtual/preview only - real money is in admin's PayPal
          await updateDoc(hostRef, {
            transactions: [transaction, ...transactions].slice(0, 10)
          });
        }
        
        // Update the adminPayments record to link it to this withdrawal
        try {
          const adminPaymentsQuery = query(
            collection(db, "adminPayments"),
            where("hostId", "==", withdrawal.hostId),
            where("withdrawalRequestId", "==", null)
          );
          const adminPaymentsSnapshot = await getDocs(adminPaymentsQuery);
          
          // Link the oldest unpaid admin payment to this withdrawal
          if (!adminPaymentsSnapshot.empty) {
            const paymentDoc = adminPaymentsSnapshot.docs[0];
            await updateDoc(doc(db, "adminPayments", paymentDoc.id), {
              withdrawalRequestId: withdrawalId,
              withdrawalCompletedAt: serverTimestamp()
            });
          }
        } catch (error) {
          console.error("Error updating admin payment record:", error);
        }
      } else if (newStatus === "rejected") {
        // If rejected, return amount to pending balance
        const hostRef = doc(db, "users", withdrawal.hostId);
        const hostDoc = await getDoc(hostRef);
        
        if (hostDoc.exists()) {
          const hostData = hostDoc.data();
          const currentPending = hostData.pendingBalance || 0;
          const transactions = hostData.transactions || [];
          
          const transaction = {
            type: "withdrawal_rejected",
            amount: withdrawal.amount,
            withdrawalRequestId: withdrawalId,
            date: new Date().toISOString(),
            status: "rejected",
            description: `Withdrawal rejected: $${withdrawal.amount.toFixed(2)} returned to pending balance`
          };

          await updateDoc(hostRef, {
            pendingBalance: currentPending + withdrawal.amount,
            transactions: [transaction, ...transactions].slice(0, 10)
          });
        }
      }

      await updateDoc(withdrawalRef, updateData);
      
      if (newStatus === "completed") {
        alert(`Withdrawal marked as completed! Please ensure you have sent $${withdrawal.amount.toFixed(2)} from your PayPal account to ${withdrawal.paypalEmail}.`);
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

      // Filter by date range if provided
      const filterByDate = (item, dateField) => {
        if (!filterStartDate || !filterEndDate) return true;
        const itemDate = item[dateField]?.toDate ? item[dateField].toDate() : new Date(item[dateField]);
        return itemDate >= filterStartDate && itemDate <= filterEndDate;
      };

      return {
        listings: allListings,
        bookings: allBookings.filter(b => filterByDate(b, "createdAt")),
        users: allUsers,
        reviews: allReviews.filter(r => filterByDate(r, "createdAt")),
        withdrawals: allWithdrawals.filter(w => filterByDate(w, "createdAt")),
        adminPayments: allAdminPayments.filter(p => filterByDate(p, "createdAt"))
      };
    } catch (error) {
      console.error("Error fetching report data:", error);
      throw error;
    }
  };

  const generateFinancialReport = (data) => {
    const confirmedBookings = data.bookings.filter(b => b.status === "confirmed" && b.paymentStatus === "paid");
    const totalRevenue = confirmedBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
    const totalWithdrawals = data.withdrawals
      .filter(w => w.status === "completed")
      .reduce((sum, w) => sum + (w.amount || 0), 0);
    const totalAdminPayments = data.adminPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    return {
      title: "Financial Report",
      generatedAt: new Date().toLocaleString(),
      summary: {
        totalRevenue: totalRevenue,
        totalWithdrawals: totalWithdrawals,
        totalAdminPayments: totalAdminPayments,
        netRevenue: totalRevenue - totalWithdrawals
      },
      bookings: confirmedBookings.length,
      withdrawals: data.withdrawals.filter(w => w.status === "completed").length
    };
  };

  const generateUserReport = (data) => {
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
      summary: {
        totalUsers: data.users.length,
        totalHosts: hosts.length,
        totalGuests: guests.length
      },
      users: data.users
    };
  };

  const generateListingPerformanceReport = (data) => {
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
      summary: {
        totalListings: data.listings.length,
        activeListings: data.listings.filter(l => l.status === "active").length
      },
      listings: listingsWithStats.sort((a, b) => b.totalRevenue - a.totalRevenue)
    };
  };

  const downloadReport = (report, reportType) => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let yPosition = 0;
    const margin = 20;
    const lineHeight = 7;
    const sectionSpacing = 12;
    
    // Brand colors
    const primaryBlue = [0, 113, 227]; // #0071E3
    const darkBlue = [0, 81, 208]; // #0051D0
    const darkGray = [28, 28, 30]; // #1C1C1E
    const lightGray = [142, 142, 147]; // #8E8E93
    const bgGray = [245, 245, 247]; // #F5F5F7

    // Helper function to add header on each page
    const addHeader = () => {
      // Header background with brand color
      pdf.setFillColor(...primaryBlue);
      pdf.rect(0, 0, pageWidth, 50, "F");
      
      // Voyago logo/brand text
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.setFont("helvetica", "bold");
      pdf.text("Voyago", margin, 20);
      
      // Subtitle
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(255, 255, 255, 0.8);
      pdf.text("Admin Report", margin, 30);
      
      // Blue accent line
      pdf.setDrawColor(...darkBlue);
      pdf.setLineWidth(2);
      pdf.line(0, 50, pageWidth, 50);
      
      // Reset text color
      pdf.setTextColor(...darkGray);
      yPosition = 65;
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
    pdf.setFontSize(22);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...darkGray);
    pdf.text(report.title, margin, yPosition);
    yPosition += 12;

    // Generated date with icon-like styling
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...lightGray);
    pdf.text(`Generated: ${report.generatedAt}`, margin, yPosition);
    yPosition += sectionSpacing + 5;

    // Summary Section with styled box
    checkPageBreak(50);
    const summaryStartY = yPosition;
    pdf.setFillColor(...bgGray);
    pdf.roundedRect(margin, yPosition - 5, pageWidth - (margin * 2), 45, 3, 3, "F");
    
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...darkGray);
    pdf.text("Summary", margin + 8, yPosition + 5);
    yPosition += 12;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    
    if (reportType === "Financial Report") {
      const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(amount);
      };

      pdf.setTextColor(...darkGray);
      pdf.text(`Total Revenue:`, margin + 10, yPosition);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...primaryBlue);
      pdf.text(formatCurrency(report.summary.totalRevenue), margin + 60, yPosition);
      yPosition += lineHeight;
      
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...darkGray);
      pdf.text(`Total Withdrawals:`, margin + 10, yPosition);
      pdf.text(formatCurrency(report.summary.totalWithdrawals), margin + 60, yPosition);
      yPosition += lineHeight;
      
      pdf.text(`Total Admin Payments:`, margin + 10, yPosition);
      pdf.text(formatCurrency(report.summary.totalAdminPayments), margin + 60, yPosition);
      yPosition += lineHeight;
      
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...darkGray);
      pdf.text(`Net Revenue:`, margin + 10, yPosition);
      pdf.setTextColor(...primaryBlue);
      pdf.text(formatCurrency(report.summary.netRevenue), margin + 60, yPosition);
      yPosition += lineHeight;
      
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...darkGray);
      pdf.text(`Total Bookings: ${report.bookings}`, margin + 10, yPosition);
      yPosition += lineHeight;
      pdf.text(`Completed Withdrawals: ${report.withdrawals}`, margin + 10, yPosition);
    } else if (reportType === "User Report") {
      pdf.setTextColor(...darkGray);
      pdf.text(`Total Users:`, margin + 10, yPosition);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...primaryBlue);
      pdf.text(report.summary.totalUsers.toString(), margin + 60, yPosition);
      yPosition += lineHeight;
      
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...darkGray);
      pdf.text(`Total Hosts:`, margin + 10, yPosition);
      pdf.text(report.summary.totalHosts.toString(), margin + 60, yPosition);
      yPosition += lineHeight;
      
      pdf.text(`Total Guests:`, margin + 10, yPosition);
      pdf.text(report.summary.totalGuests.toString(), margin + 60, yPosition);
    } else if (reportType === "Listing Performance Report") {
      pdf.setTextColor(...darkGray);
      pdf.text(`Total Listings:`, margin + 10, yPosition);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...primaryBlue);
      pdf.text(report.summary.totalListings.toString(), margin + 60, yPosition);
      yPosition += lineHeight;
      
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...darkGray);
      pdf.text(`Active Listings:`, margin + 10, yPosition);
      pdf.text(report.summary.activeListings.toString(), margin + 60, yPosition);
    }

    yPosition += sectionSpacing + 5;

    // Detailed Data Section
    if (reportType === "User Report" && report.users && report.users.length > 0) {
      checkPageBreak(40);
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...darkGray);
      pdf.text("User Details", margin, yPosition);
      yPosition += 10;

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      
      // Table header with brand color
      pdf.setFillColor(...primaryBlue);
      pdf.roundedRect(margin, yPosition - 6, pageWidth - (margin * 2), 10, 2, 2, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text("Email", margin + 5, yPosition);
      pdf.text("Role", margin + 85, yPosition);
      pdf.text("Joined", margin + 135, yPosition);
      yPosition += 12;
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...darkGray);

      // Limit to first 50 users to avoid PDF being too long
      const usersToShow = report.users.slice(0, 50);
      usersToShow.forEach((user, index) => {
        checkPageBreak(10);
        
        // Alternate row background
        if (index % 2 === 0) {
          pdf.setFillColor(...bgGray);
          pdf.rect(margin, yPosition - 5, pageWidth - (margin * 2), lineHeight + 2, "F");
        }
        
        const roles = user.roles || (user.role ? [user.role] : []);
        const roleText = roles.join(", ") || "N/A";
        const joinedDate = user.createdAt?.toDate 
          ? user.createdAt.toDate().toLocaleDateString()
          : user.createdAt 
          ? new Date(user.createdAt).toLocaleDateString()
          : "N/A";

        pdf.setTextColor(...darkGray);
        pdf.text(user.email || "N/A", margin + 5, yPosition);
        pdf.text(roleText, margin + 85, yPosition);
        pdf.setTextColor(...lightGray);
        pdf.text(joinedDate, margin + 135, yPosition);
        yPosition += lineHeight + 2;

        if (index < usersToShow.length - 1) {
          pdf.setDrawColor(220, 220, 220);
          pdf.setLineWidth(0.5);
          pdf.line(margin, yPosition - 1, pageWidth - margin, yPosition - 1);
        }
      });

      if (report.users.length > 50) {
        yPosition += 5;
        pdf.setFontSize(8);
        pdf.setTextColor(...lightGray);
        pdf.text(`(Showing first 50 of ${report.users.length} users)`, margin, yPosition);
        pdf.setTextColor(...darkGray);
      }
    } else if (reportType === "Listing Performance Report" && report.listings && report.listings.length > 0) {
      checkPageBreak(40);
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...darkGray);
      pdf.text("Listing Performance", margin, yPosition);
      yPosition += 10;

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      
      // Table header with brand color
      pdf.setFillColor(...primaryBlue);
      pdf.roundedRect(margin, yPosition - 6, pageWidth - (margin * 2), 10, 2, 2, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text("Title", margin + 5, yPosition);
      pdf.text("Status", margin + 70, yPosition);
      pdf.text("Bookings", margin + 95, yPosition);
      pdf.text("Revenue", margin + 120, yPosition);
      pdf.text("Rating", margin + 155, yPosition);
      yPosition += 12;
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...darkGray);

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
        checkPageBreak(10);
        
        // Alternate row background
        if (index % 2 === 0) {
          pdf.setFillColor(...bgGray);
          pdf.rect(margin, yPosition - 5, pageWidth - (margin * 2), lineHeight + 2, "F");
        }
        
        const title = listing.title.length > 25 ? listing.title.substring(0, 22) + "..." : listing.title;
        pdf.setTextColor(...darkGray);
        pdf.text(title, margin + 5, yPosition);
        pdf.text(listing.status || "N/A", margin + 70, yPosition);
        pdf.text(listing.confirmedBookings?.toString() || "0", margin + 95, yPosition);
        pdf.setTextColor(...primaryBlue);
        pdf.setFont("helvetica", "bold");
        pdf.text(formatCurrency(listing.totalRevenue || 0), margin + 120, yPosition);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...darkGray);
        pdf.text(listing.averageRating ? listing.averageRating.toFixed(1) : "N/A", margin + 155, yPosition);
        yPosition += lineHeight + 2;

        if (index < listingsToShow.length - 1) {
          pdf.setDrawColor(220, 220, 220);
          pdf.setLineWidth(0.5);
          pdf.line(margin, yPosition - 1, pageWidth - margin, yPosition - 1);
        }
      });

      if (report.listings.length > 50) {
        yPosition += 5;
        pdf.setFontSize(8);
        pdf.setTextColor(...lightGray);
        pdf.text(`(Showing first 50 of ${report.listings.length} listings)`, margin, yPosition);
        pdf.setTextColor(...darkGray);
      }
    }

    // Footer on each page with branding
    const pageCount = pdf.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      
      // Footer line
      pdf.setDrawColor(...lightGray);
      pdf.setLineWidth(0.5);
      pdf.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25);
      
      // Footer text
      pdf.setFontSize(8);
      pdf.setTextColor(...lightGray);
      pdf.setFont("helvetica", "normal");
      pdf.text(
        `Voyago Admin Report`,
        margin,
        pageHeight - 15,
        { align: "left" }
      );
      pdf.text(
        `Page ${i} of ${pageCount}`,
        pageWidth - margin,
        pageHeight - 15,
        { align: "right" }
      );
      
      // Generated date in footer
      pdf.text(
        `Generated: ${report.generatedAt}`,
        pageWidth / 2,
        pageHeight - 15,
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

      switch (reportType) {
        case "Financial Report":
          report = generateFinancialReport(data);
          break;
        case "User Report":
          report = generateUserReport(data);
          break;
        case "Listing Performance Report":
          report = generateListingPerformanceReport(data);
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-[#8E8E93] font-light mb-2">Start Date</label>
              <DatePicker
                selected={startDate}
                onChange={(date) => setStartDate(date)}
                selectsStart
                startDate={startDate}
                endDate={endDate}
                maxDate={endDate || new Date()}
                placeholderText="Select start date"
                dateFormat="yyyy-MM-dd"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/10 bg-white text-[#1C1C1E] font-light cursor-pointer"
                calendarClassName="!rounded-xl !border-gray-200 !shadow-lg"
                wrapperClassName="w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-[#8E8E93] font-light mb-2">End Date</label>
              <DatePicker
                selected={endDate}
                onChange={(date) => setEndDate(date)}
                selectsEnd
                startDate={startDate}
                endDate={endDate}
                minDate={startDate}
                maxDate={new Date()}
                placeholderText="Select end date"
                dateFormat="yyyy-MM-dd"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/10 bg-white text-[#1C1C1E] font-light cursor-pointer"
                calendarClassName="!rounded-xl !border-gray-200 !shadow-lg"
                wrapperClassName="w-full"
              />
            </div>
          </div>
          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate(null);
                setEndDate(null);
              }}
              className="text-sm text-[#0071E3] font-light hover:underline flex items-center gap-2"
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
            Leave empty for all-time reports. Select both dates to filter by date range.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
  const { currentUser } = useAuth();
  const [policies, setPolicies] = useState({
    cancellationPeriod: 24,
    maxImages: 10,
    reviewLimit: 30,
    paypalFeePercentage: 3.4,
    paypalFixedFee: 15,
    refundableHours: 24,
    minimumRefundAmount: 50,
    refundProcessingDays: 3,
    refundsEnabled: true,
    emailNotifications: true,
    autoApproveRefunds: true,
    eWalletPayment: true
  });
  const [adminPaypalEmail, setAdminPaypalEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAdminSettings();
  }, [currentUser]);

  const fetchAdminSettings = async () => {
    try {
      setLoading(true);
      
      // Try to get from admin settings collection first
      const settingsQuery = query(collection(db, "adminSettings"), where("type", "==", "paypal"));
      const settingsSnapshot = await getDocs(settingsQuery);
      
      if (!settingsSnapshot.empty) {
        const settingsDoc = settingsSnapshot.docs[0];
        const data = settingsDoc.data();
        setAdminPaypalEmail(data.paypalEmail || "");
      } else {
        // Fallback: check admin user document
        if (currentUser) {
          const adminDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (adminDoc.exists()) {
            const adminData = adminDoc.data();
            setAdminPaypalEmail(adminData.adminPaypalEmail || "");
          }
        }
      }
      
      // Fetch policies from settings
      const policiesQuery = query(collection(db, "adminSettings"), where("type", "==", "policies"));
      const policiesSnapshot = await getDocs(policiesQuery);
      if (!policiesSnapshot.empty) {
        const policiesDoc = policiesSnapshot.docs[0];
        const policiesData = policiesDoc.data();
        setPolicies(prev => ({ ...prev, ...policiesData }));
      }
    } catch (error) {
      console.error("Error fetching admin settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAdminPaypal = async () => {
    if (!adminPaypalEmail || !adminPaypalEmail.includes("@")) {
      alert("Please enter a valid PayPal email address.");
      return;
    }

    try {
      setSaving(true);
      
      // Save to admin settings collection
      const settingsQuery = query(collection(db, "adminSettings"), where("type", "==", "paypal"));
      const settingsSnapshot = await getDocs(settingsQuery);
      
      if (!settingsSnapshot.empty) {
        // Update existing
        const settingsDoc = settingsSnapshot.docs[0];
        await updateDoc(doc(db, "adminSettings", settingsDoc.id), {
          paypalEmail: adminPaypalEmail,
          updatedAt: serverTimestamp()
        });
      } else {
        // Create new
        await addDoc(collection(db, "adminSettings"), {
          type: "paypal",
          paypalEmail: adminPaypalEmail,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      
      // Also save to admin user document for quick access
      if (currentUser) {
        await updateDoc(doc(db, "users", currentUser.uid), {
          adminPaypalEmail: adminPaypalEmail
        });
      }
      
      alert("Admin PayPal email updated successfully!");
    } catch (error) {
      console.error("Error updating admin PayPal:", error);
      alert("Failed to update admin PayPal email. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePolicy = async (key, value) => {
    try {
      setPolicies(prev => ({ ...prev, [key]: value }));
      
      // Save to Firestore
      const policiesQuery = query(collection(db, "adminSettings"), where("type", "==", "policies"));
      const policiesSnapshot = await getDocs(policiesQuery);
      
      if (!policiesSnapshot.empty) {
        const policiesDoc = policiesSnapshot.docs[0];
        await updateDoc(doc(db, "adminSettings", policiesDoc.id), {
          [key]: value,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, "adminSettings"), {
          type: "policies",
          ...policies,
          [key]: value,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      
      alert("Policy updated successfully!");
    } catch (error) {
      console.error("Error updating policy:", error);
      alert("Failed to update policy.");
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

  return (
    <div className="space-y-6 animate-fadeInUp">
      {/* Admin PayPal Account Configuration */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-[#0071E3] flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-medium text-[#1C1C1E] mb-1">Admin PayPal Account</h2>
            <p className="text-sm text-[#8E8E93] font-light">Configure the PayPal account that receives booking payments</p>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-[#0071E3]/5 to-[#0051D0]/5 rounded-xl p-6 border border-[#0071E3]/10">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#1C1C1E] mb-2">
                PayPal Email Address
              </label>
              <div className="flex gap-3">
                <input
                  type="email"
                  value={adminPaypalEmail}
                  onChange={(e) => setAdminPaypalEmail(e.target.value)}
                  placeholder="admin@voyago.com"
                  className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/10 bg-white text-[#1C1C1E] font-light transition-all"
                  disabled={saving}
                />
                <button
                  onClick={handleUpdateAdminPaypal}
                  disabled={saving || !adminPaypalEmail || !adminPaypalEmail.includes("@")}
                  className="px-6 py-3 bg-[#0071E3] text-white rounded-xl font-medium hover:bg-[#0051D0] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#0071E3]/20 hover:shadow-xl hover:shadow-[#0071E3]/30"
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
              <div className="mt-2 space-y-2">
                <p className="text-xs text-[#8E8E93] font-light">
                  Enter the PayPal email address for the admin account that should receive all booking payments.
                </p>
              </div>
              {adminPaypalEmail && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-green-700 font-light">
                      Reference PayPal: <span className="font-medium">{adminPaypalEmail}</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Policy Configuration */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-light text-[#1C1C1E] mb-1">Policy Configuration</h2>
            <p className="text-sm text-[#8E8E93] font-light">Manage platform policies and compliance settings</p>
          </div>
          <div className="flex gap-4">
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-light">
              Refunds Enabled
            </span>
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-light">
              Auto-approve Enabled
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Platform Rules */}
          <div className="bg-gray-50 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-medium text-[#1C1C1E]">Platform Rules</h3>
                <p className="text-xs text-[#8E8E93] font-light">Basic platform regulations and limits</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1C1C1E] mb-2">
                  Cancellation Period (hours)
                </label>
                <input
                  type="number"
                  value={policies.cancellationPeriod}
                  onChange={(e) => handleUpdatePolicy("cancellationPeriod", parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
                />
                <p className="text-xs text-[#8E8E93] font-light mt-1">Hours before check-in for free cancellation</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1C1C1E] mb-2">Max Images</label>
                <input
                  type="number"
                  value={policies.maxImages}
                  onChange={(e) => handleUpdatePolicy("maxImages", parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1C1C1E] mb-2">Review Limit (days)</label>
                <input
                  type="number"
                  value={policies.reviewLimit}
                  onChange={(e) => handleUpdatePolicy("reviewLimit", parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
                />
              </div>
            </div>
          </div>

          {/* PayPal Fees */}
          <div className="bg-gray-50 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-medium text-[#1C1C1E]">PayPal Fees</h3>
                <p className="text-xs text-[#8E8E93] font-light">Transaction fee configuration</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1C1C1E] mb-2">
                  PayPal Fee Percentage (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={policies.paypalFeePercentage}
                  onChange={(e) => handleUpdatePolicy("paypalFeePercentage", parseFloat(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
                />
                <p className="text-xs text-[#8E8E93] font-light mt-1">PayPal transaction fee percentage (0-10%)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1C1C1E] mb-2">PayPal Fixed Fee (PHP)</label>
                <input
                  type="number"
                  value={policies.paypalFixedFee}
                  onChange={(e) => handleUpdatePolicy("paypalFixedFee", parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
                />
                <p className="text-xs text-[#8E8E93] font-light mt-1">Fixed PayPal fee per transaction</p>
              </div>
            </div>
          </div>

          {/* Refund Eligibility */}
          <div className="bg-gray-50 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-medium text-[#1C1C1E]">Refund Eligibility</h3>
                <p className="text-xs text-[#8E8E93] font-light">Configure refund windows and amounts</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1C1C1E] mb-2">
                  Refundable Hours After Confirmation
                </label>
                <input
                  type="number"
                  value={policies.refundableHours}
                  onChange={(e) => handleUpdatePolicy("refundableHours", parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
                />
                <p className="text-xs text-[#8E8E93] font-light mt-1">Hours after host confirmation for full refund (0-168)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1C1C1E] mb-2">Minimum Refund Amount (PHP)</label>
                <input
                  type="number"
                  value={policies.minimumRefundAmount}
                  onChange={(e) => handleUpdatePolicy("minimumRefundAmount", parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
                />
                <p className="text-xs text-[#8E8E93] font-light mt-1">Minimum amount for refund processing</p>
              </div>
            </div>
          </div>

          {/* Processing Settings */}
          <div className="bg-gray-50 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-medium text-[#1C1C1E]">Processing Settings</h3>
                <p className="text-xs text-[#8E8E93] font-light">Refund processing and automation</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1C1C1E] mb-2">Refund Processing Days</label>
                <input
                  type="number"
                  value={policies.refundProcessingDays}
                  onChange={(e) => handleUpdatePolicy("refundProcessingDays", parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
                />
                <p className="text-xs text-[#8E8E93] font-light mt-1">Days to process refunds (1-30)</p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#1C1C1E]">Enable Refunds</p>
                  <p className="text-xs text-[#8E8E93] font-light">Allow users to request refunds for bookings</p>
                </div>
                <button
                  onClick={() => handleUpdatePolicy("refundsEnabled", !policies.refundsEnabled)}
                  className={`w-12 h-6 rounded-full transition-all ${
                    policies.refundsEnabled ? "bg-[#0071E3]" : "bg-gray-300"
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    policies.refundsEnabled ? "translate-x-6" : "translate-x-1"
                  }`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#1C1C1E]">Email Notifications</p>
                  <p className="text-xs text-[#8E8E93] font-light">Send email notifications for refund requests</p>
                </div>
                <button
                  onClick={() => handleUpdatePolicy("emailNotifications", !policies.emailNotifications)}
                  className={`w-12 h-6 rounded-full transition-all ${
                    policies.emailNotifications ? "bg-[#0071E3]" : "bg-gray-300"
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    policies.emailNotifications ? "translate-x-6" : "translate-x-1"
                  }`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#1C1C1E]">Auto-approve Eligible Refunds</p>
                  <p className="text-xs text-[#8E8E93] font-light">Automatically approve refunds that meet eligibility criteria</p>
                </div>
                <button
                  onClick={() => handleUpdatePolicy("autoApproveRefunds", !policies.autoApproveRefunds)}
                  className={`w-12 h-6 rounded-full transition-all ${
                    policies.autoApproveRefunds ? "bg-[#0071E3]" : "bg-gray-300"
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    policies.autoApproveRefunds ? "translate-x-6" : "translate-x-1"
                  }`} />
                </button>
              </div>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="bg-gray-50 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-medium text-[#1C1C1E]">Payment Methods</h3>
                <p className="text-xs text-[#8E8E93] font-light">Enable or disable payment methods for guest bookings</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#1C1C1E]">E-Wallet Payment</p>
              </div>
              <button
                onClick={() => handleUpdatePolicy("eWalletPayment", !policies.eWalletPayment)}
                className={`w-12 h-6 rounded-full transition-all ${
                  policies.eWalletPayment ? "bg-[#0071E3]" : "bg-gray-300"
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  policies.eWalletPayment ? "translate-x-6" : "translate-x-1"
                }`} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Cash-out Approvals Content Component
const CashoutApprovalsContent = () => {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState("pending");

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

      if (newStatus === "completed") {
        const hostRef = doc(db, "users", withdrawal.hostId);
        const hostDoc = await getDoc(hostRef);
        
        if (hostDoc.exists()) {
          const hostData = hostDoc.data();
          const currentBalance = hostData.walletBalance || 0;
          const transactions = hostData.transactions || [];
          
          const transaction = {
            type: "withdrawal_completed",
            amount: withdrawal.amount,
            withdrawalRequestId: withdrawalId,
            date: new Date().toISOString(),
            status: "completed",
            description: `Withdrawal completed: $${withdrawal.amount.toFixed(2)} to ${withdrawal.paypalEmail}`
          };

          await updateDoc(hostRef, {
            walletBalance: currentBalance + withdrawal.amount,
            transactions: [transaction, ...transactions].slice(0, 10)
          });
        }
      } else if (newStatus === "rejected") {
        const hostRef = doc(db, "users", withdrawal.hostId);
        const hostDoc = await getDoc(hostRef);
        
        if (hostDoc.exists()) {
          const hostData = hostDoc.data();
          const currentPending = hostData.pendingBalance || 0;
          const transactions = hostData.transactions || [];
          
          const transaction = {
            type: "withdrawal_rejected",
            amount: withdrawal.amount,
            withdrawalRequestId: withdrawalId,
            date: new Date().toISOString(),
            status: "rejected",
            description: `Withdrawal rejected: $${withdrawal.amount.toFixed(2)} returned to pending balance`
          };

          await updateDoc(hostRef, {
            pendingBalance: currentPending + withdrawal.amount,
            transactions: [transaction, ...transactions].slice(0, 10)
          });
        }
      }

      await updateDoc(withdrawalRef, updateData);
      alert(`Cash-out request ${newStatus} successfully!`);
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
          <div className="text-[#8E8E93] font-light">Loading cash-out requests...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeInUp">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-2xl font-light text-[#1C1C1E] mb-4">Cash-out Approvals</h2>
        
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

      {filteredWithdrawals.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
          <p className="text-[#8E8E93] font-light">No {selectedFilter} cash-out requests</p>
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

// Pending Payouts Content Component
const PendingPayoutsContent = () => {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPayouts();
    
    const unsubscribe = onSnapshot(
      collection(db, "adminPayments"),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPayouts(data.filter(p => !p.withdrawalRequestId));
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching payouts:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const fetchPayouts = async () => {
    try {
      setLoading(true);
      const payoutsQuery = query(collection(db, "adminPayments"));
      const snapshot = await getDocs(payoutsQuery);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPayouts(data.filter(p => !p.withdrawalRequestId));
    } catch (error) {
      console.error("Error fetching payouts:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 animate-fadeInUp">
        <div className="text-center py-12">
          <div className="text-[#8E8E93] font-light">Loading pending payouts...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeInUp">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-2xl font-light text-[#1C1C1E] mb-2">Pending Payouts</h2>
        <p className="text-sm text-[#8E8E93] font-light mb-4">
          Payments received by admin that are awaiting host withdrawal requests
        </p>
        <div className="text-right">
          <p className="text-sm text-[#8E8E93] font-light">Total Pending</p>
          <p className="text-2xl font-light text-[#1C1C1E]">
            {formatCurrency(payouts.reduce((sum, p) => sum + (p.amount || 0), 0))}
          </p>
        </div>
      </div>

      {payouts.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
          <p className="text-[#8E8E93] font-light">No pending payouts</p>
        </div>
      ) : (
        <div className="space-y-4">
          {payouts.map((payout) => (
            <div
              key={payout.id}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-[#1C1C1E] mb-2">Booking Payment</h3>
                  <p className="text-sm text-[#8E8E93] font-light mb-1">Booking ID: {payout.bookingId}</p>
                  <p className="text-sm text-[#8E8E93] font-light mb-1">Host ID: {payout.hostId}</p>
                  <p className="text-sm text-[#8E8E93] font-light mb-1">Guest ID: {payout.guestId}</p>
                  {payout.createdAt && (
                    <p className="text-xs text-[#8E8E93] font-light mt-2">
                      Received: {payout.createdAt.toDate ? payout.createdAt.toDate().toLocaleString() : new Date(payout.createdAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-light text-[#34C759]">{formatCurrency(payout.amount)}</p>
                  <span className="px-3 py-1 rounded-full text-xs font-light bg-yellow-100 text-yellow-700 mt-2 inline-block">
                    Pending
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Termination Appeals Content Component
const TerminationAppealsContent = () => {
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Implement termination appeals fetching
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 animate-fadeInUp">
        <div className="text-center py-12">
          <div className="text-[#8E8E93] font-light">Loading termination appeals...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeInUp">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-2xl font-light text-[#1C1C1E] mb-2">Termination Appeals</h2>
        <p className="text-sm text-[#8E8E93] font-light mb-4">
          Review and process user termination appeals
        </p>
      </div>

      <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
        <p className="text-[#8E8E93] font-light">No termination appeals at this time</p>
        <p className="text-xs text-[#8E8E93] font-light mt-2">This feature will be implemented soon</p>
      </div>
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

export default AdminDashboard;


