import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { collection, query, where, getDocs, onSnapshot, doc, updateDoc, addDoc, orderBy, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { PAYPAL_CLIENT_ID } from "../../config/paypal";
import Header from "../../components/Header";

const GuestDashboard = () => {
  const { currentUser, userRole, userRoles, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState("all"); // all, upcoming, past, pending
  const [unreadCounts, setUnreadCounts] = useState({}); // { bookingId: count }
  const [payingBookingId, setPayingBookingId] = useState(null); // Track which booking is being paid
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [showWishlistModal, setShowWishlistModal] = useState(false);
  const [selectedBookingForWishlist, setSelectedBookingForWishlist] = useState(null);
  const [wishlistTitle, setWishlistTitle] = useState("");
  const [wishlistDescription, setWishlistDescription] = useState("");
  const [wishlistCategory, setWishlistCategory] = useState("accommodation");
  const [isSubmittingWishlist, setIsSubmittingWishlist] = useState(false);
  const [existingWishlists, setExistingWishlists] = useState({}); // { bookingId: true/false }
  const [cancellingBookingId, setCancellingBookingId] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [selectedBookingToCancel, setSelectedBookingToCancel] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date()); // For countdown timer updates

  useEffect(() => {
    // Wait for auth to finish loading before checking
    if (authLoading) {
      return;
    }

    if (!currentUser) {
      navigate("/login");
      return;
    }

    // Allow access if user has guest role (even if they also have host role)
    const hasGuestRole = userRole === "guest" || (userRoles && userRoles.includes("guest"));
    if (!hasGuestRole) {
      navigate("/");
      return;
    }

    fetchBookings();
  }, [currentUser, userRole, userRoles, authLoading, navigate]);

  // Update current time every minute for countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      console.log("Fetching bookings for guest:", currentUser.uid);

      // Fetch without orderBy to avoid index requirement, then sort in JavaScript
      const q = query(
        collection(db, "bookings"),
        where("guestId", "==", currentUser.uid)
      );

      const querySnapshot = await getDocs(q);
      const bookingsData = [];

      querySnapshot.forEach((doc) => {
        bookingsData.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      // Sort by createdAt in JavaScript (newest first)
      bookingsData.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA; // Descending order (newest first)
      });

      console.log("Bookings fetched:", bookingsData);
      setBookings(bookingsData);

      // Fetch existing wishlists to check which bookings already have wishlists
      const wishlistsQuery = query(
        collection(db, "wishlistRequests"),
        where("guestId", "==", currentUser.uid)
      );
      const wishlistsSnapshot = await getDocs(wishlistsQuery);
      const wishlistsMap = {};
      wishlistsSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.bookingId) {
          wishlistsMap[data.bookingId] = true;
        }
      });
      setExistingWishlists(wishlistsMap);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      if (error.code === "permission-denied") {
        console.error("❌ Permission denied. Please check Firestore security rules.");
      } else if (error.code === "failed-precondition") {
        console.error("❌ Index required. Fetching without orderBy and sorting in JavaScript instead.");
        // Retry without orderBy
        try {
          const q = query(
            collection(db, "bookings"),
            where("guestId", "==", currentUser.uid)
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
        } catch (retryError) {
          console.error("Retry also failed:", retryError);
        }
      }
    } finally {
      setLoading(false);
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

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Filter bookings based on selected filter
  // Check if checkout date has passed
  const isCheckoutPassed = (checkOutDate) => {
    const checkout = new Date(checkOutDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    checkout.setHours(0, 0, 0, 0);
    return checkout < today;
  };

  // Check if booking was created within the last 24 hours (cooling off period)
  // Uses currentTime state to update in real-time
  const isWithin24HoursOfBooking = (bookingCreatedAt) => {
    if (!bookingCreatedAt) return false;
    const bookingCreated = new Date(bookingCreatedAt);
    const now = currentTime; // Use state instead of new Date() for real-time updates
    const hoursSinceBooking = (now - bookingCreated) / (1000 * 60 * 60);
    return hoursSinceBooking > 0 && hoursSinceBooking <= 24;
  };

  // Calculate time remaining for refund eligibility (in hours and minutes)
  // Uses currentTime state to update in real-time
  const getRefundTimeRemaining = (bookingCreatedAt) => {
    if (!bookingCreatedAt) return null;
    const bookingCreated = new Date(bookingCreatedAt);
    const now = currentTime; // Use state instead of new Date() for real-time updates
    const hoursSinceBooking = (now - bookingCreated) / (1000 * 60 * 60);
    const hoursRemaining = 24 - hoursSinceBooking;
    
    if (hoursRemaining <= 0) return null;
    
    const hours = Math.floor(hoursRemaining);
    const minutes = Math.floor((hoursRemaining - hours) * 60);
    return { hours, minutes, totalHours: hoursRemaining };
  };

  // Calculate refund amount based on cancellation time
  // 70% refund if cancelled within 24 hours of booking creation, otherwise no refund
  const calculateRefund = (booking) => {
    if (isWithin24HoursOfBooking(booking.createdAt)) {
      return booking.totalPrice * 0.7; // 70% refund
    }
    return 0; // No refund after 24 hours from booking creation
  };

  // Handle booking cancellation
  const handleCancelBooking = async (booking) => {
    if (booking.status === "cancelled") {
      alert("This booking has already been cancelled.");
      return;
    }

    // Validate: Cannot cancel completed bookings
    if (booking.status === "completed") {
      alert("Cannot cancel a completed booking.");
      return;
    }

    // Validate: Cannot cancel if check-in date has already passed (compare dates only, not time)
    const checkInDate = new Date(booking.checkIn);
    checkInDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Only prevent cancellation if check-in date is in the past (yesterday or earlier)
    if (checkInDate < today) {
      alert("Cannot cancel a booking after check-in date has passed.");
      return;
    }

    const refundAmount = calculateRefund(booking);
    const refundText = refundAmount > 0 
      ? `You will receive a 70% refund of $${refundAmount.toFixed(2)} (cancelled within 24 hours of booking).`
      : "No refund will be issued (cancelled after 24 hours from booking creation).";

    if (!window.confirm(`Are you sure you want to cancel this booking?\n\n${refundText}\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      setCancellingBookingId(booking.id);

      const bookingRef = doc(db, "bookings", booking.id);
      const bookingDoc = await getDoc(bookingRef);
      
      if (!bookingDoc.exists()) {
        alert("Booking not found");
        return;
      }

      const bookingData = bookingDoc.data();
      const bookingAmount = bookingData.totalPrice || 0;
      const serviceFee = refundAmount > 0 ? (bookingAmount - refundAmount) : 0;

      // Update booking status
      await updateDoc(bookingRef, {
        status: "cancelled",
        cancelledAt: new Date().toISOString(),
        cancelledBy: currentUser.uid,
        refundAmount: refundAmount,
        serviceFeeRetained: serviceFee,
        updatedAt: new Date().toISOString()
      });

      // Update adminPayments record if it exists
      try {
        const adminPaymentsQuery = query(
          collection(db, "adminPayments"),
          where("bookingId", "==", booking.id)
        );
        const adminPaymentsSnapshot = await getDocs(adminPaymentsQuery);
        
        if (!adminPaymentsSnapshot.empty) {
          const adminPaymentDoc = adminPaymentsSnapshot.docs[0];
          await updateDoc(doc(db, "adminPayments", adminPaymentDoc.id), {
            status: "cancelled",
            cancelledAt: new Date().toISOString(),
            refundAmount: refundAmount,
            serviceFeeRetained: serviceFee,
            updatedAt: new Date().toISOString()
          });
        }
      } catch (adminPaymentError) {
        console.error("Error updating admin payment record:", adminPaymentError);
        // Don't block cancellation if admin payment update fails
      }

      // Track service fee as platform revenue if refund was issued
      if (serviceFee > 0) {
        try {
          await addDoc(collection(db, "platformRevenue"), {
            type: "cancellation_service_fee",
            bookingId: booking.id,
            amount: serviceFee,
            guestId: bookingData.guestId,
            hostId: bookingData.hostId,
            description: `Service fee retained from cancelled booking: ${bookingData.listingTitle || "Booking"}`,
            createdAt: new Date().toISOString(),
            timestamp: serverTimestamp()
          });
        } catch (revenueError) {
          console.error("Error tracking service fee revenue:", revenueError);
          // Don't block cancellation if revenue tracking fails
        }
      }

      // Process refund if applicable
      if (refundAmount > 0) {
        // Add refund to guest's wallet
        const guestRef = doc(db, "users", currentUser.uid);
        const guestDoc = await getDoc(guestRef);
        
        if (guestDoc.exists()) {
          const guestData = guestDoc.data();
          const currentWalletBalance = guestData.walletBalance || 0;
          const guestTransactions = guestData.transactions || [];
          
          const refundTransaction = {
            type: "booking_cancellation_refund",
            amount: refundAmount,
            bookingId: booking.id,
            date: new Date().toISOString(),
            status: "completed",
            description: `Refund for cancelled booking: ${bookingData.listingTitle || "Booking"} (70% refund)`
          };
          
          await updateDoc(guestRef, {
            walletBalance: currentWalletBalance + refundAmount,
            transactions: [refundTransaction, ...guestTransactions].slice(0, 10)
          });
        }

        // If booking was confirmed, reduce host's wallet balance
        if (bookingData.status === "confirmed" && bookingData.hostId) {
          const hostRef = doc(db, "users", bookingData.hostId);
          const hostDoc = await getDoc(hostRef);
          
          if (hostDoc.exists()) {
            const hostData = hostDoc.data();
            const currentWalletBalance = hostData.walletBalance || 0;
            const hostTransactions = hostData.transactions || [];
            
            // Deduct the full booking amount from host's wallet balance
            const deductionTransaction = {
              type: "booking_cancelled",
              amount: -bookingAmount,
              bookingId: booking.id,
              date: new Date().toISOString(),
              status: "completed",
              description: `Booking cancelled: ${bookingData.listingTitle || "Booking"}`
            };
            
            await updateDoc(hostRef, {
              walletBalance: Math.max(0, currentWalletBalance - bookingAmount),
              transactions: [deductionTransaction, ...hostTransactions].slice(0, 10)
            });
          }
        }
      } else {
        // No refund - still need to update host's wallet balance if booking was confirmed
        if (bookingData.status === "confirmed" && bookingData.hostId) {
          const hostRef = doc(db, "users", bookingData.hostId);
          const hostDoc = await getDoc(hostRef);
          
          if (hostDoc.exists()) {
            const hostData = hostDoc.data();
            const currentWalletBalance = hostData.walletBalance || 0;
            const hostTransactions = hostData.transactions || [];
            
            const deductionTransaction = {
              type: "booking_cancelled",
              amount: -bookingAmount,
              bookingId: booking.id,
              date: new Date().toISOString(),
              status: "completed",
              description: `Booking cancelled (no refund): ${bookingData.listingTitle || "Booking"}`
            };
            
            await updateDoc(hostRef, {
              walletBalance: Math.max(0, currentWalletBalance - bookingAmount),
              transactions: [deductionTransaction, ...hostTransactions].slice(0, 10)
            });
          }
        }
      }

      // Send system message
      try {
        const conversationId = booking.id;
        const systemMessage = {
          bookingId: booking.id,
          conversationId: conversationId,
          senderId: "system",
          senderName: "System",
          senderEmail: "system@voyago.com",
          receiverId: bookingData.hostId,
          receiverEmail: bookingData.hostEmail || "",
          message: `Booking for "${bookingData.listingTitle || "this listing"}" has been cancelled by the guest.${refundAmount > 0 ? ` Guest received a 70% refund of $${refundAmount.toFixed(2)}.` : " No refund was issued."}`,
          isSystem: true,
          systemType: "booking_cancelled",
          createdAt: serverTimestamp(),
          read: false,
        };
        
        await addDoc(collection(db, "messages"), systemMessage);
      } catch (messageError) {
        console.error("Error sending system message:", messageError);
      }

      // Send booking cancellation email to guest
      try {
        const { sendBookingCancellationEmail } = await import("../../utils/bookingEmails");
        // serviceFee is already calculated above
        const emailResult = await sendBookingCancellationEmail(booking.id, refundAmount, serviceFee);
        if (!emailResult.success) {
          console.error("Failed to send booking cancellation email:", emailResult.error);
        } else {
          console.log("✅ Booking cancellation email sent successfully");
        }
      } catch (emailError) {
        console.error("❌ Error sending booking cancellation email:", emailError);
        // Don't block booking cancellation if email fails
      }

      // Refresh bookings
      await fetchBookings();
      
      alert(`Booking cancelled successfully.${refundAmount > 0 ? ` $${refundAmount.toFixed(2)} has been refunded to your wallet.` : " No refund was issued."}`);
    } catch (error) {
      console.error("Error cancelling booking:", error);
      alert("Failed to cancel booking. Please try again.");
    } finally {
      setCancellingBookingId(null);
      setShowCancelConfirm(false);
      setSelectedBookingToCancel(null);
    }
  };

  // Handle wishlist creation
  const handleOpenWishlistModal = (booking) => {
    setSelectedBookingForWishlist(booking);
    setShowWishlistModal(true);
  };

  const handleSubmitWishlist = async () => {
    if (!wishlistTitle.trim() || !wishlistDescription.trim()) {
      alert("Please fill in all fields");
      return;
    }

    try {
      setIsSubmittingWishlist(true);
      
      const booking = selectedBookingForWishlist;
      
      // Create wishlist request
      await addDoc(collection(db, "wishlistRequests"), {
        guestId: currentUser.uid,
        guestEmail: currentUser.email,
        guestName: currentUser.displayName || currentUser.email?.split('@')[0],
        hostId: booking.hostId,
        hostEmail: booking.hostEmail,
        bookingId: booking.id,
        listingId: booking.listingId,
        listingTitle: booking.listingTitle,
        listingLocation: booking.listingLocation,
        title: wishlistTitle.trim(),
        description: wishlistDescription.trim(),
        category: wishlistCategory,
        status: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Update existing wishlists map
      setExistingWishlists(prev => ({
        ...prev,
        [booking.id]: true
      }));

      // Reset form
      setWishlistTitle("");
      setWishlistDescription("");
      setWishlistCategory("accommodation");
      setShowWishlistModal(false);
      setSelectedBookingForWishlist(null);

      alert("Improvement request submitted successfully!");
    } catch (error) {
      console.error("Error submitting wishlist:", error);
      alert("Failed to submit request. Please try again.");
    } finally {
      setIsSubmittingWishlist(false);
    }
  };

  const filteredBookings = bookings.filter((booking) => {
    const checkInDate = new Date(booking.checkIn);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (selectedFilter) {
      case "upcoming":
        return checkInDate >= today && booking.status !== "cancelled";
      case "past":
        return checkInDate < today || booking.status === "completed";
      case "pending":
        return booking.status === "pending";
      default:
        return true;
    }
  });

  // Get status badge color
  const getStatusBadge = (status) => {
    switch (status) {
      case "confirmed":
        return "bg-[#34C759]/10 text-[#34C759]";
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      case "cancelled":
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
      <Header />

      {/* Main Content */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl font-light text-[#1C1C1E] mb-2">
            My Bookings
          </h1>
          <p className="text-sm sm:text-base text-[#1C1C1E]/70 font-light">
            Manage your reservations and trips
          </p>
        </div>

        {/* Filter Buttons */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <button
              onClick={() => setSelectedFilter("all")}
              className={`px-4 sm:px-6 py-2 sm:py-3 rounded-full text-sm sm:text-base font-light transition-all ${
                selectedFilter === "all"
                  ? "bg-[#0071E3] text-white shadow-md"
                  : "bg-white border border-gray-300 text-[#1C1C1E] hover:border-gray-400"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedFilter("upcoming")}
              className={`px-4 sm:px-6 py-2 sm:py-3 rounded-full text-sm sm:text-base font-light transition-all ${
                selectedFilter === "upcoming"
                  ? "bg-[#0071E3] text-white shadow-md"
                  : "bg-white border border-gray-300 text-[#1C1C1E] hover:border-gray-400"
              }`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setSelectedFilter("pending")}
              className={`px-4 sm:px-6 py-2 sm:py-3 rounded-full text-sm sm:text-base font-light transition-all ${
                selectedFilter === "pending"
                  ? "bg-[#0071E3] text-white shadow-md"
                  : "bg-white border border-gray-300 text-[#1C1C1E] hover:border-gray-400"
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setSelectedFilter("past")}
              className={`px-4 sm:px-6 py-2 sm:py-3 rounded-full text-sm sm:text-base font-light transition-all ${
                selectedFilter === "past"
                  ? "bg-[#0071E3] text-white shadow-md"
                  : "bg-white border border-gray-300 text-[#1C1C1E] hover:border-gray-400"
              }`}
            >
              Past
            </button>
          </div>
        </div>

        {/* Bookings List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-[#1C1C1E]/50 font-light">Loading bookings...</div>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="text-center py-12 sm:py-16">
            <div className="text-5xl sm:text-6xl mb-4 sm:mb-6">📅</div>
            <h2 className="text-2xl sm:text-3xl font-light text-[#1C1C1E] mb-2">
              {selectedFilter === "all" ? "No bookings yet" : `No ${selectedFilter} bookings`}
            </h2>
            <p className="text-[#1C1C1E]/70 font-light mb-6">
              {selectedFilter === "all"
                ? "Start exploring and book your first stay!"
                : `You don't have any ${selectedFilter} bookings.`}
            </p>
            <Link
              to="/"
              className="inline-block bg-[#0071E3] text-white px-6 sm:px-8 py-3 sm:py-4 rounded-2xl text-sm sm:text-base font-light hover:bg-[#0051D0] transition-all shadow-md hover:shadow-lg"
            >
              Browse Listings
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredBookings.map((booking) => (
              <Link
                key={booking.id}
                to={`/listing/${booking.listingId}`}
                className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100"
              >
                {/* Image */}
                <div className="relative w-full h-48 sm:h-56 overflow-hidden bg-gray-100">
                  {booking.listingImageUrl ? (
                    <img
                      src={booking.listingImageUrl}
                      alt={booking.listingTitle}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">
                      🏠
                    </div>
                  )}
                  {/* Status Badge */}
                  <div className="absolute top-3 right-3">
                    <span
                      className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-light capitalize ${getStatusBadge(
                        booking.status
                      )}`}
                    >
                      {booking.status}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 sm:p-5">
                  <h3 className="text-base sm:text-lg font-light text-[#1C1C1E] mb-2 line-clamp-2 group-hover:text-[#0071E3] transition-colors">
                    {booking.listingTitle}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#1C1C1E]/70 font-light mb-3">
                    {booking.listingLocation}
                  </p>

                  {/* Dates */}
                  <div className="space-y-1 mb-3">
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-[#1C1C1E]/70 font-light">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>
                        {new Date(booking.checkIn).toLocaleDateString()} - {new Date(booking.checkOut).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-[#1C1C1E]/70 font-light">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span>{booking.guests} {booking.guests === 1 ? "guest" : "guests"}</span>
                    </div>
                  </div>

                  {/* Price and Actions */}
                  <div className="pt-3 border-t border-gray-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-lg sm:text-xl font-light text-[#1C1C1E]">
                          ${booking.totalPrice.toFixed(2)}
                        </span>
                        <span className="text-xs sm:text-sm text-[#1C1C1E]/70 font-light ml-1">
                          total
                        </span>
                      </div>
                      <div className="text-xs sm:text-sm text-[#1C1C1E]/70 font-light">
                        {booking.nights} {booking.nights === 1 ? "night" : "nights"}
                      </div>
                    </div>
                    
                    {/* Wishlist Button - Only show for past bookings without wishlist */}
                    {isCheckoutPassed(booking.checkOut) && 
                     (booking.status === "confirmed" || booking.status === "completed") &&
                     !existingWishlists[booking.id] && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleOpenWishlistModal(booking);
                        }}
                        className="w-full px-4 py-2 bg-[#0071E3] text-white rounded-xl text-sm font-medium hover:bg-[#0051D0] transition-all flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        <span>Create Wishlist Request</span>
                      </button>
                    )}

                    {/* Show if wishlist already exists */}
                    {existingWishlists[booking.id] && (
                      <div className="w-full px-4 py-2 bg-green-50 text-green-700 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Wishlist Submitted</span>
                      </div>
                    )}
                    
                    {/* Payment Status & Actions */}
                    {booking.status === "pending" && booking.paymentStatus !== "paid" && (
                      <div className="mb-3">
                        {payingBookingId === booking.id ? (
                          <div className="bg-white border border-gray-200 rounded-lg p-3">
                            <p className="text-xs text-[#1C1C1E]/70 font-light mb-2 text-center">
                              Complete payment
                            </p>
                            {paymentProcessing ? (
                              <div className="flex items-center justify-center py-2">
                                <div className="w-4 h-4 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin"></div>
                                <span className="ml-2 text-xs text-[#1C1C1E] font-light">Processing...</span>
                              </div>
                            ) : (
                              <PayPalScriptProvider
                                options={{
                                  clientId: PAYPAL_CLIENT_ID,
                                  currency: "USD",
                                  intent: "capture",
                                  components: "buttons",
                                  enableFunding: "paypal",
                                }}
                              >
                                <PayPalButtons
                                  style={{ layout: "vertical" }}
                                  createOrder={(data, actions) => {
                                    return actions.order.create({
                                      purchase_units: [
                                        {
                                          description: booking.listingTitle,
                                          amount: {
                                            currency_code: "USD",
                                            value: booking.totalPrice.toFixed(2),
                                          },
                                        },
                                      ],
                                    });
                                  }}
                                  onApprove={async (data, actions) => {
                                    try {
                                      setPaymentProcessing(true);
                                      
                                      // Capture the payment - this actually charges the account
                                      const details = await actions.order.capture();
                                      console.log("✅ Payment Success:", details);
                                      
                                      // Verify payment was actually captured successfully
                                      if (details.status !== "COMPLETED") {
                                        throw new Error(`Payment not completed. Status: ${details.status}`);
                                      }

                                      // Verify capture exists
                                      const capture = details.purchase_units?.[0]?.payments?.captures?.[0];
                                      if (!capture || capture.status !== "COMPLETED") {
                                        throw new Error("Payment capture failed or incomplete");
                                      }

                                      console.log("✅ Payment captured successfully:", {
                                        captureId: capture.id,
                                        status: capture.status,
                                        amount: capture.amount
                                      });
                                      
                                      // Update booking in Firestore ONLY after payment is confirmed
                                      await updateDoc(doc(db, "bookings", booking.id), {
                                        paymentStatus: "paid",
                                        status: "confirmed",
                                        paymentId: capture.id,
                                        paypalOrderId: data.orderID,
                                        paymentMethod: "paypal",
                                        paymentCompletedAt: new Date().toISOString(),
                                      });
                                      console.log("✅ Booking updated successfully!");
                                      
                                      // Refresh bookings
                                      fetchBookings();
                                      setPayingBookingId(null);
                                      setPaymentProcessing(false);
                                      alert("Payment successful! Your booking has been confirmed.");
                                    } catch (error) {
                                      console.error("❌ Error processing payment:", error);
                                      setPaymentProcessing(false);
                                      alert(`Payment failed: ${error.message}. Please try again.`);
                                    }
                                  }}
                                  onCancel={() => {
                                    console.log("Payment cancelled");
                                    setPayingBookingId(null);
                                    setPaymentProcessing(false);
                                  }}
                                  onError={(err) => {
                                    console.error("❌ PayPal error:", err);
                                    setPayingBookingId(null);
                                    setPaymentProcessing(false);
                                    alert("Payment error. Please try again.");
                                  }}
                                />
                              </PayPalScriptProvider>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPayingBookingId(booking.id);
                            }}
                            className="w-full px-3 py-1.5 bg-[#34C759] text-white rounded-lg text-xs sm:text-sm font-light hover:bg-[#2FAE4A] transition-colors mb-2"
                          >
                            Pay Now
                          </button>
                        )}
                      </div>
                    )}

                    {/* Cancel Booking Button - Only for confirmed/upcoming bookings */}
                    {booking.status === "confirmed" && 
                     !isCheckoutPassed(booking.checkIn) && 
                     booking.status !== "cancelled" && (
                      <>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleCancelBooking(booking);
                          }}
                          disabled={cancellingBookingId === booking.id}
                          className="w-full px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {cancellingBookingId === booking.id ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              <span>Cancelling...</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              <span>Cancel Booking</span>
                            </>
                          )}
                        </button>

                        {/* Refund Information */}
                        <div className="text-xs text-[#8E8E93] font-light text-center px-3 py-2 bg-gray-50 rounded-lg">
                          {(() => {
                            const timeRemaining = getRefundTimeRemaining(booking.createdAt);
                            const isEligible = isWithin24HoursOfBooking(booking.createdAt);
                            
                            if (isEligible && timeRemaining) {
                              return (
                                <div className="space-y-1">
                                  <div>
                                    <span className="text-green-600 font-medium">70% refund available</span>
                                    <span className="text-[#8E8E93]"> (${calculateRefund(booking).toFixed(2)})</span>
                                  </div>
                                  <div className="text-[#8E8E93]">
                                    {timeRemaining.hours > 0 && `${timeRemaining.hours}h `}
                                    {timeRemaining.minutes > 0 && `${timeRemaining.minutes}m `}
                                    remaining
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div>
                                  <span className="text-red-600 font-medium">No refund available</span>
                                  <span className="text-[#8E8E93]"> (24hr window expired)</span>
                                </div>
                              );
                            }
                          })()}
                        </div>
                      </>
                    )}
                    
                    {/* Chat Button */}
                    {booking.status !== "cancelled" && (
                      <Link
                        to={`/chat/${booking.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="relative block w-full text-center px-3 py-1.5 bg-[#0071E3] text-white rounded-lg text-xs sm:text-sm font-light hover:bg-[#0051D0] transition-colors"
                      >
                        Chat
                        {(unreadCounts[booking.id] || 0) > 0 && (
                          <span className="absolute -top-1 -right-1 bg-[#FF3B30] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                            {(unreadCounts[booking.id] || 0) > 9 ? '9+' : unreadCounts[booking.id]}
                          </span>
                        )}
                      </Link>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-[#1C1C1E] text-white px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center text-xs sm:text-sm font-light mt-12 sm:mt-16">
        <div>© 2025 Voyago</div>
        <div>Privacy & Terms        </div>
      </div>

      {/* Wishlist Creation Modal */}
      {showWishlistModal && selectedBookingForWishlist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl sm:text-2xl font-light text-[#1C1C1E]">Create Improvement Request</h3>
                <button
                  onClick={() => {
                    setShowWishlistModal(false);
                    setSelectedBookingForWishlist(null);
                    setWishlistTitle("");
                    setWishlistDescription("");
                    setWishlistCategory("accommodation");
                  }}
                  className="p-2 text-[#8E8E93] hover:text-[#1C1C1E] hover:bg-gray-100 rounded-lg transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-[#8E8E93] font-light mt-2">
                {selectedBookingForWishlist.listingTitle} - {new Date(selectedBookingForWishlist.checkIn).toLocaleDateString()} to {new Date(selectedBookingForWishlist.checkOut).toLocaleDateString()}
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-[#1C1C1E] mb-2">
                  Category *
                </label>
                <select
                  value={wishlistCategory}
                  onChange={(e) => setWishlistCategory(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3]"
                >
                  <option value="accommodation">Accommodation</option>
                  <option value="amenities">Amenities</option>
                  <option value="activities">Activities</option>
                  <option value="services">Services</option>
                  <option value="location">Location</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-[#1C1C1E] mb-2">
                  Request Title *
                </label>
                <input
                  type="text"
                  value={wishlistTitle}
                  onChange={(e) => setWishlistTitle(e.target.value)}
                  placeholder="e.g., Add WiFi, Improve parking, etc."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-[#1C1C1E] mb-2">
                  Description *
                </label>
                <textarea
                  value={wishlistDescription}
                  onChange={(e) => setWishlistDescription(e.target.value)}
                  placeholder="Describe your improvement suggestion in detail..."
                  rows={5}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] resize-none"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowWishlistModal(false);
                  setSelectedBookingForWishlist(null);
                  setWishlistTitle("");
                  setWishlistDescription("");
                  setWishlistCategory("accommodation");
                }}
                className="px-6 py-2 bg-gray-100 text-[#1C1C1E] rounded-xl text-sm font-medium hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitWishlist}
                disabled={isSubmittingWishlist}
                className="px-6 py-2 bg-[#0071E3] text-white rounded-xl text-sm font-medium hover:bg-[#0051D0] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingWishlist ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuestDashboard;

