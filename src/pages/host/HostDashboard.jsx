import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase";

const HostDashboard = () => {
  const { currentUser, userRole, userRoles, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("listings"); // listings, bookings
  const [selectedFilter, setSelectedFilter] = useState("underReview"); // underReview, today, upcoming, rejected
  const [unreadCounts, setUnreadCounts] = useState({}); // { bookingId: count }

  useEffect(() => {
    // Wait for auth to finish loading before checking
    if (authLoading) {
      return;
    }

    if (!currentUser) {
      navigate("/login");
      return;
    }

    // Check if user has host role
    if (!userRoles || !userRoles.includes("host")) {
      navigate("/");
      return;
    }

    fetchData();
  }, [currentUser, userRoles, authLoading, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchListings(), fetchBookings()]);
    } finally {
      setLoading(false);
    }
  };

  const fetchListings = async () => {
    try {
      console.log("Fetching listings for host:", currentUser.uid);

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

      console.log("Listings fetched:", listingsData);
      setListings(listingsData);
    } catch (error) {
      console.error("Error fetching listings:", error);
    }
  };

  const fetchBookings = async () => {
    try {
      console.log("Fetching bookings for host:", currentUser.uid);

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

      // Sort by createdAt (newest first)
      bookingsData.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA;
      });

      console.log("Bookings fetched:", bookingsData);
      setBookings(bookingsData);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    }
  };

  // Fetch unread message counts for each booking
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
          // Ignore index errors - unread counts are optional
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

  const handleUpdateBookingStatus = async (bookingId, newStatus) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) {
      alert("Booking not found.");
      return;
    }

    if (newStatus === "confirmed") {
      // IMPORTANT: Only allow confirming PAID bookings
      if (booking.paymentStatus !== "paid") {
        alert("❌ Cannot confirm booking. Payment has not been completed. Please wait for the guest to complete payment.");
        return;
      }

      try {
        // Check for conflicts with other confirmed bookings
        const checkInDate = new Date(booking.checkIn);
        const checkOutDate = new Date(booking.checkOut);
        
        let hasConflict = false;
        let conflictInfo = null;

        // Check against all bookings for this listing
        bookings.forEach((existingBooking) => {
          if (existingBooking.id === bookingId) return; // Skip the current booking
          if (existingBooking.listingId !== booking.listingId) return; // Skip other listings
          if (existingBooking.status !== "confirmed") return; // Only check confirmed bookings
          
          const existingCheckIn = new Date(existingBooking.checkIn);
          const existingCheckOut = new Date(existingBooking.checkOut);
          
          // Check if dates overlap
          if (checkInDate < existingCheckOut && checkOutDate > existingCheckIn) {
            hasConflict = true;
            conflictInfo = {
              checkIn: existingBooking.checkIn,
              checkOut: existingBooking.checkOut,
            };
          }
        });

        if (hasConflict) {
          alert(`❌ Cannot confirm booking. These dates conflict with an existing confirmed booking:\n${new Date(conflictInfo.checkIn).toLocaleDateString()} - ${new Date(conflictInfo.checkOut).toLocaleDateString()}\n\nPlease cancel or modify the conflicting booking first.`);
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
        // Add directly to host's wallet balance (money goes directly to host's e-wallet)
        const hostRef = doc(db, "users", booking.hostId);
        const hostDoc = await getDoc(hostRef);
        
        if (hostDoc.exists()) {
          const hostData = hostDoc.data();
          const currentWalletBalance = hostData.walletBalance || 0;
          const hostTransactions = hostData.transactions || [];
          
          const hostTransaction = {
            type: "booking_earnings",
            amount: bookingAmount,
            bookingId: bookingId,
            date: new Date().toISOString(),
            status: "completed",
            description: `Earnings from booking: ${booking.listingTitle || "Booking"}`,
            paymentMethod: booking.paymentMethod || "paypal"
          };
          
          await updateDoc(hostRef, {
            walletBalance: currentWalletBalance + bookingAmount,
            transactions: [hostTransaction, ...hostTransactions].slice(0, 10)
          });
        }
        
        // Record payment to admin for tracking purposes (PayPal payments go to admin's PayPal)
        // Note: PayPal payments from guests go to admin's PayPal account
        // Host receives money directly in their wallet when booking is accepted
        try {
          await addDoc(collection(db, "adminPayments"), {
            bookingId: bookingId,
            hostId: booking.hostId,
            guestId: booking.guestId,
            amount: bookingAmount,
            status: "received", // Money received by admin via PayPal (if PayPal payment)
            paymentMethod: booking.paymentMethod || "paypal",
            paypalOrderId: booking.paypalOrderId || null,
            hostWalletCredit: true, // Host has been credited in wallet
            createdAt: serverTimestamp()
          });
        } catch (error) {
          console.error("Error recording admin payment:", error);
        }

        // Send system message to guest about acceptance
        try {
          const conversationId = bookingId;
          const systemMessage = {
            bookingId: bookingId,
            conversationId: conversationId,
            senderId: "system",
            senderName: "System",
            senderEmail: "system@voyago.com",
            receiverId: booking.guestId,
            receiverEmail: booking.guestEmail || "",
            message: `Your booking for "${booking.listingTitle || "this listing"}" has been accepted! We're looking forward to hosting you.`,
            isSystem: true,
            systemType: "booking_accepted",
            createdAt: serverTimestamp(),
            read: false,
          };
          
          await addDoc(collection(db, "messages"), systemMessage);
        } catch (messageError) {
          console.error("Error sending system message:", messageError);
        }

        // Send booking confirmation email to guest
        console.log("📧 Starting to send booking confirmation email for booking:", bookingId);
        try {
          console.log("📧 Importing sendBookingConfirmationEmail...");
          const { sendBookingConfirmationEmail } = await import("../../utils/bookingEmails");
          console.log("📧 Email function imported successfully, calling with bookingId:", bookingId);
          const emailResult = await sendBookingConfirmationEmail(bookingId);
          console.log("📧 Email function returned:", emailResult);
          if (!emailResult.success) {
            console.error("❌ Failed to send booking confirmation email:", emailResult.error);
          } else {
            console.log("✅ Booking confirmation email sent successfully");
          }
        } catch (emailError) {
          console.error("❌ Error sending booking confirmation email:", emailError);
          console.error("❌ Error stack:", emailError.stack);
          // Don't block booking confirmation if email fails
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
          const conversationId = bookingId;
          const systemMessage = {
            bookingId: bookingId,
            conversationId: conversationId,
            senderId: "system",
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
        }
      }
      
      // Refresh bookings
      await fetchData();
      alert(`Booking ${actionText === "accept" ? "accepted" : actionText === "reject" ? "rejected" : newStatus} successfully! ${newStatus === "confirmed" ? `$${bookingAmount.toFixed(2)} has been added to your wallet balance.` : newStatus === "rejected" ? `$${bookingAmount.toFixed(2)} has been refunded to the guest.` : ""}`);
    } catch (error) {
      console.error("Error updating booking status:", error);
      alert("Failed to update booking status. Please try again.");
    }
  };

  const handleDeleteListing = async (listingId) => {
    if (!window.confirm("Are you sure you want to delete this listing? This action cannot be undone.")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "listings", listingId));
      
      // Refresh listings
      await fetchListings();
      alert("Listing deleted successfully!");
    } catch (error) {
      console.error("Error deleting listing:", error);
      alert("Failed to delete listing. Please try again.");
    }
  };

  const handleUpdateListingStatus = async (listingId, newStatus) => {
    try {
      await updateDoc(doc(db, "listings", listingId), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
      
      // Refresh listings
      await fetchListings();
      alert(`Listing ${newStatus} successfully!`);
    } catch (error) {
      console.error("Error updating listing status:", error);
      alert("Failed to update listing status. Please try again.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

      // Filter bookings based on selected tab
      const filteredBookings = (bookings || []).filter((booking) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const checkInDate = new Date(booking.checkIn);
        checkInDate.setHours(0, 0, 0, 0);
        const checkOutDate = new Date(booking.checkOut);
        checkOutDate.setHours(0, 0, 0, 0);

        switch (selectedFilter) {
          case "underReview":
            // Show pending bookings waiting for approval
            return booking.status === "pending";
          case "today":
            // Show accepted bookings (confirmed) that are happening today
            return booking.status === "confirmed" && 
                   checkInDate.getTime() === today.getTime();
          case "upcoming":
            // Show accepted bookings (confirmed) that are in the future
            return booking.status === "confirmed" && 
                   checkInDate.getTime() > today.getTime();
          case "rejected":
            // Show rejected or cancelled bookings
            return booking.status === "rejected" || booking.status === "cancelled";
          default:
            return true;
        }
      });

      // Calculate stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const pendingBookings = (bookings || []).filter(b => b.status === "pending");
      const todayBookings = (bookings || []).filter(b => {
        if (b.status !== "confirmed") return false;
        const checkIn = new Date(b.checkIn);
        checkIn.setHours(0, 0, 0, 0);
        return checkIn.getTime() === today.getTime();
      });
      const upcomingBookings = (bookings || []).filter(b => {
        if (b.status !== "confirmed") return false;
        const checkIn = new Date(b.checkIn);
        checkIn.setHours(0, 0, 0, 0);
        return checkIn.getTime() > today.getTime();
      });
      const rejectedBookings = (bookings || []).filter(b => 
        b.status === "rejected" || b.status === "cancelled"
      );

      const stats = {
        totalListings: (listings || []).length,
        activeListings: (listings || []).filter(l => l.status === "active").length,
        totalBookings: (bookings || []).length,
        pendingBookings: pendingBookings.length,
        todayBookings: todayBookings.length,
        upcomingBookings: upcomingBookings.length,
        rejectedBookings: rejectedBookings.length,
        confirmedBookings: (bookings || []).filter(b => b.status === "confirmed").length,
        totalRevenue: (bookings || [])
          .filter(b => b.status === "confirmed" || b.status === "completed")
          .reduce((sum, b) => sum + (b.totalPrice || 0), 0),
      };

  // Get status badge color
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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#1C1C1E] font-light">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header removed for host mode */}

      {/* Main Content */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl font-light text-[#1C1C1E] mb-2">
            Host Dashboard
          </h1>
          <p className="text-sm sm:text-base text-[#1C1C1E]/70 font-light">
            Manage your listings and bookings
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-sm">
            <div className="text-2xl sm:text-3xl font-light text-[#1C1C1E] mb-1">
              {stats.totalListings}
            </div>
            <div className="text-xs sm:text-sm text-[#1C1C1E]/70 font-light">
              Total Listings
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-sm">
            <div className="text-2xl sm:text-3xl font-light text-[#1C1C1E] mb-1">
              {stats.activeListings}
            </div>
            <div className="text-xs sm:text-sm text-[#1C1C1E]/70 font-light">
              Active Listings
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-sm">
            <div className="text-2xl sm:text-3xl font-light text-[#1C1C1E] mb-1">
              {stats.totalBookings}
            </div>
            <div className="text-xs sm:text-sm text-[#1C1C1E]/70 font-light">
              Total Bookings
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-sm">
            <div className="text-2xl sm:text-3xl font-light text-[#1C1C1E] mb-1">
              ${stats.totalRevenue.toFixed(2)}
            </div>
            <div className="text-xs sm:text-sm text-[#1C1C1E]/70 font-light">
              Total Revenue
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 sm:mb-8">
          <div className="flex gap-2 sm:gap-3 border-b border-gray-200">
            <button
              onClick={() => setActiveTab("listings")}
              className={`px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-light transition-all border-b-2 ${
                activeTab === "listings"
                  ? "border-[#0071E3] text-[#0071E3]"
                  : "border-transparent text-[#1C1C1E]/70 hover:text-[#1C1C1E]"
              }`}
            >
              My Listings ({(listings || []).length})
            </button>
            <button
              onClick={() => setActiveTab("bookings")}
              className={`px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-light transition-all border-b-2 ${
                activeTab === "bookings"
                  ? "border-[#0071E3] text-[#0071E3]"
                  : "border-transparent text-[#1C1C1E]/70 hover:text-[#1C1C1E]"
              }`}
            >
              Bookings ({(bookings || []).length})
            </button>
          </div>
        </div>

        {/* Content */}
        {activeTab === "listings" ? (
          <>
            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-xl sm:text-2xl font-light text-[#1C1C1E]">
                My Listings
              </h2>
              <Link
                to="/host/create-listing"
                className="bg-[#0071E3] text-white px-4 sm:px-6 py-2 sm:py-3 rounded-2xl text-sm sm:text-base font-light hover:bg-[#0051D0] transition-all shadow-md hover:shadow-lg"
              >
                + Create Listing
              </Link>
            </div>

            {listings.length === 0 ? (
              <div className="text-center py-12 sm:py-16">
                <div className="text-5xl sm:text-6xl mb-4 sm:mb-6">🏠</div>
                <h2 className="text-2xl sm:text-3xl font-light text-[#1C1C1E] mb-2">
                  No listings yet
                </h2>
                <p className="text-[#1C1C1E]/70 font-light mb-6">
                  Create your first listing to start hosting!
                </p>
                <Link
                  to="/host/create-listing"
                  className="inline-block bg-[#0071E3] text-white px-6 sm:px-8 py-3 sm:py-4 rounded-2xl text-sm sm:text-base font-light hover:bg-[#0051D0] transition-all duration-300 shadow-md hover:shadow-lg"
                >
                  Create Listing
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                {listings.map((listing) => (
                  <div
                    key={listing.id}
                    className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 border border-gray-100 transform hover:-translate-y-1"
                  >
                    {/* Image */}
                    <Link to={`/listing/${listing.id}`}>
                      <div className="relative w-full h-48 sm:h-56 overflow-hidden bg-gray-100">
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
                          <span
                            className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-light capitalize ${getStatusBadge(
                              listing.status
                            )}`}
                          >
                            {listing.status}
                          </span>
                        </div>
                      </div>
                    </Link>

                    {/* Content */}
                    <div className="p-4 sm:p-5">
                      <Link to={`/listing/${listing.id}`}>
                        <h3 className="text-base sm:text-lg font-light text-[#1C1C1E] mb-2 line-clamp-2 hover:text-[#0071E3] transition-colors">
                          {listing.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-[#1C1C1E]/70 font-light mb-3">
                          {listing.location}
                        </p>
                      </Link>

                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <span className="text-lg sm:text-xl font-light text-[#1C1C1E]">
                            ${listing.price}
                          </span>
                          <span className="text-xs sm:text-sm text-[#1C1C1E]/70 font-light ml-1">
                            {listing.category === "place" || listing.subcategory || listing.placeType 
                              ? "/night" 
                              : listing.category === "experience" || listing.activityType 
                              ? "/person" 
                              : listing.category === "service" || listing.serviceType 
                              ? "/service" 
                              : "/night"}
                          </span>
                        </div>
                        {listing.maxGuests && (
                          <div className="text-xs sm:text-sm text-[#1C1C1E]/70 font-light">
                            Max {listing.maxGuests} guests
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-3 border-t border-gray-100">
                        {listing.status === "active" ? (
                          <button
                            onClick={() => handleUpdateListingStatus(listing.id, "inactive")}
                            className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs sm:text-sm font-light hover:bg-gray-200 transition-colors"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpdateListingStatus(listing.id, "active")}
                            className="flex-1 px-3 py-2 bg-[#34C759]/10 text-[#34C759] rounded-lg text-xs sm:text-sm font-light hover:bg-[#34C759]/20 transition-colors"
                          >
                            Activate
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteListing(listing.id)}
                          className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-xs sm:text-sm font-light hover:bg-red-100 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-xl sm:text-2xl font-light text-[#1C1C1E] mb-4">
                Manage Bookings
              </h2>
              
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
                  Under Review ({stats.pendingBookings})
                </button>
                <button
                  onClick={() => setSelectedFilter("today")}
                  className={`px-4 sm:px-6 py-2 sm:py-3 rounded-t-lg text-sm sm:text-base font-light transition-all border-b-2 ${
                    selectedFilter === "today"
                      ? "border-[#FF9500] text-[#FF9500]"
                      : "border-transparent text-[#1C1C1E]/70 hover:text-[#1C1C1E]"
                  }`}
                >
                  Today ({stats.todayBookings})
                </button>
                <button
                  onClick={() => setSelectedFilter("upcoming")}
                  className={`px-4 sm:px-6 py-2 sm:py-3 rounded-t-lg text-sm sm:text-base font-light transition-all border-b-2 ${
                    selectedFilter === "upcoming"
                      ? "border-[#FF9500] text-[#FF9500]"
                      : "border-transparent text-[#1C1C1E]/70 hover:text-[#1C1C1E]"
                  }`}
                >
                  Upcoming ({stats.upcomingBookings})
                </button>
                <button
                  onClick={() => setSelectedFilter("rejected")}
                  className={`px-4 sm:px-6 py-2 sm:py-3 rounded-t-lg text-sm sm:text-base font-light transition-all border-b-2 ${
                    selectedFilter === "rejected"
                      ? "border-[#FF9500] text-[#FF9500]"
                      : "border-transparent text-[#1C1C1E]/70 hover:text-[#1C1C1E]"
                  }`}
                >
                  Rejected / Cancelled ({stats.rejectedBookings})
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
          </>
        )}
      </div>

      {/* Footer */}
      <div className="bg-[#1C1C1E] text-white px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center text-xs sm:text-sm font-light mt-12 sm:mt-16">
        <div>© 2025 Voyago</div>
        <div>Privacy & Terms</div>
      </div>
    </div>
  );
};

export default HostDashboard;

