import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { collection, query, where, getDocs, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { PAYPAL_CLIENT_ID } from "../../config/paypal";
import Header from "../../components/Header";

const GuestDashboard = () => {
  const { currentUser, userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState("all"); // all, upcoming, past, pending
  const [unreadCounts, setUnreadCounts] = useState({}); // { bookingId: count }
  const [payingBookingId, setPayingBookingId] = useState(null); // Track which booking is being paid
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  useEffect(() => {
    // Wait for auth to finish loading before checking
    if (authLoading) {
      return;
    }

    if (!currentUser) {
      navigate("/login");
      return;
    }

    if (userRole !== "guest") {
      navigate("/");
      return;
    }

    fetchBookings();
  }, [currentUser, userRole, authLoading, navigate]);

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
                    
                    {/* Chat Button */}
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
        <div>Privacy & Terms</div>
      </div>
    </div>
  );
};

export default GuestDashboard;

