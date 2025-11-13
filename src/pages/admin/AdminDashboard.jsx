import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { collection, query, getDocs, onSnapshot, where } from "firebase/firestore";
import { db } from "../../firebase";

const AdminDashboard = () => {
  const { currentUser, userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeSection, setActiveSection] = useState("home");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState({
    totalIncome: 0,
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

  useEffect(() => {
    if (authLoading) return;
    
    if (!currentUser) {
      navigate("/login");
      return;
    }

    // Check if user is admin (you can modify this logic based on your admin role check)
    if (userRole !== "admin") {
      // For now, allow access - you can add admin role check later
      // navigate("/");
      // return;
    }

    // Set active section based on URL
    const path = location.pathname;
    if (path.includes("/admin/listings")) setActiveSection("listings");
    else if (path.includes("/admin/bookings")) setActiveSection("bookings");
    else if (path.includes("/admin/users")) setActiveSection("users");
    else if (path.includes("/admin/messages")) setActiveSection("messages");
    else if (path.includes("/admin/calendar")) setActiveSection("calendar");
    else setActiveSection("home");

    fetchStats();
  }, [currentUser, userRole, authLoading, navigate, location]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      
      // Fetch all listings
      const listingsQuery = query(collection(db, "listings"));
      const listingsSnapshot = await getDocs(listingsQuery);
      const allListings = listingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Fetch all bookings
      const bookingsQuery = query(collection(db, "bookings"));
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
        upcomingBookings
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
              icon="users"
              label="Users"
              active={activeSection === "users"}
              onClick={() => handleSectionChange("users")}
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
            <div className="text-sm text-[#8E8E93] font-light">
              {getCurrentDate()}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {activeSection === "home" && <HomeContent stats={stats} formatCurrency={formatCurrency} />}
          {activeSection === "listings" && <ListingsContent />}
          {activeSection === "users" && <UsersContent />}
          {activeSection === "bookings" && <BookingsContent />}
          {activeSection === "calendar" && <CalendarContent />}
          {activeSection === "messages" && <MessagesContent />}
        </main>
      </div>
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
    users: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
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

// Home Content Component
const HomeContent = ({ stats, formatCurrency }) => {
  const { currentUser } = useAuth();
  const userName = currentUser?.displayName?.split(" ")[0] || currentUser?.email?.split("@")[0] || "Admin";

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
    <div className="space-y-8 animate-fadeInUp">
      {/* Welcome Section */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100">
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
              Here's what's happening with your platform today.
            </p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {statCards.map((card, index) => (
          <StatCard key={index} {...card} />
        ))}
      </div>

      {/* Booking Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MonthlyEarningsCard />
        <RecentMessagesCard />
      </div>

      <GuestReviewsCard />
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
      className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 animate-fadeInUp"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center text-white`}>
          {icons[icon]}
        </div>
      </div>
      <div>
        <p className="text-sm text-[#8E8E93] font-light mb-1">{label}</p>
        <p className="text-2xl sm:text-3xl font-light text-[#1C1C1E]">{value}</p>
        {subtitle && (
          <p className="text-xs text-[#8E8E93] font-light mt-1">{subtitle}</p>
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
    <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 animate-fadeInUp">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-[#0071E3]/10 flex items-center justify-center text-[#0071E3]">
          {icons[icon]}
        </div>
        <div>
          <h3 className="text-lg font-light text-[#1C1C1E]">{title}</h3>
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
    <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 animate-fadeInUp">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-[#FF9500]/10 flex items-center justify-center text-[#FF9500]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-light text-[#1C1C1E]">Monthly Earnings</h3>
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
    <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 animate-fadeInUp">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-[#AF52DE]/10 flex items-center justify-center text-[#AF52DE]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-light text-[#1C1C1E]">Recent Messages</h3>
          <p className="text-sm text-[#8E8E93] font-light">Latest conversations</p>
        </div>
      </div>
      <div className="text-center py-8">
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

// Guest Reviews Card
const GuestReviewsCard = () => {
  return (
    <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 animate-fadeInUp">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-[#FFCC00]/10 flex items-center justify-center text-[#FF9500]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-light text-[#1C1C1E]">Guest Reviews</h3>
          <p className="text-sm text-[#8E8E93] font-light">Latest feedback from guests</p>
        </div>
      </div>
      <div className="text-center py-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </div>
        <p className="text-sm text-[#8E8E93] font-light">No reviews yet</p>
      </div>
    </div>
  );
};

// Placeholder Content Components
const ListingsContent = () => (
  <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 animate-fadeInUp">
    <h2 className="text-2xl font-light text-[#1C1C1E] mb-4">Listings Management</h2>
    <p className="text-[#8E8E93] font-light">Listings management content coming soon...</p>
  </div>
);

const UsersContent = () => (
  <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 animate-fadeInUp">
    <h2 className="text-2xl font-light text-[#1C1C1E] mb-4">Users Management</h2>
    <p className="text-[#8E8E93] font-light">Users management content coming soon...</p>
  </div>
);

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

export default AdminDashboard;


