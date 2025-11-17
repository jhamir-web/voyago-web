import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { doc, getDoc, collection, addDoc, query, where, getDocs, updateDoc, deleteDoc, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { PAYPAL_CLIENT_ID } from "../../config/paypal";
import { GoogleMap, LoadScript, Marker } from "@react-google-maps/api";
import { GOOGLE_MAPS_API_KEY } from "../../config/googlemaps";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase";
import Header from "../../components/Header";

const ListingDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, userRole } = useAuth();

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(1);
  const [bookingError, setBookingError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingId, setBookingId] = useState(null);
  const [totalPrice, setTotalPrice] = useState(0);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [bookedDates, setBookedDates] = useState([]);
  const [blockedDates, setBlockedDates] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteId, setFavoriteId] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [averageRating, setAverageRating] = useState(0);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [showFullscreenImage, setShowFullscreenImage] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("paypal"); // "paypal" or "wallet"
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletLoading, setWalletLoading] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [showPromo, setShowPromo] = useState(false);
  const [hostPhotoUrl, setHostPhotoUrl] = useState(null);
  const [reviewerPhotos, setReviewerPhotos] = useState({}); // userId -> photoUrl mapping
  
  // Use all uploaded images (imageUrls array if available, otherwise fall back to imageUrl)
  const listingImages = useMemo(() => {
    if (!listing) return [];
    
    // If imageUrls array exists and has items, use it
    if (listing.imageUrls && Array.isArray(listing.imageUrls) && listing.imageUrls.length > 0) {
      return listing.imageUrls.filter(url => url && url.trim() !== "");
    }
    
    // Otherwise, fall back to single imageUrl for backward compatibility
    if (listing.imageUrl && listing.imageUrl.trim() !== "") {
      return [listing.imageUrl];
    }
    
    return [];
  }, [listing]);

  // Fetch listing data
  useEffect(() => {
    const fetchListing = async () => {
      try {
        const listingRef = doc(db, "listings", id);
        const listingSnap = await getDoc(listingRef);

        if (listingSnap.exists()) {
          setListing({ id: listingSnap.id, ...listingSnap.data() });
        } else {
          console.error("Listing not found!");
        }
      } catch (error) {
        console.error("Error fetching listing:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchListing();
  }, [id]);

  // Fetch wallet balance
  useEffect(() => {
    const fetchWalletBalance = async () => {
      if (!currentUser) {
        setWalletBalance(0);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          setWalletBalance(userDoc.data().walletBalance || 0);
        }
      } catch (error) {
        console.error("Error fetching wallet balance:", error);
      }
    };

    fetchWalletBalance();
  }, [currentUser]);

  // Fetch booked dates for calendar
  useEffect(() => {
    const fetchBookedDates = async () => {
      if (!id) return;
      try {
        const confirmedQuery = query(
          collection(db, "bookings"),
          where("listingId", "==", id),
          where("status", "==", "confirmed")
        );
        const snapshot = await getDocs(confirmedQuery);
        const dates = [];
        snapshot.forEach((doc) => {
          const booking = doc.data();
          let checkInDate = new Date(booking.checkIn);
          let checkOutDate = new Date(booking.checkOut);
          
          // Normalize to local midnight to avoid timezone issues
          checkInDate.setHours(0, 0, 0, 0);
          checkOutDate.setHours(0, 0, 0, 0);
          
          // Add all dates from check-in to check-out (inclusive of both)
          // For a booking from Nov 21 to Nov 22, both dates should be marked as booked
          const currentDate = new Date(checkInDate);
          while (currentDate <= checkOutDate) {
            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(currentDate.getDate()).padStart(2, '0');
            dates.push(`${year}-${month}-${day}`);
            
            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
          }
        });
        setBookedDates(dates);
      } catch (error) {
        console.error("Error fetching booked dates:", error);
      }
    };
    fetchBookedDates();
  }, [id]);

  // Fetch blocked dates and host photo from host's user document
  useEffect(() => {
    const fetchHostData = async () => {
      if (!listing?.hostId) return;
      try {
        const hostDoc = await getDoc(doc(db, "users", listing.hostId));
        if (hostDoc.exists()) {
          const hostData = hostDoc.data();
          if (hostData.blockedDates && Array.isArray(hostData.blockedDates)) {
            setBlockedDates(hostData.blockedDates);
          } else {
            setBlockedDates([]);
          }
          // Fetch host photo
          if (hostData.profilePhotoUrl || hostData.photoURL) {
            setHostPhotoUrl(hostData.profilePhotoUrl || hostData.photoURL);
          } else {
            setHostPhotoUrl(null);
          }
        }
      } catch (error) {
        console.error("Error fetching host data:", error);
        setBlockedDates([]);
        setHostPhotoUrl(null);
      }
    };
    fetchHostData();
  }, [listing?.hostId]);

  // Fetch reviewer photos
  useEffect(() => {
    const fetchReviewerPhotos = async () => {
      if (!reviews || reviews.length === 0) {
        setReviewerPhotos({});
        return;
      }

      const photoMap = {};
      const promises = reviews.map(async (review) => {
        if (!review.userId) return;
        try {
          const userDoc = await getDoc(doc(db, "users", review.userId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const photoUrl = userData.profilePhotoUrl || userData.photoURL;
            if (photoUrl) {
              photoMap[review.userId] = photoUrl;
            }
          }
        } catch (error) {
          console.error(`Error fetching photo for user ${review.userId}:`, error);
        }
      });

      await Promise.all(promises);
      setReviewerPhotos(photoMap);
    };

    fetchReviewerPhotos();
  }, [reviews]);

  // Fetch favorites status
  useEffect(() => {
    const checkFavorite = async () => {
      if (!currentUser || !id) {
        setIsFavorite(false);
        return;
      }
      try {
        const favoritesQuery = query(
          collection(db, "favorites"),
          where("userId", "==", currentUser.uid),
          where("listingId", "==", id)
        );
        const snapshot = await getDocs(favoritesQuery);
        if (!snapshot.empty) {
          setIsFavorite(true);
          setFavoriteId(snapshot.docs[0].id);
        } else {
          setIsFavorite(false);
          setFavoriteId(null);
        }
      } catch (error) {
        console.error("Error checking favorite:", error);
      }
    };
    checkFavorite();
  }, [currentUser, id]);

  // Fetch reviews and calculate average rating
  useEffect(() => {
    if (!id) return;
    const reviewsQuery = query(
      collection(db, "reviews"),
      where("listingId", "==", id),
      where("status", "==", "approved")
    );
    
    const unsubscribe = onSnapshot(reviewsQuery, (snapshot) => {
      const reviewsData = [];
      let totalRating = 0;
      snapshot.forEach((doc) => {
        const review = { id: doc.id, ...doc.data() };
        reviewsData.push(review);
        totalRating += review.rating || 0;
      });
      // Sort reviews by date (newest first)
      reviewsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setReviews(reviewsData);
      setAverageRating(reviewsData.length > 0 ? totalRating / reviewsData.length : 0);
    }, (error) => {
      console.error("Error fetching reviews:", error);
    });

    return () => unsubscribe();
  }, [id]);

  const handleToggleFavorite = async () => {
    if (!currentUser) {
      setShowSignInModal(true);
      return;
    }

    try {
      if (isFavorite && favoriteId) {
        // Remove from favorites
        await deleteDoc(doc(db, "favorites", favoriteId));
        setIsFavorite(false);
        setFavoriteId(null);
      } else {
        // Check if already favorited (in case of race condition)
        const existingQuery = query(
          collection(db, "favorites"),
          where("userId", "==", currentUser.uid),
          where("listingId", "==", id)
        );
        const existingSnapshot = await getDocs(existingQuery);
        
        if (!existingSnapshot.empty) {
          // Already favorited, just update state
          setIsFavorite(true);
          setFavoriteId(existingSnapshot.docs[0].id);
        } else {
          // Add to favorites
          const favoriteData = {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            listingId: id,
            listingTitle: listing?.title,
            listingImageUrl: listing?.imageUrl,
            createdAt: new Date().toISOString(),
          };
          const docRef = await addDoc(collection(db, "favorites"), favoriteData);
          setIsFavorite(true);
          setFavoriteId(docRef.id);
        }
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
      console.error("Error details:", error.code, error.message);
      // More specific error message
      if (error.code === 'permission-denied') {
        alert("Permission denied. Please check Firestore security rules.");
      } else if (error.code === 'failed-precondition') {
        alert("Please create a Firestore index for favorites collection. Check the console for the index link.");
      } else {
        alert(`Failed to update favorite: ${error.message || "Please try again."}`);
      }
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      setShowSignInModal(true);
      return;
    }

    if (!reviewComment.trim()) {
      alert("Please enter a review comment.");
      return;
    }

    setSubmittingReview(true);
    try {
      // Check if user has already reviewed this listing
      const existingReviewQuery = query(
        collection(db, "reviews"),
        where("listingId", "==", id),
        where("userId", "==", currentUser.uid)
      );
      const existingSnapshot = await getDocs(existingReviewQuery);
      
      if (!existingSnapshot.empty) {
        alert("You have already reviewed this listing.");
        setSubmittingReview(false);
        return;
      }

      // Check if user has a confirmed booking for this listing
      const bookingQuery = query(
        collection(db, "bookings"),
        where("listingId", "==", id),
        where("guestId", "==", currentUser.uid),
        where("status", "==", "confirmed")
      );
      const bookingSnapshot = await getDocs(bookingQuery);
      
      if (bookingSnapshot.empty) {
        alert("You can only review listings you have booked and stayed at.");
        setSubmittingReview(false);
        return;
      }

      const reviewData = {
        listingId: id,
        listingTitle: listing?.title,
        userId: currentUser.uid,
        userEmail: currentUser.email,
        userName: currentUser.displayName || currentUser.email?.split('@')[0],
        rating: reviewRating,
        comment: reviewComment.trim(),
        status: "approved", // Auto-approve for now, can add moderation later
        createdAt: new Date().toISOString(),
      };

      const reviewRef = await addDoc(collection(db, "reviews"), reviewData);
      
      // Award points for review
      try {
        const { awardPoints } = await import("../../utils/points");
        await awardPoints(currentUser.uid, 50, "review", reviewRef.id);
        console.log("✅ Points awarded for review");
      } catch (pointsError) {
        console.error("Error awarding points:", pointsError);
        // Don't fail the review if points fail
      }
      
      // Reset form
      setReviewRating(5);
      setReviewComment("");
      setShowReviewModal(false);
      alert("Thank you for your review!");
    } catch (error) {
      console.error("Error submitting review:", error);
      alert("Failed to submit review. Please try again.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Share functionality
  const getListingUrl = () => {
    return `${window.location.origin}/listing/${id}`;
  };

  const getShareText = () => {
    return listing ? `Check out ${listing.title} on Voyago! ${listing.location}` : 'Check out this amazing place on Voyago!';
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getListingUrl());
      alert("Link copied to clipboard!");
      setShowShareMenu(false);
    } catch (error) {
      console.error("Failed to copy link:", error);
      alert("Failed to copy link. Please try again.");
    }
  };

  const handleShareFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getListingUrl())}`;
    window.open(url, '_blank', 'width=600,height=400');
    setShowShareMenu(false);
  };

  const handleShareEmail = () => {
    const subject = encodeURIComponent(`Check out ${listing?.title || 'this amazing place'} on Voyago!`);
    const body = encodeURIComponent(`${getShareText()}\n\n${getListingUrl()}`);
    const url = `mailto:?subject=${subject}&body=${body}`;
    window.location.href = url;
    setShowShareMenu(false);
  };

  // Calculate total price when dates or guests change
  useEffect(() => {
    if (checkIn && checkOut && listing) {
      // Parse dates as local dates (not UTC) to avoid timezone issues
      const checkInDate = new Date(checkIn + 'T00:00:00');
      const checkOutDate = new Date(checkOut + 'T00:00:00');
      
      // Calculate nights
      const timeDiff = checkOutDate.getTime() - checkInDate.getTime();
      const nights = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      
      // Only calculate price if check-out is after check-in (at least 1 night)
      if (nights > 0 && checkOutDate > checkInDate) {
        const pricePerNight = parseFloat(listing.price) || 0;
        const subtotal = pricePerNight * nights;
        
        // Apply discount if coupon is applied
        const discount = discountAmount || 0;
        const total = Math.max(0, subtotal - discount);
        setTotalPrice(total);
      } else {
        setTotalPrice(0);
      }
    } else {
      setTotalPrice(0);
    }
  }, [checkIn, checkOut, listing, discountAmount]);

  // Apply promo/coupon code
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError("Please enter a promo or coupon code");
      return;
    }

    if (!checkIn || !checkOut || !listing) {
      setCouponError("Please select check-in and check-out dates first");
      return;
    }

    try {
      setCouponError("");
      const codeToCheck = couponCode.toUpperCase().trim();

      // First, check if it's the listing's promo code
      if (listing.promoCode && listing.promoCode.toUpperCase() === codeToCheck) {
        // Validate promo code usage limits
        if (listing.maxUses && listing.maxUses > 0) {
          // Check how many times this promo code has been used
          const promoUsageQuery = query(
            collection(db, "bookings"),
            where("listingId", "==", id),
            where("couponCode", "==", codeToCheck)
          );
          const usageSnapshot = await getDocs(promoUsageQuery);
          
          if (usageSnapshot.size >= listing.maxUses) {
            setCouponError("This promo code has reached its maximum usage limit");
            setAppliedCoupon(null);
            setDiscountAmount(0);
            return;
          }
        }

        // Calculate discount using listing's promo discount
        const checkInDate = new Date(checkIn + 'T00:00:00');
        const checkOutDate = new Date(checkOut + 'T00:00:00');
        const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
        const pricePerNight = parseFloat(listing.price) || 0;
        const subtotal = pricePerNight * nights;
        const discountPercent = parseFloat(listing.discount) || 0;
        const discount = (subtotal * discountPercent) / 100;

        // Create a coupon-like object for consistency
        const promoCoupon = {
          id: "listing-promo",
          code: listing.promoCode,
          title: listing.promoDescription || "Promo Code",
          discountPercentage: discountPercent,
          type: "promo"
        };

        setAppliedCoupon(promoCoupon);
        setDiscountAmount(discount);
        setCouponError("");
        return;
      }

      // If not listing promo code, check coupons collection
      const couponsQuery = query(
        collection(db, "coupons"),
        where("code", "==", codeToCheck)
      );
      const snapshot = await getDocs(couponsQuery);

      if (snapshot.empty) {
        setCouponError("Invalid promo or coupon code");
        setAppliedCoupon(null);
        setDiscountAmount(0);
        return;
      }

      const coupon = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };

      // Check if coupon is active
      if (coupon.active === false) {
        setCouponError("This coupon is no longer active");
        setAppliedCoupon(null);
        setDiscountAmount(0);
        return;
      }

      // Check if coupon is for this host
      if (coupon.hostId !== listing.hostId) {
        setCouponError("This coupon is not valid for this listing");
        setAppliedCoupon(null);
        setDiscountAmount(0);
        return;
      }

      // Check validity dates
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const startDate = coupon.startDate ? new Date(coupon.startDate) : null;
      const endDate = coupon.endDate ? new Date(coupon.endDate) : null;
      
      if (startDate) startDate.setHours(0, 0, 0, 0);
      if (endDate) endDate.setHours(23, 59, 59, 999);

      if (startDate && today < startDate) {
        setCouponError(`This coupon is not valid yet. Valid from ${startDate.toLocaleDateString()}`);
        setAppliedCoupon(null);
        setDiscountAmount(0);
        return;
      }

      if (endDate && today > endDate) {
        setCouponError("This coupon has expired");
        setAppliedCoupon(null);
        setDiscountAmount(0);
        return;
      }

      // Calculate discount
      const checkInDate = new Date(checkIn + 'T00:00:00');
      const checkOutDate = new Date(checkOut + 'T00:00:00');
      const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
      const pricePerNight = parseFloat(listing.price) || 0;
      const subtotal = pricePerNight * nights;
      const discountPercent = parseFloat(coupon.discountPercentage) || 0;
      const discount = (subtotal * discountPercent) / 100;

      setAppliedCoupon(coupon);
      setDiscountAmount(discount);
      setCouponError("");
    } catch (error) {
      console.error("Error applying coupon:", error);
      setCouponError("Failed to apply promo/coupon code. Please try again.");
      setAppliedCoupon(null);
      setDiscountAmount(0);
    }
  };

  // Remove coupon
  const handleRemoveCoupon = () => {
    setCouponCode("");
    setAppliedCoupon(null);
    setDiscountAmount(0);
    setCouponError("");
  };

  // Validate booking dates and check for conflicts
  const validateBooking = async () => {
    // Check if user is trying to book their own listing
    if (currentUser && listing && listing.hostId === currentUser.uid) {
      return { valid: false, error: "You cannot book your own listing. Please select a different property." };
    }

    if (!checkIn || !checkOut) {
      return { valid: false, error: "Please select both check-in and check-out dates." };
    }

    const checkInDate = new Date(checkIn + 'T00:00:00');
    const checkOutDate = new Date(checkOut + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkInDate < today) {
      return { valid: false, error: "Check-in date cannot be in the past." };
    }

    if (checkOutDate <= checkInDate) {
      return { valid: false, error: "Check-out date must be after check-in date." };
    }

    if (!guests || guests < 1) {
      return { valid: false, error: "Please enter a valid number of guests." };
    }

    if (listing.maxGuests && guests > listing.maxGuests) {
      return { valid: false, error: `Maximum ${listing.maxGuests} guests allowed.` };
    }

    try {
      // Check for date conflicts
      const confirmedQuery = query(
        collection(db, "bookings"),
        where("listingId", "==", id),
        where("status", "==", "confirmed")
      );

      const confirmedSnapshot = await getDocs(confirmedQuery);

      let hasConflict = false;
      let conflictInfo = "";

      // Check confirmed bookings
      confirmedSnapshot.forEach((doc) => {
        const booking = doc.data();
        const existingCheckIn = new Date(booking.checkIn);
        const existingCheckOut = new Date(booking.checkOut);

        if (checkInDate < existingCheckOut && checkOutDate > existingCheckIn) {
          hasConflict = true;
          conflictInfo = `Confirmed booking: ${existingCheckIn.toLocaleDateString()} - ${existingCheckOut.toLocaleDateString()}`;
        }
      });

      if (hasConflict) {
        return { valid: false, error: `❌ These dates are already booked:\n${conflictInfo}\n\nPlease select different dates.` };
      }

      // Check for blocked dates
      const currentCheckDate = new Date(checkInDate);
      const blockedDatesInRange = [];
      
      while (currentCheckDate <= checkOutDate) {
        const year = currentCheckDate.getFullYear();
        const month = String(currentCheckDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentCheckDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        if (blockedDates.includes(dateStr)) {
          blockedDatesInRange.push(dateStr);
        }
        
        currentCheckDate.setDate(currentCheckDate.getDate() + 1);
      }
      
      if (blockedDatesInRange.length > 0) {
        return { valid: false, error: `❌ Some selected dates are blocked by the host.\n\nPlease select different dates.` };
      }

      return { valid: true };
    } catch (error) {
      console.error("Error checking conflicts:", error);
      return { valid: false, error: "❌ Unable to check for date conflicts. Please try again." };
    }
  };

  // Handle wallet payment
  const handleWalletPayment = async () => {
    if (!currentUser) {
      setShowSignInModal(true);
      return;
    }

    const validation = await validateBooking();
    if (!validation.valid) {
      setBookingError(validation.error);
      return;
    }

    // Price is in USD, wallet balance is also in USD
    if (walletBalance < totalPrice) {
      const insufficient = totalPrice - walletBalance;
      alert(`Insufficient wallet balance. You need $${insufficient.toFixed(2)} more. Please cash in to your wallet first.`);
      return;
    }

    setPaymentProcessing(true);
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        throw new Error("User not found");
      }

      const currentBalance = userDoc.data().walletBalance || 0;
      const transactions = userDoc.data().transactions || [];

      if (currentBalance < totalPrice) {
        throw new Error("Insufficient wallet balance");
      }

      // Create booking with wallet payment first to get booking ID
      const bookingId = await createBookingAfterPayment({
        paymentMethod: "wallet",
        amount: totalPrice,
        currency: "USD",
        transactionId: `wallet_${Date.now()}`,
      });

      // Create transaction record with booking ID
      const transaction = {
        type: "booking_payment",
        amount: -totalPrice,
        bookingId: bookingId,
        date: new Date().toISOString(),
        status: "completed"
      };

      // Deduct from wallet and add transaction
      await updateDoc(userRef, {
        walletBalance: currentBalance - totalPrice,
        transactions: [transaction, ...transactions].slice(0, 10)
      });

      // Refresh wallet balance
      const updatedUserDoc = await getDoc(userRef);
      if (updatedUserDoc.exists()) {
        setWalletBalance(updatedUserDoc.data().walletBalance || 0);
      }

      setPaymentSuccess(true);
      setPaymentProcessing(false);
    } catch (error) {
      console.error("Error processing wallet payment:", error);
      setPaymentProcessing(false);
      alert(`Payment failed: ${error.message}. Please try again.`);
    }
  };

  // Create booking ONLY after payment is successful
  const createBookingAfterPayment = async (paymentDetails) => {
    const validation = await validateBooking();
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const checkInDate = new Date(checkIn + 'T00:00:00');
    const checkOutDate = new Date(checkOut + 'T00:00:00');

    // Create booking with payment information
    // Status is "pending" - host needs to approve
    const bookingData = {
      listingId: id,
      listingTitle: listing.title,
      listingLocation: listing.location,
      listingImageUrl: listing.imageUrl,
      hostId: listing.hostId,
      hostEmail: listing.hostEmail,
      guestId: currentUser.uid,
      guestEmail: currentUser.email,
      guestName: currentUser.displayName || currentUser.email?.split('@')[0] || "Guest",
      checkIn: checkInDate.toISOString(),
      checkOut: checkOutDate.toISOString(),
      guests: parseInt(guests),
      pricePerNight: listing.price,
      totalPrice: totalPrice,
      subtotal: parseFloat(listing.price) * Math.ceil((new Date(checkOut + 'T00:00:00').getTime() - new Date(checkIn + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24)),
      discountAmount: discountAmount || 0,
      couponCode: appliedCoupon?.code || null,
      couponId: appliedCoupon?.id || null,
      status: "pending", // Host needs to approve
      paymentStatus: "paid",
      paymentMethod: paymentDetails.paymentMethod || "paypal",
      paymentId: paymentDetails.transactionId,
      paypalOrderId: paymentDetails.paypalOrderId || null,
      createdAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, "bookings"), bookingData);
    setBookingId(docRef.id);
    console.log("✅ Booking created:", docRef.id);
    
    // Award points for booking
    try {
      const { awardPoints } = await import("../../utils/points");
      await awardPoints(currentUser.uid, 110, "booking", docRef.id);
      console.log("✅ Points awarded for booking");
    } catch (pointsError) {
      console.error("Error awarding points:", pointsError);
      // Don't fail the booking if points fail
    }
    
    return docRef.id;
  };

  const handleBooking = async (e) => {
    e.preventDefault();
    setBookingError("");

    // Check if user is logged in
    if (!currentUser) {
      setShowSignInModal(true);
      return;
    }

    // Validate booking details
    const validation = await validateBooking();
    if (!validation.valid) {
      setBookingError(validation.error);
      return;
    }

    // If validation passes, show payment UI
    setBookingSuccess(true);
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="text-[#1C1C1E] font-light">Loading listing details...</div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-light text-[#1C1C1E] mb-4">Listing not found</h1>
          <Link to="/" className="text-[#0071E3] hover:underline">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  // Determine listing type
  const isPlace = listing?.category === "place" || listing?.subcategory || listing?.placeType;
  const isExperience = listing?.category === "experience" || listing?.activityType;
  const isService = listing?.category === "service" || listing?.serviceType;

  const nights = checkIn && checkOut 
    ? Math.ceil((new Date(checkOut + 'T00:00:00') - new Date(checkIn + 'T00:00:00')) / (1000 * 60 * 60 * 24))
    : 0;

  // Helper function to format date as YYYY-MM-DD in local timezone
  const formatDateLocal = (date) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Calendar helper functions
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    return days;
  };

  const getDateStatus = (date) => {
    if (!date) return null;
    const dateStr = formatDateLocal(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (date < today) return 'past';
    if (bookedDates.includes(dateStr)) return 'booked';
    if (blockedDates.includes(dateStr)) return 'blocked';
    if (checkIn && dateStr === checkIn) return 'checkin';
    if (checkOut && dateStr === checkOut) return 'checkout';
    return 'available';
  };

  const formatMonthYear = (date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const navigateMonth = (direction) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  // Get host name from email (for display)
  const hostName = listing?.hostEmail ? listing.hostEmail.split('@')[0] : 'Host';
  const hostInitials = hostName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'H';

  // Google Maps center - use stored coordinates or default to Manila
  const mapCenter = listing?.latitude && listing?.longitude
    ? { lat: listing.latitude, lng: listing.longitude }
    : { lat: 14.5995, lng: 120.9842 }; // Manila coordinates as default

  // Get Directions URL - use coordinates if available, otherwise use location string
  const getDirectionsUrl = () => {
    if (listing?.latitude && listing?.longitude) {
      // Use coordinates for precise navigation
      return `https://www.google.com/maps/dir/?api=1&destination=${listing.latitude},${listing.longitude}`;
    } else if (listing?.location) {
      // Fall back to location string
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.location)}`;
    }
    return "#";
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      {/* Category Filters */}
      {listing && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 pb-6">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Category Badge - Home, Experience, or Service */}
            {(listing.placeType || listing.category === "place" || listing.category === "resort" || listing.category === "hotel" || listing.category === "transient" || (!listing.activityType && !listing.serviceType && listing.category)) && (
              <span className="px-4 py-2 rounded-full bg-[#F5F5F7] hover:bg-gray-200 transition-colors flex items-center gap-2 text-sm font-medium text-[#1C1C1E]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                {listing.activityType || listing.category === "experience" ? "Experience" : listing.serviceType || listing.category === "service" ? "Service" : "Home"}
              </span>
            )}
            
            {/* Room Type Badge - Entire Home, Private Room, or Shared Room */}
            {listing.describePlace && (
              <span className="px-4 py-2 rounded-full bg-[#F5F5F7] hover:bg-gray-200 transition-colors text-sm font-medium text-[#1C1C1E]">
                {listing.describePlace === "entire" ? "Entire Home" : 
                 listing.describePlace === "private" ? "Private Room" : 
                 listing.describePlace === "shared" ? "Shared Room" : 
                 listing.describePlace}
              </span>
            )}
            
            {/* Experience Type Badge */}
            {listing.activityType && (
              <span className="px-4 py-2 rounded-full bg-[#F5F5F7] hover:bg-gray-200 transition-colors text-sm font-medium text-[#1C1C1E]">
                {listing.activityType}
              </span>
            )}
            
            {/* Service Type Badge */}
            {listing.serviceType && (
              <span className="px-4 py-2 rounded-full bg-[#F5F5F7] hover:bg-gray-200 transition-colors text-sm font-medium text-[#1C1C1E]">
                {listing.serviceType}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
        {/* Title and Location */}
        <section className="mb-10 sm:mb-14">
          <div className="flex items-start justify-between gap-6 mb-4 sm:mb-5">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-light text-[#1C1C1E] tracking-tight leading-tight mb-3 sm:mb-4">
                {listing.title}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-base sm:text-lg text-[#8E8E93] font-light">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-[#1C1C1E] font-medium">{listing.location}</span>
                </div>
                <span className="text-[#D1D1D6]">•</span>
                <span>Hosted by <span className="text-[#1C1C1E] font-medium">{hostName}</span></span>
              </div>
            </div>
            {/* Favorite and Share Buttons */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {/* Share Button */}
        <div className="relative">
          <button 
            onClick={() => setShowShareMenu(!showShareMenu)}
                  className="p-3 sm:p-3.5 bg-white rounded-full hover:bg-gray-50 transition-all duration-300 shadow-md hover:shadow-lg border border-gray-200 hover:border-gray-300"
            aria-label="Share listing"
          >
                  <svg className="w-6 h-6 sm:w-7 sm:h-7 text-[#1C1C1E] transition-transform duration-300 hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>

          {/* Share Menu Dropdown */}
          {showShareMenu && (
            <>
              {/* Backdrop to close menu */}
              <div 
                      className="fixed inset-0 z-40 bg-black/20 animate-fadeIn" 
                onClick={() => setShowShareMenu(false)}
              ></div>
              
              {/* Dropdown Menu */}
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-50 animate-slideDownFadeIn origin-top-right">
                <div className="p-2">
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Share this listing
                  </div>
                  
                  {/* Copy Link */}
                  <button
                    onClick={handleCopyLink}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[#1C1C1E] hover:bg-gray-50 rounded-xl transition-all duration-200 group"
                  >
                    <svg className="w-5 h-5 text-gray-600 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                          <span className="font-medium">Copy link</span>
                  </button>

                  {/* Facebook */}
                  <button
                    onClick={handleShareFacebook}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[#1C1C1E] hover:bg-gray-50 rounded-xl transition-all duration-200 group"
                  >
                    <svg className="w-5 h-5 text-[#1877F2] transition-transform duration-200 group-hover:scale-110" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                          <span className="font-medium">Facebook</span>
                  </button>

                  {/* Email */}
                  <button
                    onClick={handleShareEmail}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[#1C1C1E] hover:bg-gray-50 rounded-xl transition-all duration-200 group"
                  >
                    <svg className="w-5 h-5 text-gray-600 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                          <span className="font-medium">Email</span>
                  </button>
                </div>
              </div>
            </>
          )}
      </div>

            {/* Favorite Button */}
            <button
              onClick={handleToggleFavorite}
                className="p-3 sm:p-3.5 bg-white rounded-full hover:bg-gray-50 transition-all duration-300 shadow-md hover:shadow-lg border border-gray-200 hover:border-gray-300"
              aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <svg
                  className={`w-6 h-6 sm:w-7 sm:h-7 transition-all duration-300 hover:scale-110 ${
                    isFavorite ? "fill-red-500 text-red-500" : "text-[#1C1C1E]"
                }`}
                fill={isFavorite ? "currentColor" : "none"}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            </button>
          </div>
          </div>
        </section>

        {/* Image Gallery */}
        <section className="mb-12 sm:mb-16">
          {listingImages.length > 0 ? (
            listingImages.length === 1 ? (
              // Single image - full width
              <div className="w-full h-[400px] sm:h-[500px] lg:h-[600px] rounded-2xl sm:rounded-3xl overflow-hidden bg-gray-100 shadow-lg">
                <img
                  src={listingImages[0]}
                  alt={listing.title}
                  className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-500"
                  onClick={() => setShowFullscreenImage(true)}
                />
              </div>
            ) : (
              // Multiple images - grid layout
              <div className="grid grid-cols-4 gap-2 sm:gap-3 h-[400px] sm:h-[500px] lg:h-[600px]">
                {/* Main Image */}
                <div className="col-span-4 sm:col-span-2 row-span-2 rounded-2xl sm:rounded-3xl overflow-hidden bg-gray-100 shadow-lg cursor-pointer group">
                  <img
                    src={listingImages[selectedImageIndex] || listingImages[0]}
                    alt={listing.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onClick={() => setShowFullscreenImage(true)}
                  />
                </div>
                {/* Thumbnail Images - Only show if there are multiple images */}
                {listingImages.slice(0, 3).map((img, index) => (
                  <div
                    key={index}
                    className={`col-span-2 sm:col-span-1 rounded-2xl sm:rounded-3xl overflow-hidden bg-gray-100 cursor-pointer transition-all duration-300 ${
                      selectedImageIndex === index ? 'ring-2 ring-[#0071E3] ring-offset-2 opacity-100' : 'opacity-75 hover:opacity-100 hover:ring-2 hover:ring-gray-300'
                    }`}
                    onClick={() => setSelectedImageIndex(index)}
                  >
                    <img
                      src={img}
                      alt={`${listing.title} ${index + 1}`}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                />
                  </div>
                ))}
              </div>
            )
              ) : (
            <div className="w-full h-[400px] sm:h-[500px] lg:h-[600px] rounded-2xl sm:rounded-3xl flex items-center justify-center text-6xl bg-gradient-to-br from-gray-50 to-gray-100 shadow-lg">
                  🏠
                </div>
              )}
        </section>

        {/* Fullscreen Image Modal */}
        {showFullscreenImage && listingImages.length > 0 && (
          <div
            className="fixed inset-0 z-50 bg-black bg-opacity-95 flex items-center justify-center p-4"
            onClick={() => setShowFullscreenImage(false)}
          >
            <button
              onClick={() => setShowFullscreenImage(false)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10"
              aria-label="Close fullscreen"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
            
            {/* Navigation Arrows - Only show if multiple images */}
            {listingImages.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImageIndex((prev) => (prev - 1 + listingImages.length) % listingImages.length);
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 transition-colors z-10 bg-black bg-opacity-50 rounded-full p-3"
                  aria-label="Previous image"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImageIndex((prev) => (prev + 1) % listingImages.length);
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 transition-colors z-10 bg-black bg-opacity-50 rounded-full p-3"
                  aria-label="Next image"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
            
            <img
              src={listingImages[selectedImageIndex] || listingImages[0]}
              alt={listing.title}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            
            {/* Image Counter - Only show if multiple images */}
            {listingImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white bg-black bg-opacity-50 rounded-full px-4 py-2 text-sm">
                {selectedImageIndex + 1} / {listingImages.length}
              </div>
            )}
            </div>
        )}

        {/* Two Column Layout */}
        <section className="mt-12 sm:mt-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-12">
          {/* Left Column - Content Sections */}
            <div className="lg:col-span-2">

            {/* About this place */}
              <section className="mb-12 sm:mb-14">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-light text-[#1C1C1E] mb-6">
                  About this place
                </h2>
                <div className="prose prose-lg max-w-none">
                  <p className="text-base sm:text-lg text-[#1C1C1E] font-light leading-relaxed whitespace-pre-line">
                {listing.description || "No description available."}
              </p>
            </div>
              </section>

              {/* What this place offers - Only show for Experiences or Services, not Homes */}
              {((listing.activityType || listing.category === "experience") || (listing.serviceType || listing.category === "service")) && (
                <section className="mb-12 sm:mb-14">
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-light text-[#1C1C1E] mb-6">
                    What this place offers
                  </h2>
                  <div className="space-y-8">
            {/* Experiences */}
            {listing.experiences && listing.experiences.length > 0 && (
                  <div>
                        <h3 className="text-lg sm:text-xl font-semibold text-[#1C1C1E] mb-5">Experiences</h3>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {listing.experiences.map((exp, index) => (
                            <li key={index} className="flex items-start gap-3 text-[#1C1C1E] font-light">
                              <svg className="w-5 h-5 text-[#34C759] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                              <span className="text-base">{exp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* Services */}
            {listing.services && listing.services.length > 0 && (
                  <div>
                        <h3 className="text-lg sm:text-xl font-semibold text-[#1C1C1E] mb-5">Services</h3>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {listing.services.map((serv, index) => (
                            <li key={index} className="flex items-start gap-3 text-[#1C1C1E] font-light">
                              <svg className="w-5 h-5 text-[#34C759] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                              <span className="text-base">{serv}</span>
                    </li>
                  ))}
                </ul>
              </div>
                )}
              </div>
                </section>
              )}

            {/* Amenities */}
              <section className="mb-12 sm:mb-14 pt-10 sm:pt-12 border-t border-gray-200">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-light text-[#1C1C1E] mb-6">
                  Amenities
                </h2>
                {listing.amenities && listing.amenities.length > 0 ? (
                  <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {listing.amenities.map((amenity, index) => (
                      <li key={index} className="flex items-start gap-3 text-[#1C1C1E] font-light">
                        <svg className="w-5 h-5 text-[#34C759] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-base">{amenity}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[#8E8E93] font-light text-base">No amenities listed.</p>
                )}
              </section>

            {/* Google Maps */}
              <section className="mb-14 sm:mb-16 pt-10 sm:pt-12 border-t border-gray-200">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-light text-[#1C1C1E] mb-6">
                  Location
                </h2>
                
                {/* Address and Directions */}
                <div className="bg-gray-50 rounded-xl p-5 sm:p-6 mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <svg className="w-5 h-5 text-[#0071E3] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <p className="text-base sm:text-lg text-[#1C1C1E] font-medium leading-relaxed">{listing.location}</p>
                    </div>
                <a
                  href={getDirectionsUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-3 bg-[#0071E3] text-white rounded-lg text-sm sm:text-base font-medium hover:bg-[#0051D0] transition-all duration-200 shadow-sm hover:shadow-md whitespace-nowrap"
                >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Get Directions
                </a>
              </div>
                </div>
                <div className="w-full h-[400px] sm:h-[500px] rounded-2xl sm:rounded-3xl overflow-hidden bg-gray-100 shadow-lg border border-gray-200">
                {GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY !== "YOUR_GOOGLE_MAPS_API_KEY_HERE" ? (
                  <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
                    <GoogleMap
                      mapContainerStyle={{ width: '100%', height: '100%' }}
                      center={mapCenter}
                      zoom={15}
                      options={{
                        styles: [
                          {
                            featureType: "all",
                            elementType: "geometry",
                            stylers: [{ color: "#f5f5f7" }]
                          },
                          {
                            featureType: "water",
                            elementType: "geometry",
                            stylers: [{ color: "#e8e8ea" }]
                          }
                        ],
                        disableDefaultUI: false,
                        zoomControl: true,
                        mapTypeControl: true,
                        mapTypeControlOptions: {
                          style: 1, // HORIZONTAL_BAR
                          position: 3 // TOP_LEFT
                        }
                      }}
                    >
                      {listing?.latitude && listing?.longitude && (
                        <Marker position={{ lat: listing.latitude, lng: listing.longitude }} />
                      )}
                    </GoogleMap>
                  </LoadScript>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100 text-[#1C1C1E]/50">
                    <div className="text-center p-8">
                      <p className="text-sm font-light mb-2">Google Maps integration</p>
                      <p className="text-xs font-light">Add your Google Maps API key in <code className="bg-gray-200 px-2 py-1 rounded">src/config/googlemaps.js</code></p>
                    </div>
                  </div>
                )}
            </div>
              </section>

            {/* Reviews Section */}
              <section className="mb-14 sm:mb-16 pt-10 sm:pt-12 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 pb-4 border-b border-gray-200">
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-light text-[#1C1C1E]">Reviews</h2>
                {currentUser && (
                  <button
                    onClick={() => setShowReviewModal(true)}
                      className="inline-flex items-center justify-center px-5 py-3 bg-[#0071E3] text-white rounded-xl text-sm sm:text-base font-medium hover:bg-[#0051D0] transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    Write a Review
                  </button>
                )}
                </div>
              
              {reviews.length > 0 ? (
                <>
                  <div className="flex items-center gap-3 mb-6 sm:mb-8">
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          className={`w-5 h-5 sm:w-6 sm:h-6 ${
                            i < Math.round(averageRating)
                              ? "text-yellow-400 fill-yellow-400"
                              : "text-gray-300"
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className="text-xl sm:text-2xl font-medium text-[#1C1C1E]">
                      {averageRating.toFixed(1)}
                    </span>
                    <span className="text-sm sm:text-base text-[#1C1C1E]/70 font-light">
                      ({reviews.length} {reviews.length === 1 ? "review" : "reviews"})
                    </span>
                  </div>
                  
                  <div className="space-y-8 sm:space-y-10">
                    {reviews.map((review) => (
                      <div key={review.id} className="border-b border-gray-200 pb-8 sm:pb-10 last:border-0">
                        <div className="flex items-start gap-4">
                          {reviewerPhotos[review.userId] ? (
                            <img 
                              src={reviewerPhotos[review.userId]} 
                              alt={review.userName || review.userEmail?.split('@')[0] || "Anonymous"}
                              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover flex-shrink-0 shadow-md"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                const fallback = e.target.nextElementSibling;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div 
                            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#0071E3] flex items-center justify-center text-white text-base sm:text-lg font-semibold flex-shrink-0 shadow-md"
                            style={{ display: reviewerPhotos[review.userId] ? 'none' : 'flex' }}
                          >
                                {(review.userName || review.userEmail?.split('@')[0] || "A")[0].toUpperCase()}
                              </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                              <h4 className="font-semibold text-base sm:text-lg text-[#1C1C1E]">
                                  {review.userName || review.userEmail?.split('@')[0] || "Anonymous"}
                                </h4>
                              <span className="text-xs sm:text-sm text-[#8E8E93] font-light">
                                {new Date(review.createdAt).toLocaleDateString('en-US', {
                                  month: 'long',
                                  year: 'numeric'
                                })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mb-3">
                                    {[...Array(5)].map((_, i) => (
                                      <svg
                                        key={i}
                                  className={`w-5 h-5 ${
                                          i < review.rating
                                            ? "text-yellow-400 fill-yellow-400"
                                            : "text-gray-300"
                                        }`}
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                      >
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                      </svg>
                                    ))}
                                  </div>
                            <p className="text-base sm:text-lg text-[#1C1C1E] font-light leading-relaxed">
                              {review.comment}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <svg key={i} className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className="text-sm text-[#1C1C1E]/70 font-light">No reviews yet</span>
                  </div>
                  <p className="text-base text-[#1C1C1E]/70 font-light mb-6">
                    Be the first to review this listing!
                  </p>
                  {/* Show example review structure when empty */}
                  <div className="bg-gray-50 rounded-2xl p-6 sm:p-8 border border-gray-200">
                    <p className="text-sm text-[#1C1C1E]/50 font-light italic text-center">
                      Reviews will appear here once guests share their experiences
                    </p>
                  </div>
                </>
              )}
              </section>

            {/* Host Section */}
              <section className="mb-14 sm:mb-16 pt-10 sm:pt-12 border-t border-gray-200">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-light text-[#1C1C1E] mb-8 pb-4 border-b border-gray-200">Meet your host</h2>
              <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
                <div className="flex-shrink-0">
                    {hostPhotoUrl ? (
                      <img 
                        src={hostPhotoUrl} 
                        alt={hostName}
                        className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover shadow-lg"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          const fallback = e.target.nextElementSibling;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#0071E3] flex items-center justify-center text-white text-2xl sm:text-3xl font-semibold shadow-lg"
                      style={{ display: hostPhotoUrl ? 'none' : 'flex' }}
                    >
                    {hostInitials}
                  </div>
                </div>
                <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      <h3 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-[#1C1C1E]">{hostName}</h3>
                      <span className="px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-full text-xs sm:text-sm font-semibold flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      Prime Host
                    </span>
                  </div>
                    <div className="flex flex-wrap gap-5 sm:gap-6 mb-6 text-sm sm:text-base text-[#8E8E93] font-light">
                      <span className="text-[#1C1C1E] font-medium">Reviews: 2</span>
                      <span className="text-[#1C1C1E] font-medium">Rating: 5 stars</span>
                      <span className="text-[#1C1C1E] font-medium">Experience: 0 years</span>
                  </div>
                    <div className="mb-6">
                      <h4 className="text-lg sm:text-xl font-semibold text-[#1C1C1E] mb-3">About {hostName}</h4>
                      <p className="text-base sm:text-lg text-[#1C1C1E] font-light leading-relaxed">
                      {hostName} is an experienced and dedicated host committed to providing exceptional stays. They are highly rated and known for great communication and hospitality.
                    </p>
                  </div>
                    <div className="flex items-center gap-2 mb-6">
                      <div className="w-2.5 h-2.5 bg-[#34C759] rounded-full animate-pulse"></div>
                      <span className="text-base sm:text-lg text-[#1C1C1E] font-light">Typically responds within a few hours</span>
                  </div>
                  {currentUser && (
                    <button
                      onClick={() => {
                        if (bookingId) {
                          navigate(`/chat/${bookingId}`);
                        } else {
                          // Navigate to chat with listing info for "Contact Host" without booking
                          navigate('/chat', { 
                            state: { 
                              listingId: id, 
                              hostId: listing.hostId,
                              hostEmail: listing.hostEmail 
                            } 
                          });
                        }
                      }}
                        className="inline-flex items-center gap-2 px-6 py-3.5 bg-[#0071E3] text-white rounded-xl text-base font-semibold hover:bg-[#0051D0] transition-all duration-200 shadow-md hover:shadow-lg"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      Contact Host
                    </button>
                  )}
                    <p className="mt-4 text-xs sm:text-sm text-[#8E8E93] font-light flex items-start gap-2">
                      <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Always communicate through the platform to protect your booking and payment
                  </p>
                </div>
              </div>
              </section>
            </div>

            {/* Right Column - Booking Widget */}
            <div className="lg:sticky lg:top-24">
              {/* Booking Card */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                {/* Price Header */}
                <div className="bg-gradient-to-br from-[#0071E3] to-[#0051D0] p-5 text-white">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl font-light">${listing.price}</span>
                    <span className="text-sm font-light opacity-90">
                      {isPlace ? "/ night" : isExperience ? "/ person" : isService ? "/ service" : "/ night"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                    <span className="text-sm font-medium">Available now</span>
            </div>
          </div>

                {/* Booking Form */}
                {!bookingSuccess && !paymentSuccess ? (
                  <form onSubmit={handleBooking} className="p-5 space-y-4">
                    {/* Date Fields */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Check-in
                        </label>
                        <input
                          type="date"
                          value={checkIn}
                          onChange={(e) => setCheckIn(e.target.value)}
                          min={new Date().toISOString().split("T")[0]}
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 bg-white text-sm text-gray-900 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Check-out
                        </label>
                        <input
                          type="date"
                          value={checkOut}
                          onChange={(e) => setCheckOut(e.target.value)}
                          min={checkIn || new Date().toISOString().split("T")[0]}
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 bg-white text-sm text-gray-900 transition-all"
                        />
                      </div>
                    </div>

            {/* Availability Calendar */}
                    <div className="pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-4 h-4 text-[#0071E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                        <h3 className="text-sm font-semibold text-gray-900">Availability</h3>
              </div>
              
              {/* Calendar Header */}
                      <div className="flex items-center justify-between mb-3">
                <button
                          type="button"
                  onClick={() => navigateMonth(-1)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg transition-all duration-200"
                >
                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                        <h4 className="text-sm font-semibold text-gray-900">
                  {formatMonthYear(currentMonth)}
                </h4>
                <button
                          type="button"
                  onClick={() => navigateMonth(1)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg transition-all duration-200"
                >
                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Calendar Grid */}
                      <div className="mb-3">
                {/* Day Headers */}
                        <div className="grid grid-cols-7 gap-1 mb-1">
                          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                            <div key={day} className="text-center text-xs text-gray-500 font-medium py-1">
                      {day}
                    </div>
                  ))}
                </div>
                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-1">
                  {getDaysInMonth(currentMonth).map((date, index) => {
                    const status = getDateStatus(date);
                    const dateStr = date ? formatDateLocal(date) : '';
                    const isSelected = (checkIn && dateStr === checkIn) || (checkOut && dateStr === checkOut);
                    
                    return (
                      <button
                        key={index}
                                type="button"
                        disabled={!date || status === 'past' || status === 'booked' || status === 'blocked'}
                        onClick={() => {
                          if (!date || status === 'past' || status === 'booked' || status === 'blocked') return;
                          if (!checkIn || (checkIn && checkOut)) {
                            setCheckIn(dateStr);
                            setCheckOut('');
                          } else if (checkIn && dateStr > checkIn) {
                            setCheckOut(dateStr);
                          }
                        }}
                        className={`
                                  aspect-square rounded-lg text-xs font-medium transition-all
                          ${!date ? 'cursor-default' : ''}
                          ${status === 'past' ? 'text-gray-300 bg-gray-50 cursor-not-allowed' : ''}
                                  ${status === 'booked' ? 'text-gray-500 bg-gray-100 cursor-not-allowed relative' : ''}
                                  ${status === 'blocked' ? 'text-white bg-red-200 cursor-not-allowed relative' : ''}
                                  ${status === 'available' ? 'text-gray-700 bg-green-50 hover:bg-green-100 hover:text-gray-900 cursor-pointer' : ''}
                                  ${isSelected ? 'bg-[#0071E3] text-white font-semibold' : ''}
                                  ${status === 'checkin' || status === 'checkout' ? 'bg-[#0071E3] text-white font-semibold' : ''}
                        `}
                        title={date ? date.toLocaleDateString() : ''}
                      >
                        {date ? date.getDate() : ''}
                        {status === 'booked' && (
                                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                                    <div className="w-[141%] h-0.5 bg-gray-600 transform rotate-45 origin-center"></div>
                                  </div>
                        )}
                        {status === 'blocked' && (
                                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                                    <div className="w-[141%] h-0.5 bg-red-600 transform rotate-45 origin-center"></div>
                                  </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Legend */}
                      <div className="flex flex-wrap gap-3 text-xs text-gray-600 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded bg-green-50 border border-green-200"></div>
                  <span>Available</span>
                </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded bg-red-200"></div>
                  <span>Blocked</span>
                </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded bg-gray-100"></div>
                  <span>Booked</span>
                </div>
              </div>
            </div>

                    {/* Promo Code - Collapsible */}
                    {listing.promoCode && !appliedCoupon && (
                      <div className="pt-2 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => setShowPromo(!showPromo)}
                          className="w-full flex items-center justify-between text-sm text-[#0071E3] hover:text-[#0051D0] transition-colors"
                        >
                          <span className="font-medium">Have a promo code?</span>
                          <svg className={`w-4 h-4 transition-transform ${showPromo ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                        </button>
                        {showPromo && (
                          <div className="mt-3 space-y-2">
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) => {
                            setCouponCode(e.target.value.toUpperCase());
                            setCouponError("");
                          }}
                              placeholder={`Enter code (e.g., ${listing.promoCode})`}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 bg-white text-sm"
                        />
                        <button
                          type="button"
                          onClick={handleApplyCoupon}
                          disabled={!couponCode.trim() || !checkIn || !checkOut}
                              className="w-full px-3 py-2 bg-[#0071E3] text-white rounded-lg text-sm font-medium hover:bg-[#0051D0] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                              Apply Code
                        </button>
                      </div>
                        )}
                      </div>
                    )}

                    {/* Applied Coupon */}
                    {appliedCoupon && (
                      <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <div>
                            <p className="text-sm font-semibold text-green-800">{appliedCoupon.code}</p>
                            <p className="text-xs text-green-600">
                              {appliedCoupon.discountPercentage}% off
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveCoupon}
                          className="text-green-600 hover:text-green-800 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                    {couponError && (
                      <p className="text-xs text-red-600">{couponError}</p>
                    )}

                  {/* Price Breakdown */}
                  {checkIn && checkOut && totalPrice > 0 && (
                      <div className="pt-3 border-t border-gray-200 space-y-2">
                        <div className="flex justify-between text-sm text-gray-600">
                        <span>Subtotal</span>
                        <span>${(parseFloat(listing.price) * Math.ceil((new Date(checkOut + 'T00:00:00').getTime() - new Date(checkIn + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24))).toFixed(2)}</span>
                      </div>
                      {appliedCoupon && discountAmount > 0 && (
                        <div className="flex justify-between text-sm text-green-600">
                            <span>Discount</span>
                          <span>-${discountAmount.toFixed(2)}</span>
                        </div>
                      )}
                        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                          <span className="text-base font-semibold text-gray-900">Total</span>
                          <span className="text-2xl font-bold text-gray-900">${totalPrice.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {bookingError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm whitespace-pre-line">
                      {bookingError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!checkIn || !checkOut || totalPrice === 0 || !listing?.price || (currentUser && listing && listing.hostId === currentUser.uid)}
                      className="w-full bg-[#0071E3] text-white px-6 py-3.5 rounded-lg text-base font-semibold hover:bg-[#0051D0] transition-all shadow-lg hover:shadow-xl disabled:bg-gray-300 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    Reserve
                  </button>
                  
                  {currentUser && listing && listing.hostId === currentUser.uid && (
                    <p className="text-xs text-center text-red-600 mt-2">
                      You cannot book your own listing.
                    </p>
                  )}

                    <p className="text-xs text-center text-gray-500">
                    You won't be charged yet
                  </p>
                </form>
              ) : (
                  <div className="p-5 space-y-6">
                  <div className="text-center">
                    <div className="text-5xl mb-4">✅</div>
                    <h3 className="text-xl font-semibold text-[#1C1C1E] mb-2">
                      Booking Created!
                    </h3>
                    <p className="text-[#1C1C1E]/70 font-light mb-4">
                      Complete your payment to confirm your booking.
                    </p>
                    <div className="bg-[#F5F5F7] rounded-xl p-4 mb-6">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[#1C1C1E]/70 font-light">Total Amount</span>
                        <span className="text-2xl font-semibold text-[#1C1C1E]">
                          ${totalPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!paymentSuccess ? (
                    <div className="space-y-6">
                      {/* Payment Method Selection */}
                    <div>
                        <label className="block text-sm sm:text-base font-medium text-[#1C1C1E] mb-3">
                          Select Payment Method
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setPaymentMethod("paypal")}
                            disabled={paymentProcessing}
                            className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                              paymentMethod === "paypal"
                                ? "border-[#0071E3] bg-[#0071E3]/5"
                                : "border-gray-200 hover:border-gray-300"
                            } ${paymentProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            <div className="flex flex-col items-center gap-2">
                              <svg className="w-6 h-6 text-[#0070BA]" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.174 1.351 1.05 3.3.93 4.857-.022.27-.042.519-.056.73l-.122 2.12c-.09 1.577-.2 3.053-.45 4.33-.23 1.18-.55 2.26-1.05 3.22-.63 1.22-1.52 2.26-2.57 3.09-1.05.84-2.24 1.48-3.55 1.91-1.12.36-2.33.54-3.58.54h-2.42c-.28 0-.52-.11-.7-.29a.933.933 0 0 1-.3-.7l.04-2.17c.02-1.19.04-2.45-.18-3.66-.11-.6-.3-1.19-.58-1.72-.28-.53-.65-1.01-1.1-1.42-.45-.41-.98-.73-1.57-.95-.59-.22-1.24-.33-1.93-.33H4.23a.93.93 0 0 1-.7-.3.93.93 0 0 1-.3-.7l.84-7.35c.05-.38.35-.66.72-.66h2.83c.38 0 .67.28.72.66l.42 3.66c.05.38.35.66.72.66h1.1c2.57 0 4.58.54 5.69 1.81 1.17 1.35 1.05 3.3.93 4.86l-.12 2.12c-.09 1.58-.2 3.05-.45 4.33-.23 1.18-.55 2.26-1.05 3.22-.63 1.22-1.52 2.26-2.57 3.09-1.05.84-2.24 1.48-3.55 1.91-1.12.36-2.33.54-3.58.54H7.076z"/>
                              </svg>
                              <span className="text-xs sm:text-sm font-medium text-[#1C1C1E]">PayPal</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaymentMethod("wallet")}
                            disabled={paymentProcessing}
                            className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                              paymentMethod === "wallet"
                                ? "border-[#34C759] bg-[#34C759]/5"
                                : "border-gray-200 hover:border-gray-300"
                            } ${paymentProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            <div className="flex flex-col items-center gap-2">
                              <svg className="w-6 h-6 text-[#34C759]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                              <span className="text-xs sm:text-sm font-medium text-[#1C1C1E]">Wallet</span>
                              {currentUser && (
                                <span className="text-xs text-[#8E8E93]">${walletBalance.toFixed(2)}</span>
                              )}
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Payment Method Content */}
                      {paymentMethod === "paypal" ? (
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
                              // Price is already in USD
                            return actions.order.create({
                              purchase_units: [
                                {
                                  description: listing.title,
                                  amount: {
                                    currency_code: "USD",
                                    value: totalPrice.toFixed(2),
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
                              
                              // Create booking ONLY after payment is confirmed captured
                                // Price is already in USD
                              await createBookingAfterPayment({
                                  paymentMethod: "paypal",
                                transactionId: capture.id,
                                paypalOrderId: data.orderID,
                                payer: details.payer,
                                status: details.status,
                                  amount: totalPrice,
                                  currency: "USD"
                              });

                              setPaymentSuccess(true);
                              setPaymentProcessing(false);
                            } catch (error) {
                              console.error("❌ Error processing payment:", error);
                              setPaymentProcessing(false);
                              alert(`Payment failed: ${error.message}. Please try again.`);
                            }
                          }}
                          onCancel={() => {
                            console.log("Payment cancelled");
                            setPaymentProcessing(false);
                          }}
                          onError={(err) => {
                            console.error("❌ PayPal error:", err);
                            setPaymentProcessing(false);
                            alert("Payment error. Please try again.");
                          }}
                        />
                      </PayPalScriptProvider>
                      ) : (
                        <div className="space-y-4">
                          <div className="bg-gray-50 rounded-xl p-4">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm text-[#8E8E93] font-light">Total Amount</span>
                              <span className="text-lg font-semibold text-[#1C1C1E]">
                                ${totalPrice.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-[#8E8E93] font-light">Wallet Balance</span>
                              <span className={`text-base font-medium ${
                                walletBalance >= totalPrice ? "text-[#34C759]" : "text-red-500"
                              }`}>
                                ${walletBalance.toFixed(2)}
                              </span>
                            </div>
                            {walletBalance < totalPrice && (
                              <p className="text-xs text-red-500 mt-2">
                                Insufficient balance. You need ${(totalPrice - walletBalance).toFixed(2)} more.
                              </p>
                            )}
                          </div>
                          <button
                            onClick={handleWalletPayment}
                            disabled={paymentProcessing || walletBalance < totalPrice}
                            className={`w-full px-6 py-4 rounded-xl text-base sm:text-lg font-semibold transition-all shadow-lg hover:shadow-xl ${
                              walletBalance >= totalPrice && !paymentProcessing
                                ? "bg-[#34C759] text-white hover:bg-[#30D158]"
                                : "bg-gray-300 text-gray-600 cursor-not-allowed"
                            }`}
                          >
                            {paymentProcessing ? (
                              <span className="flex items-center justify-center gap-2">
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Processing...
                              </span>
                            ) : (
                              "Pay with Wallet"
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center space-y-4">
                      <div className="text-5xl mb-4">🎉</div>
                      <h3 className="text-xl font-semibold text-[#34C759] mb-2">
                        Payment Successful!
                      </h3>
                      <p className="text-[#1C1C1E]/70 font-light mb-6">
                        Your booking has been confirmed.
                      </p>
                      <button
                        onClick={() => navigate("/guest/dashboard")}
                        className="w-full bg-[#34C759] text-white px-6 py-4 rounded-xl text-base font-medium hover:bg-[#2AA049] transition-all shadow-md hover:shadow-lg"
                      >
                        Go to Dashboard
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        </section>
      </div>

      {/* Loading Overlay */}
      {paymentProcessing && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
          <div className="bg-white p-8 rounded-2xl shadow-xl">
            <p className="text-lg font-medium text-[#1C1C1E]">Processing payment...</p>
          </div>
        </div>
      )}

      {/* Sign In Modal */}
      {showSignInModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setShowSignInModal(false)}
        >
          {/* Blurred Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md"></div>
          
          {/* Modal Card */}
          <div 
            className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowSignInModal(false)}
              className="absolute top-4 right-4 text-[#1C1C1E]/50 hover:text-[#1C1C1E] transition-colors duration-200"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Content */}
            <div className="text-center">
              {/* Icon */}
              <div className="mb-6 flex justify-center">
                <div className="w-16 h-16 bg-[#0071E3]/10 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-[#0071E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>

              {/* Title */}
              <h2 className="text-2xl font-semibold text-[#1C1C1E] mb-3">
                Sign In Required
              </h2>

              {/* Message */}
              <p className="text-[#1C1C1E]/70 font-light mb-8 leading-relaxed">
                Please sign in to your account to complete your booking and secure your reservation.
              </p>

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setShowSignInModal(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-xl text-[#1C1C1E] font-medium hover:bg-gray-50 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    navigate("/login", { 
                      state: { 
                        message: "Please sign in to complete your booking.",
                        returnTo: `/listing/${id}`
                      } 
                    });
                  }}
                  className="flex-1 px-6 py-3 bg-[#0071E3] text-white rounded-xl font-medium hover:bg-[#0051D0] transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  Sign In
                </button>
              </div>

              {/* Sign Up Link */}
              <p className="mt-6 text-sm text-[#1C1C1E]/60 font-light">
                Don't have an account?{" "}
                <Link
                  to="/signup"
                  className="text-[#0071E3] hover:underline font-medium"
                  onClick={() => setShowSignInModal(false)}
                >
                  Sign up
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setShowReviewModal(false)}
        >
          {/* Blurred Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md"></div>
          
          {/* Modal Card */}
          <div 
            className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 sm:p-8 animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowReviewModal(false)}
              className="absolute top-4 right-4 text-[#1C1C1E]/50 hover:text-[#1C1C1E] transition-colors duration-200"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Content */}
            <div>
              <h2 className="text-2xl font-semibold text-[#1C1C1E] mb-6">Write a Review</h2>
              
              <form onSubmit={handleSubmitReview} className="space-y-6">
                {/* Rating */}
                <div>
                  <label className="block text-sm font-medium text-[#1C1C1E] mb-3">
                    Rating
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => setReviewRating(rating)}
                        className="focus:outline-none transition-transform hover:scale-110"
                      >
                        <svg
                          className={`w-8 h-8 ${
                            rating <= reviewRating
                              ? "text-yellow-400 fill-yellow-400"
                              : "text-gray-300"
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Comment */}
                <div>
                  <label className="block text-sm font-medium text-[#1C1C1E] mb-2">
                    Your Review
                  </label>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    rows={6}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/10 bg-[#F5F5F7] text-[#1C1C1E] font-light transition-all resize-none"
                    placeholder="Share your experience..."
                    required
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowReviewModal(false);
                      setReviewComment("");
                      setReviewRating(5);
                    }}
                    className="flex-1 px-6 py-3 border border-gray-300 rounded-xl text-[#1C1C1E] font-medium hover:bg-gray-50 transition-all duration-200"
                    disabled={submittingReview}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReview || !reviewComment.trim()}
                    className="flex-1 px-6 py-3 bg-[#0071E3] text-white rounded-xl font-medium hover:bg-[#0051D0] transition-all duration-200 shadow-md hover:shadow-lg disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {submittingReview ? "Submitting..." : "Submit Review"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListingDetails;
