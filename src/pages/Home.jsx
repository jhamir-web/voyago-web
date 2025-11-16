import React, { useEffect, useState, useRef, useMemo, useLayoutEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { collection, getDocs, query, where, orderBy, doc, onSnapshot, getDoc, addDoc, deleteDoc } from "firebase/firestore";
import { HERO_VIDEO_URL, getCloudinaryVideoUrl, cloudinaryConfig } from "../config/cloudinary";
import Header from "../components/Header";
import HostHomePage from "./host/HostHomePage";

// Listing Card Component - Apple Style
const ListingCard = ({ listing, currentUser, selectedCategory }) => {
  const [rating, setRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteId, setFavoriteId] = useState(null);

  // Fetch real rating from reviews
  useEffect(() => {
    if (!listing.id) return;
    const reviewsQuery = query(
      collection(db, "reviews"),
      where("listingId", "==", listing.id),
      where("status", "==", "approved")
    );
    
    const unsubscribe = onSnapshot(reviewsQuery, (snapshot) => {
      let totalRating = 0;
      let count = 0;
      snapshot.forEach((doc) => {
        const review = doc.data();
        totalRating += review.rating || 0;
        count++;
      });
      setReviewCount(count);
      setRating(count > 0 ? totalRating / count : 0);
    }, (error) => {
      console.error("Error fetching reviews:", error);
    });

    return () => unsubscribe();
  }, [listing.id]);

  // Check if listing is favorited
  useEffect(() => {
    const checkFavorite = async () => {
      if (!currentUser || !listing.id) {
        setIsFavorite(false);
        setFavoriteId(null);
        return;
      }

      try {
        const favoritesQuery = query(
          collection(db, "favorites"),
          where("userId", "==", currentUser.uid),
          where("listingId", "==", listing.id)
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
  }, [currentUser, listing.id]);

  // Handle favorite toggle
  const handleToggleFavorite = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!currentUser) {
      // Could show a sign-in modal here
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
          where("listingId", "==", listing.id)
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
            listingId: listing.id,
            listingTitle: listing.title,
            listingImageUrl: listing.imageUrl,
            createdAt: new Date().toISOString(),
          };
          const docRef = await addDoc(collection(db, "favorites"), favoriteData);
          setIsFavorite(true);
          setFavoriteId(docRef.id);
        }
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
      alert(`Failed to update favorite: ${error.message || "Please try again."}`);
    }
  };

  return (
    <Link
      to={`/listing/${listing.id}`}
      className="group block bg-white rounded-xl sm:rounded-2xl overflow-hidden border border-gray-200 shadow-md hover:shadow-2xl hover:border-gray-300 transition-all duration-500 ease-out cursor-pointer transform hover:-translate-y-2 w-full"
      style={{ 
        transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
        willChange: 'transform, box-shadow',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
      }}
    >
      {/* Image Container */}
      <div className="relative w-full aspect-[4/3] overflow-hidden bg-gray-50">
        {listing.imageUrl ? (
          <img
            src={listing.imageUrl}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
            style={{ 
              transition: 'transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
              willChange: 'transform'
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl bg-gradient-to-br from-gray-50 to-gray-100">
            🏠
          </div>
        )}
        
        {/* Gradient Overlay on Hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/0 via-black/0 to-black/0 group-hover:from-black/0 group-hover:via-black/0 group-hover:to-black/10 transition-all duration-500"></div>
        
        {/* Heart Icon - Favorite Button */}
        {currentUser && (
          <button
            onClick={handleToggleFavorite}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 sm:p-2.5 bg-white/90 backdrop-blur-md rounded-full hover:bg-white transition-all duration-300 shadow-lg z-10 transform hover:scale-110 active:scale-95"
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <svg
              className={`w-4 h-4 sm:w-5 sm:h-5 transition-all duration-300 ${
                isFavorite 
                  ? "fill-red-500 text-red-500" 
                  : "fill-none text-gray-600 hover:text-red-500"
              }`}
              viewBox="0 0 24 24"
              strokeWidth={isFavorite ? 0 : 2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-3 sm:p-4 md:p-5">
        {/* Title and Location */}
        <div className="mb-2 sm:mb-3">
          <h3 className="text-sm sm:text-base md:text-lg font-light text-[#1C1C1E] mb-1 sm:mb-1.5 line-clamp-2 group-hover:text-[#0071E3] transition-colors duration-300 break-words">
            {listing.title}
          </h3>
          <p className="text-xs sm:text-sm text-[#1C1C1E]/60 font-light line-clamp-1 break-words">
            {listing.location}
          </p>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-1 sm:gap-1.5 mb-2 sm:mb-3">
          {reviewCount > 0 && rating > 0 ? (
            <>
              <svg className="w-3 h-3 sm:w-4 sm:h-4 fill-[#FFD700] flex-shrink-0" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span className="text-xs sm:text-sm font-medium text-[#1C1C1E]">{rating.toFixed(1)}</span>
              <span className="text-[10px] sm:text-xs text-[#1C1C1E]/50 font-light">({reviewCount})</span>
            </>
          ) : (
            <>
              <svg className="w-3 h-3 sm:w-4 sm:h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              <span className="text-[10px] sm:text-xs text-[#1C1C1E]/50 font-light">No ratings yet</span>
            </>
          )}
        </div>

        {/* Category Badge - Show "Home" when viewing homes category, otherwise show listing category */}
        {selectedCategory === "homes" ? (
          <div className="mb-2 sm:mb-3">
            <span className="inline-block px-2 sm:px-2.5 py-0.5 sm:py-1 bg-[#0071E3]/10 text-[#0071E3] rounded-md text-[10px] sm:text-xs font-medium capitalize">
              Home
            </span>
          </div>
        ) : listing.category && (
          <div className="mb-2 sm:mb-3">
            <span className="inline-block px-2 sm:px-2.5 py-0.5 sm:py-1 bg-[#0071E3]/10 text-[#0071E3] rounded-md text-[10px] sm:text-xs font-medium capitalize">
              {listing.category}
            </span>
          </div>
        )}

        {/* Price */}
        <div className="pt-2 sm:pt-3 border-t border-gray-100">
          <div className="flex items-baseline gap-0.5 sm:gap-1">
            <span className="text-base sm:text-lg md:text-xl font-light text-[#1C1C1E]">
              ${listing.price}
            </span>
            <span className="text-xs sm:text-sm text-[#1C1C1E]/60 font-light">
              {listing.activityType 
                ? "person" 
                : listing.serviceType 
                ? "service" 
                : listing.placeType || listing.subcategory || listing.category === "place" || (listing.category && !listing.activityType && !listing.serviceType)
                ? "night" 
                : "person"}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};

// Hero Video Component with error handling
const HeroVideo = () => {
  const videoRef = useRef(null);
  const [videoError, setVideoError] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Convert .3gp or other formats to optimized MP4 using Cloudinary transformations
  const getOptimizedVideoUrl = () => {
    if (!HERO_VIDEO_URL || HERO_VIDEO_URL === "YOUR_CLOUDINARY_VIDEO_URL_HERE") {
      // Use Pexels fallback video
      return "https://videos.pexels.com/video-files/3045163/3045163-uhd_2560_1440_25fps.mp4";
    }

    // If it's already a full Cloudinary URL, optimize it
    if (HERO_VIDEO_URL.includes("res.cloudinary.com")) {
      // Check if transformations are already applied
      if (HERO_VIDEO_URL.includes("/f_mp4") || HERO_VIDEO_URL.includes("/q_auto")) {
        return HERO_VIDEO_URL; // Already has transformations
      }

      // Insert transformations: f_mp4 = force MP4, q_auto:best = best quality, w_1920 = max width
      // Remove .3gp extension and add transformations
      let optimizedUrl = HERO_VIDEO_URL.replace(/\.3gp$/, ""); // Remove .3gp extension
      
      // Insert transformations after /video/upload/
      optimizedUrl = optimizedUrl.replace(
        /\/video\/upload\//,
        "/video/upload/f_mp4,q_auto:best,w_1920/"
      );
      
      console.log("🎥 Original URL:", HERO_VIDEO_URL);
      console.log("🎥 Optimized URL:", optimizedUrl);
      
      return optimizedUrl;
    }

    // If it's a public ID, construct URL with transformations
    return `https://res.cloudinary.com/${cloudinaryConfig.cloudName}/video/upload/f_mp4,q_auto:best,w_1920/${HERO_VIDEO_URL}`;
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleError = (e) => {
      console.error("❌ Video failed to load");
      console.error("Video error code:", video.error?.code);
      console.error("Video error message:", video.error?.message);
      console.error("Video network state:", video.networkState);
      console.error("Video ready state:", video.readyState);
      setVideoError(true);
      setIsLoading(false);
    };

    const handleLoadedData = () => {
      console.log("✅ Video loaded successfully");
      setVideoLoaded(true);
      setIsLoading(false);
    };

    const handleLoadStart = () => {
      console.log("🔄 Video loading started...");
      setIsLoading(true);
    };

    const handleCanPlay = () => {
      console.log("✅ Video can play");
      setVideoLoaded(true);
      setIsLoading(false);
    };

    video.addEventListener("error", handleError);
    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("loadstart", handleLoadStart);
    video.addEventListener("canplay", handleCanPlay);

    return () => {
      video.removeEventListener("error", handleError);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("loadstart", handleLoadStart);
      video.removeEventListener("canplay", handleCanPlay);
    };
  }, []);

  const optimizedUrl = getOptimizedVideoUrl();

  // Debug: Log video URL and check if it's valid
  useEffect(() => {
    console.log("🎥 Video URL being used:", optimizedUrl);
    console.log("🎥 HERO_VIDEO_URL from config:", HERO_VIDEO_URL);
    
    // Test if video URL is accessible
    fetch(optimizedUrl, { method: 'HEAD' })
      .then((response) => {
        if (response.ok) {
          console.log("✅ Video URL is accessible (status:", response.status, ")");
        } else {
          console.error("❌ Video URL returned status:", response.status);
        }
      })
      .catch((error) => {
        console.error("❌ Video URL is not accessible:", error.message);
      });
  }, [optimizedUrl]);

  return (
    <>
      {!videoError ? (
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className={`absolute inset-0 w-full h-full object-cover z-[1] transition-opacity duration-1000 ${
            videoLoaded ? "opacity-80" : "opacity-0"
          }`}
          onError={(e) => {
            console.error("❌ Video onError event:", e);
            console.error("❌ Video element:", videoRef.current);
            console.error("❌ Video src:", videoRef.current?.src);
            setVideoError(true);
            setIsLoading(false);
          }}
          onLoadStart={() => {
            console.log("🔄 Video load started");
            setIsLoading(true);
          }}
          onLoadedMetadata={() => {
            console.log("✅ Video metadata loaded");
          }}
          onCanPlay={() => {
            console.log("✅ Video can play");
            setVideoLoaded(true);
            setIsLoading(false);
          }}
        >
          <source src={optimizedUrl} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      ) : (
        // Fallback image if video fails
        <div className="absolute inset-0 w-full h-full z-[1] bg-gradient-to-br from-[#1C1C1E] via-[#2C2C2E] to-[#1C1C1E]">
          <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1920&q=80')] bg-cover bg-center opacity-30"></div>
        </div>
      )}
    </>
  );
};

const Home = () => {
  const { currentUser, userRole, userRoles, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [filteredListings, setFilteredListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("homes");
  const [searchQuery, setSearchQuery] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(1);
  const [showGuestMenu, setShowGuestMenu] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedStartDate, setSelectedStartDate] = useState(null);
  const [selectedEndDate, setSelectedEndDate] = useState(null);
  const [unavailableListings, setUnavailableListings] = useState(new Set());

  // Format date for display
  const formatDateDisplay = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  // Format date range for display
  const formatDateRangeDisplay = () => {
    if (checkIn && checkOut) {
      return `${formatDateDisplay(checkIn)} - ${formatDateDisplay(checkOut)}`;
    } else if (checkIn) {
      return `${formatDateDisplay(checkIn)} - Add checkout`;
    }
    return 'Add dates';
  };

  // Calendar helper functions
  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatDateToString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isSameDate = (date1, date2) => {
    if (!date1 || !date2) return false;
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };

  const isDateInRange = (date, start, end) => {
    if (!start || !end) return false;
    const dateStr = formatDateToString(date);
    const startStr = formatDateToString(start);
    const endStr = formatDateToString(end);
    return dateStr >= startStr && dateStr <= endStr;
  };

  const isDateDisabled = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const handleDateClick = (date) => {
    if (isDateDisabled(date)) return;
    
    if (!selectedStartDate || (selectedStartDate && selectedEndDate)) {
      // Start new selection
      setSelectedStartDate(date);
      setSelectedEndDate(null);
      setCheckIn(formatDateToString(date));
      setCheckOut("");
    } else if (selectedStartDate && !selectedEndDate) {
      // Complete selection
      if (date < selectedStartDate) {
        // If clicked date is before start, make it the new start
        setSelectedStartDate(date);
        setSelectedEndDate(selectedStartDate);
        setCheckIn(formatDateToString(date));
        setCheckOut(formatDateToString(selectedStartDate));
        // Close calendar when both dates are selected
        setTimeout(() => {
          setShowDatePicker(false);
          setFocusedField(null);
        }, 100);
      } else {
        // Normal case: set end date
        setSelectedEndDate(date);
        setCheckOut(formatDateToString(date));
        // Close calendar when both dates are selected
        setTimeout(() => {
          setShowDatePicker(false);
          setFocusedField(null);
        }, 100);
      }
    }
  };

  const handleClearDates = () => {
    setCheckIn("");
    setCheckOut("");
    setSelectedStartDate(null);
    setSelectedEndDate(null);
  };

  const handlePreviousMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
  };

  // Sync calendar selection with checkIn/checkOut
  useEffect(() => {
    if (checkIn) {
      const date = new Date(checkIn + 'T00:00:00');
      setSelectedStartDate(date);
      if (checkOut) {
        const endDate = new Date(checkOut + 'T00:00:00');
        setSelectedEndDate(endDate);
      } else {
        setSelectedEndDate(null);
      }
    } else {
      setSelectedStartDate(null);
      setSelectedEndDate(null);
    }
  }, [checkIn, checkOut]);

  // Fetch unavailable listings based on selected dates
  useEffect(() => {
    const fetchUnavailableListings = async () => {
      if (!checkIn || !checkOut || listings.length === 0) {
        setUnavailableListings(new Set());
        return;
      }

      try {
        const unavailable = new Set();
        const checkInDate = new Date(checkIn + 'T00:00:00');
        const checkOutDate = new Date(checkOut + 'T00:00:00');
        checkInDate.setHours(0, 0, 0, 0);
        checkOutDate.setHours(0, 0, 0, 0);

        // Fetch existing bookings
        const bookingsQuery = query(
          collection(db, "bookings"),
          where("status", "in", ["confirmed", "pending"])
        );
        const bookingsSnapshot = await getDocs(bookingsQuery);

        bookingsSnapshot.forEach((doc) => {
          const booking = doc.data();
          if (!booking.checkIn || !booking.checkOut || !booking.listingId) return;

          const bookingCheckIn = new Date(booking.checkIn);
          const bookingCheckOut = new Date(booking.checkOut);
          bookingCheckIn.setHours(0, 0, 0, 0);
          bookingCheckOut.setHours(0, 0, 0, 0);

          // Check for date overlap
          const hasOverlap = (
            (checkInDate >= bookingCheckIn && checkInDate <= bookingCheckOut) ||
            (checkOutDate >= bookingCheckIn && checkOutDate <= bookingCheckOut) ||
            (checkInDate <= bookingCheckIn && checkOutDate >= bookingCheckOut)
          );

          if (hasOverlap) {
            unavailable.add(booking.listingId);
          }
        });

        // Note: Blocked dates are stored at host level but should be per-listing
        // For now, we only filter by actual bookings to avoid affecting all listings by the same host

        setUnavailableListings(unavailable);
      } catch (error) {
        console.error("Error fetching unavailable listings:", error);
        setUnavailableListings(new Set());
      }
    };

    fetchUnavailableListings();
  }, [checkIn, checkOut, listings]);

  const heroRef = useRef(null);
  const homesButtonRef = useRef(null);
  const experiencesButtonRef = useRef(null);
  const servicesButtonRef = useRef(null);
  const [underlineStyle, setUnderlineStyle] = useState({ width: 0, left: 0 });

  // Debug: Log role changes
  useEffect(() => {
    if (currentUser) {
      console.log("🏠 Home page - Current user:", currentUser.email);
      console.log("🏠 Home page - User UID:", currentUser.uid);
      console.log("🏠 Home page - User role:", userRole);
      console.log("🏠 Home page - Role type:", typeof userRole);
      console.log("🏠 Home page - Role === 'host':", userRole === "host");
      console.log("🏠 Home page - Role === 'guest':", userRole === "guest");
    }
  }, [currentUser, userRole]);

  // Intersection Observer for listing sections only
  useEffect(() => {
    const listingObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.style.opacity = "1";
            entry.target.style.transform = "translateY(0)";
          } else {
            entry.target.style.opacity = "0";
            entry.target.style.transform = "translateY(30px)";
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px",
      }
    );

    // Observe all listing sections for scroll animations
    const listingSections = document.querySelectorAll(".listing-section");
    listingSections.forEach((section) => {
      section.style.opacity = "0";
      section.style.transform = "translateY(30px)";
      section.style.transition = "opacity 0.6s ease-out, transform 0.6s ease-out";
      listingObserver.observe(section);
    });

    return () => {
      const listingSections = document.querySelectorAll(".listing-section");
      listingSections.forEach((section) => listingObserver.unobserve(section));
    };
  }, [filteredListings]);


  // Fetch listings from Firestore
  useEffect(() => {
    const fetchListings = async () => {
      try {
        setLoading(true);
        console.log("Fetching listings...");
        
        // Fetch all active listings
        const q = query(
          collection(db, "listings"),
          where("status", "==", "active")
        );

        console.log("Query created, fetching...");
        const querySnapshot = await getDocs(q);
        console.log("Query snapshot received, docs count:", querySnapshot.size);
        
        const listingsData = [];
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          console.log("Found listing:", doc.id, data);
          listingsData.push({
            id: doc.id,
            ...data,
          });
        });
        
        // Sort by newest first
        listingsData.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return dateB - dateA;
        });
        
        console.log("Listings data:", listingsData);
        setListings(listingsData); // Store all active listings
        setFilteredListings(listingsData); // Initialize filtered listings
      } catch (error) {
        console.error("Error fetching listings:", error);
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        
        // If permission denied, show helpful message
        if (error.code === "permission-denied") {
          console.error("❌ Permission denied. Please check Firestore security rules.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, []);

  // Filter listings based on category, search, dates, and guests
  useEffect(() => {
    if (!listings || listings.length === 0) {
      setFilteredListings([]);
      return;
    }

    let filtered = [...listings];
    
    // Filter by category - be explicit and exclusive
    if (selectedCategory === "homes") {
      // Homes = places with placeType, category === "place", or legacy categories (resort, hotel, transient)
      // BUT NOT experiences or services
      filtered = filtered.filter(listing => {
        const hasActivityType = listing.activityType && listing.activityType.trim() !== "";
        const hasServiceType = listing.serviceType && listing.serviceType.trim() !== "";
        const isExperience = listing.category === "experience" || hasActivityType;
        const isService = listing.category === "service" || hasServiceType;
        
        // Exclude experiences and services
        if (isExperience || isService) {
          return false;
        }
        
        // Include if it's a home/place
        return listing.placeType ||
               listing.category === "place" ||
               listing.category === "resort" ||
               listing.category === "hotel" ||
               listing.category === "transient";
      });
    } else if (selectedCategory === "experiences") {
      // Experiences = listings with activityType or category === "experience"
      // BUT NOT services or homes (without activityType)
      filtered = filtered.filter(listing => {
        const hasActivityType = listing.activityType && listing.activityType.trim() !== "";
        const hasServiceType = listing.serviceType && listing.serviceType.trim() !== "";
        const hasPlaceTypeOnly = listing.placeType && !hasActivityType && !hasServiceType;
        const isService = listing.category === "service" || hasServiceType;
        
        // Exclude services and homes without activityType
        if (isService || (hasPlaceTypeOnly && !hasActivityType)) {
          return false;
        }
        
        // Include if it's an experience
        return hasActivityType || 
               listing.category === "experience" ||
               (listing.experiences && Array.isArray(listing.experiences) && listing.experiences.length > 0);
      });
    } else if (selectedCategory === "services") {
      // Services = listings with serviceType or category === "service"
      // BUT NOT experiences or homes (without serviceType)
      filtered = filtered.filter(listing => {
        const hasActivityType = listing.activityType && listing.activityType.trim() !== "";
        const hasServiceType = listing.serviceType && listing.serviceType.trim() !== "";
        const hasPlaceTypeOnly = listing.placeType && !hasActivityType && !hasServiceType;
        const isExperience = listing.category === "experience" || hasActivityType;
        
        // Exclude experiences and homes without serviceType
        if (isExperience || (hasPlaceTypeOnly && !hasServiceType)) {
          return false;
        }
        
        // Include if it's a service
        return hasServiceType || 
               listing.category === "service" ||
               (listing.services && Array.isArray(listing.services) && listing.services.length > 0);
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((listing) => {
        const title = (listing.title || "").toLowerCase();
        const location = (listing.location || "").toLowerCase();
        const description = (listing.description || "").toLowerCase();
        return title.includes(query) || location.includes(query) || description.includes(query);
      });
    }

    // Filter by guest capacity
    if (guests > 0) {
      filtered = filtered.filter(listing => {
        const maxGuests = listing.maxGuests || 1;
        return maxGuests >= guests;
      });
    }

    // Filter by date availability
    if (checkIn && checkOut && unavailableListings.size > 0) {
      filtered = filtered.filter(listing => !unavailableListings.has(listing.id));
    }

    setFilteredListings(filtered);
  }, [listings, selectedCategory, searchQuery, guests, checkIn, checkOut, unavailableListings]);


  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Don't show loading screen while AuthContext is still loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#1C1C1E] font-light">Loading...</div>
      </div>
    );
  }

  // Note: Removed auto-redirect to host dashboard - let users navigate manually
  // If you want hosts to see HostHomePage by default, they can click "Switch to Hosting" button

  return (
    <div className="bg-white">
      <Header />

      {/* Hero Video Section - Apple Style */}
      <div className="relative w-full h-screen flex items-center justify-center overflow-hidden bg-black">
        {/* Fallback gradient background - always visible for smooth transition */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1C1C1E] via-[#2C2C2E] to-[#1C1C1E] z-0"></div>
        
        {/* Video Background */}
        <HeroVideo />
        
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60 z-[1]"></div>
        
        {/* Hero Content */}
        <div ref={heroRef} className="relative z-10 text-center px-4 sm:px-6 max-w-4xl mx-auto hero-text-container">
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-light text-white tracking-tight">
            Voyago
          </h1>
          <p className="text-xl sm:text-2xl md:text-3xl lg:text-4xl text-white/90 font-light tracking-tight">
            Find your perfect stay
          </p>
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-white/80 font-light mb-[10px] max-w-2xl mx-auto leading-relaxed">
            Discover unique places to stay and experiences around the world
          </p>
          
          {/* CTA Buttons */}
          <div className="hero-cta-buttons flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center mt-6 sm:mt-8">
            <Link
              to="#listings"
              onClick={(e) => {
                e.preventDefault();
                const listingsSection = document.querySelector('.listing-section');
                if (listingsSection) {
                  listingsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className="group relative px-6 sm:px-8 py-3 sm:py-3.5 bg-[#0071E3] text-white rounded-full text-sm sm:text-base font-medium hover:bg-[#0051D0] transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transform"
            >
              <span className="relative z-10 flex items-center justify-center gap-1.5 sm:gap-2">
                Explore
                <svg className="w-4 h-4 sm:w-4.5 sm:h-4.5 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </Link>
            {currentUser && userRoles && userRoles.includes("host") ? (
              <Link
                to="/host/listings"
                className="group relative px-6 sm:px-8 py-3 sm:py-3.5 bg-white/10 backdrop-blur-md border border-white/30 text-white rounded-full text-sm sm:text-base font-medium hover:bg-white/20 hover:border-white/50 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transform"
              >
                <span className="relative z-10 flex items-center justify-center gap-1.5 sm:gap-2">
                  Switch to Hosting
                  <svg className="w-4 h-4 sm:w-4.5 sm:h-4.5 transform group-hover:rotate-12 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </span>
              </Link>
            ) : (
              <Link
                to={currentUser ? "/host/onboarding" : "/login"}
                className="group relative px-6 sm:px-8 py-3 sm:py-3.5 bg-white/10 backdrop-blur-md border border-white/30 text-white rounded-full text-sm sm:text-base font-medium hover:bg-white/20 hover:border-white/50 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transform"
              >
                <span className="relative z-10 flex items-center justify-center gap-1.5 sm:gap-2">
                  Become A Host
                  <svg className="w-4 h-4 sm:w-4.5 sm:h-4.5 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </span>
              </Link>
            )}
          </div>
        </div>
        
        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10 animate-bounce">
          <svg className="w-6 h-6 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </div>

      {/* Search & Navigation Section - Airbnb Style - FIXED */}
      <div className="search-nav-section bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm" style={{ position: 'relative', overflow: 'visible' }}>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6" style={{ overflow: 'visible' }}>
          {/* Category Navigation Tabs - Centered */}
          <div className="category-filters flex flex-wrap justify-center items-center gap-2 sm:gap-3 md:gap-4 relative mb-2">
            {/* Animated Underline - Moves to selected button */}
            {underlineStyle.width > 0 && (
              <div 
                className="absolute bottom-0 h-1 bg-[#0071E3] rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${underlineStyle.width}px`,
                  left: `${underlineStyle.left}px`
                }}
              />
            )}
            
            <button
              ref={homesButtonRef}
              onClick={() => setSelectedCategory("homes")}
              className={`flex items-center gap-2.5 sm:gap-3 px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 md:py-3.5 text-sm sm:text-base md:text-lg font-semibold relative transition-all duration-300 rounded-xl ${
                selectedCategory === "homes" 
                  ? "bg-[#0071E3]/10 text-[#0071E3]" 
                  : "text-[#8E8E93] hover:text-[#1C1C1E] hover:bg-gray-100"
              }`}
            >
              <div className={`w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${
                selectedCategory === "homes" 
                  ? "bg-[#0071E3]/20" 
                  : "bg-gray-100"
              }`}>
                <svg className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" viewBox="0 0 24 24" fill="none">
                  {/* House body - light grey */}
                  <rect x="6" y="11" width="12" height="9" fill={selectedCategory === "homes" ? "#0071E3" : "#D1D1D6"}/>
                  {/* Roof - dark grey */}
                  <path d="M3 11l9-8 9 8H3z" fill={selectedCategory === "homes" ? "#0051D0" : "#8E8E93"}/>
                  {/* Door - red */}
                  <rect x="10" y="16" width="4" height="4" fill={selectedCategory === "homes" ? "#FF3B30" : "#FF3B30"}/>
                  {/* Bushes */}
                  <circle cx="9" cy="20" r="1.5" fill={selectedCategory === "homes" ? "#34C759" : "#34C759"}/>
                  <circle cx="15" cy="20" r="1.5" fill={selectedCategory === "homes" ? "#34C759" : "#34C759"}/>
                  {/* Tree */}
                  <circle cx="18" cy="18" r="2" fill={selectedCategory === "homes" ? "#30D158" : "#30D158"}/>
                  {/* Chimney */}
                  <rect x="7" y="7" width="2" height="4" fill={selectedCategory === "homes" ? "#1C1C1E" : "#1C1C1E"}/>
                </svg>
              </div>
              <span className="whitespace-nowrap">Homes</span>
            </button>
            
            <button
              ref={experiencesButtonRef}
              onClick={() => setSelectedCategory("experiences")}
              className={`flex items-center gap-2.5 sm:gap-3 px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 md:py-3.5 text-sm sm:text-base md:text-lg font-semibold relative transition-all duration-300 rounded-xl ${
                selectedCategory === "experiences" 
                  ? "bg-[#0071E3]/10 text-[#0071E3]" 
                  : "text-[#8E8E93] hover:text-[#1C1C1E] hover:bg-gray-100"
              }`}
            >
              <div className={`w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${
                selectedCategory === "experiences" 
                  ? "bg-[#0071E3]/20" 
                  : "bg-gray-100"
              }`}>
                <svg className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" viewBox="0 0 24 24" fill="none">
                  {/* Hot air balloon - red and orange */}
                  <ellipse cx="12" cy="8" rx="7" ry="6" fill="#FF385C"/>
                  <ellipse cx="12" cy="8" rx="5" ry="4" fill="#FF6B35"/>
                  {/* Basket - light brown */}
                  <rect x="10" y="14" width="4" height="3" rx="0.5" fill="#D4A574"/>
                  {/* Ropes */}
                  <line x1="9" y1="12" x2="10" y2="14" stroke="#8E8E93" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="15" y1="12" x2="15" y2="14" stroke="#8E8E93" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <span className="whitespace-nowrap">Experiences</span>
            </button>
            
            <button
              ref={servicesButtonRef}
              onClick={() => setSelectedCategory("services")}
              className={`flex items-center gap-2.5 sm:gap-3 px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 md:py-3.5 text-sm sm:text-base md:text-lg font-semibold relative transition-all duration-300 rounded-xl ${
                selectedCategory === "services" 
                  ? "bg-[#0071E3]/10 text-[#0071E3]" 
                  : "text-[#8E8E93] hover:text-[#1C1C1E] hover:bg-gray-100"
              }`}
            >
              <div className={`w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${
                selectedCategory === "services" 
                  ? "bg-[#0071E3]/20" 
                  : "bg-gray-100"
              }`}>
                <svg className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" viewBox="0 0 24 24" fill="none">
                  {/* Bell - silver/grey */}
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 3 9.75 3 9.75h8s3-4.5 3-9.75c0-3.87-3.13-7-7-7z" fill="#C7C7CC"/>
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 3 9.75 3 9.75h8s3-4.5 3-9.75c0-3.87-3.13-7-7-7z" fill="#E5E5EA" opacity="0.5"/>
                  {/* Bell base - dark grey */}
                  <rect x="10" y="19" width="4" height="2" fill="#8E8E93"/>
                  {/* Clapper */}
                  <circle cx="12" cy="12" r="1" fill="#8E8E93"/>
                </svg>
              </div>
              <span className="whitespace-nowrap">Services</span>
            </button>
          </div>

          {/* Search & Filter Bar - Web Style */}
          <div className="flex justify-center search-bar-container mt-6 sm:mt-8" style={{ overflow: 'visible', position: 'relative' }}>
            <div className="w-full max-w-5xl px-3 sm:px-4 md:px-6" style={{ overflow: 'visible', position: 'relative' }}>
              <div 
                className={`flex flex-col md:flex-row items-stretch md:items-center bg-white rounded-3xl shadow-2xl border border-gray-100 transition-all duration-300 ease-out ${
                  focusedField ? 'shadow-2xl ring-4 ring-[#0071E3]/10 scale-[1.01]' : 'hover:shadow-2xl hover:border-gray-200'
                }`}
                style={{ overflow: 'visible' }}
              >
                {/* Where - Location Search with Icon */}
                <div 
                  className={`flex-1 relative min-w-0 transition-all duration-300 ${
                    focusedField === 'where' ? 'bg-[#0071E3]/5' : ''
                  }`}
                  onClick={() => setFocusedField('where')}
                >
                  {/* Right Divider */}
                  <div className="absolute right-0 top-4 bottom-4 w-px bg-gray-200 hidden md:block"></div>
                  <div className="px-5 sm:px-6 md:px-8 py-4 sm:py-5 cursor-pointer hover:bg-gray-50/50 transition-all duration-200 rounded-t-3xl md:rounded-t-none md:rounded-l-3xl">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                        focusedField === 'where' || searchQuery ? 'bg-[#0071E3]/10' : 'bg-gray-100'
                      }`}>
                        <svg 
                          className={`w-5 h-5 flex-shrink-0 transition-all duration-300 ${
                            focusedField === 'where' || searchQuery ? 'text-[#0071E3]' : 'text-[#8E8E93]'
                          }`}
                          fill="none" 
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          placeholder="Where are you going?"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onFocus={() => setFocusedField('where')}
                          onBlur={() => setTimeout(() => setFocusedField(null), 200)}
                          className="search-where-input w-full text-base sm:text-lg text-[#1C1C1E] placeholder:text-[#8E8E93] focus:outline-none bg-transparent font-light transition-all duration-200"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Available Dates - Single Calendar Input */}
                <div 
                  className={`flex-1 relative min-w-0 transition-all duration-300 border-t md:border-t-0 border-gray-100 md:border-none ${
                    focusedField === 'dates' || showDatePicker ? 'bg-[#0071E3]/5' : ''
                  }`}
                  style={{ zIndex: showDatePicker ? 50 : 'auto' }}
                >
                  {/* Left Divider */}
                  <div className="absolute left-0 top-4 bottom-4 w-px bg-gray-200 hidden md:block"></div>
                  {/* Right Divider */}
                  <div className="absolute right-0 top-4 bottom-4 w-px bg-gray-200 hidden md:block"></div>
                  <div 
                    className="px-5 sm:px-6 md:px-8 py-4 sm:py-5 cursor-pointer hover:bg-gray-50/50 transition-all duration-200"
                    onClick={() => {
                      if (!showDatePicker) {
                        // Initialize calendar to show current month or selected date's month
                        if (checkIn) {
                          const checkInDate = new Date(checkIn + 'T00:00:00');
                          setCalendarMonth(new Date(checkInDate.getFullYear(), checkInDate.getMonth(), 1));
                        } else {
                          setCalendarMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
                        }
                      }
                      setShowDatePicker(!showDatePicker);
                      setFocusedField('dates');
                    }}
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                        focusedField === 'dates' || showDatePicker || checkIn || checkOut ? 'bg-[#0071E3]/10' : 'bg-gray-100'
                      }`}>
                        <svg 
                          className={`w-5 h-5 flex-shrink-0 transition-all duration-300 ${
                            focusedField === 'dates' || showDatePicker || checkIn || checkOut ? 'text-[#0071E3]' : 'text-[#8E8E93]'
                          }`}
                          fill="none" 
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <label className="block text-[10px] sm:text-xs font-bold text-[#1C1C1E] mb-1.5 uppercase tracking-widest">
                          Available Dates
                        </label>
                        <span className={`text-base sm:text-lg font-medium transition-all duration-200 block ${
                          checkIn || checkOut ? 'text-[#1C1C1E]' : 'text-[#8E8E93]'
                        }`}>
                          {checkIn || checkOut ? formatDateRangeDisplay() : 'Add dates'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Date Picker Modal - Custom Calendar */}
                  {showDatePicker && (
                    <>
                      <div 
                        className="fixed inset-0 bg-transparent z-40" 
                        onClick={() => {
                          setShowDatePicker(false);
                          setFocusedField(null);
                        }}
                        style={{ 
                          animation: 'fadeIn 0.2s ease-out',
                        }}
                      ></div>
                      <div 
                        className="absolute left-0 md:left-auto right-0 md:right-auto top-full mt-3 w-full md:w-auto min-w-[340px] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-visible z-50 animate-slideDownFadeIn"
                        onClick={(e) => e.stopPropagation()}
                        style={{ zIndex: 50 }}
                      >
                        <div className="p-5 sm:p-6">
                          {/* Calendar Header */}
                          <div className="flex items-center justify-between mb-4">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePreviousMonth();
                              }}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-200"
                            >
                              <svg className="w-5 h-5 text-[#1C1C1E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                              </svg>
                            </button>
                            <h3 className="text-base font-semibold text-[#1C1C1E]">
                              {calendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                            </h3>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNextMonth();
                              }}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-200"
                            >
                              <svg className="w-5 h-5 text-[#1C1C1E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </div>

                          {/* Calendar Days Header */}
                          <div className="grid grid-cols-7 gap-1 mb-2">
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                              <div key={index} className="text-center text-xs font-semibold text-[#8E8E93] py-2">
                                {day}
                              </div>
                            ))}
                          </div>

                          {/* Calendar Grid */}
                          <div className="grid grid-cols-7 gap-1">
                            {(() => {
                              const daysInMonth = getDaysInMonth(calendarMonth);
                              const firstDay = getFirstDayOfMonth(calendarMonth);
                              const days = [];
                              
                              // Add empty cells for days before the first day of the month
                              for (let i = 0; i < firstDay; i++) {
                                days.push(null);
                              }
                              
                              // Add all days of the month
                              for (let day = 1; day <= daysInMonth; day++) {
                                const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
                                days.push(date);
                              }
                              
                              return days.map((date, index) => {
                                if (!date) {
                                  return <div key={index} className="aspect-square"></div>;
                                }
                                
                                const disabled = isDateDisabled(date);
                                const isStart = selectedStartDate && isSameDate(date, selectedStartDate);
                                const isEnd = selectedEndDate && isSameDate(date, selectedEndDate);
                                const inRange = selectedStartDate && selectedEndDate && isDateInRange(date, selectedStartDate, selectedEndDate);
                                const isToday = isSameDate(date, new Date());
                                
                                return (
                                  <button
                                    key={index}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDateClick(date);
                                    }}
                                    disabled={disabled}
                                    className={`aspect-square text-sm font-light rounded-lg transition-all duration-200 ${
                                      disabled
                                        ? 'text-gray-300 cursor-not-allowed'
                                        : isStart || isEnd
                                        ? 'bg-[#0071E3] text-white font-medium'
                                        : inRange
                                        ? 'bg-[#0071E3]/10 text-[#0071E3]'
                                        : isToday
                                        ? 'bg-gray-100 text-[#1C1C1E] font-medium'
                                        : 'text-[#1C1C1E] hover:bg-gray-100'
                                    }`}
                                  >
                                    {date.getDate()}
                                  </button>
                                );
                              });
                            })()}
                          </div>

                          {/* Clear and Cancel Buttons */}
                          <div className="mt-4 flex gap-2">
                            {(checkIn || checkOut) && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleClearDates();
                                }}
                                className="flex-1 px-4 py-2.5 text-[#8E8E93] rounded-xl text-sm font-medium hover:bg-gray-100 transition-all duration-200"
                              >
                                Clear
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowDatePicker(false);
                                setFocusedField(null);
                              }}
                              className={`${(checkIn || checkOut) ? 'flex-1' : 'w-full'} px-4 py-2.5 text-[#0071E3] rounded-xl text-sm font-medium hover:bg-[#0071E3]/10 transition-all duration-200`}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Guests - Dropdown */}
                <div 
                  className={`flex-1 relative min-w-0 transition-all duration-300 border-t md:border-t-0 border-gray-100 md:border-none ${
                    focusedField === 'guests' || showGuestMenu ? 'bg-[#0071E3]/5' : ''
                  }`}
                  style={{ zIndex: showGuestMenu ? 50 : 'auto' }}
                >
                  {/* Left Divider */}
                  <div className="absolute left-0 top-4 bottom-4 w-px bg-gray-200 hidden md:block"></div>
                  <div 
                    className="px-5 sm:px-6 md:px-8 py-4 sm:py-5 cursor-pointer hover:bg-gray-50/50 transition-all duration-200 rounded-b-3xl md:rounded-b-none md:rounded-r-3xl"
                    onClick={() => {
                      setShowGuestMenu(!showGuestMenu);
                      setFocusedField('guests');
                    }}
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                        focusedField === 'guests' || showGuestMenu || guests > 1 ? 'bg-[#0071E3]/10' : 'bg-gray-100'
                      }`}>
                        <svg 
                          className={`w-5 h-5 flex-shrink-0 transition-all duration-300 ${
                            focusedField === 'guests' || showGuestMenu || guests > 1 ? 'text-[#0071E3]' : 'text-[#8E8E93]'
                          }`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <label className="block text-[10px] sm:text-xs font-bold text-[#1C1C1E] mb-1.5 uppercase tracking-widest">
                          Guests
                        </label>
                        <div className="flex items-center justify-between">
                          <span className={`text-base sm:text-lg font-medium transition-all duration-200 ${
                            guests > 1 ? 'text-[#1C1C1E]' : 'text-[#8E8E93]'
                          }`}>
                            {guests === 1 ? 'Add guests' : `${guests} ${guests === 1 ? 'guest' : 'guests'}`}
                          </span>
                          {(guests > 1 || showGuestMenu) && (
                            <svg 
                              className={`w-5 h-5 text-[#8E8E93] transition-all duration-300 ${showGuestMenu ? 'rotate-180' : ''}`}
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Guest Menu Dropdown - List of Options */}
                  {showGuestMenu && (
                    <>
                      <div 
                        className="fixed inset-0 bg-transparent z-40" 
                        onClick={() => {
                          setShowGuestMenu(false);
                          setFocusedField(null);
                        }}
                        style={{ 
                          animation: 'fadeIn 0.2s ease-out',
                        }}
                      ></div>
                      <div 
                        className="absolute right-0 md:right-auto left-0 md:left-auto top-full mt-3 w-full md:w-72 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-visible z-50 animate-slideDownFadeIn"
                        onClick={(e) => e.stopPropagation()}
                        style={{ zIndex: 50 }}
                      >
                        <div className="py-2">
                          {[1, 2, 3, 4, 5, 6].map((num) => (
                            <button
                              key={num}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setGuests(num);
                                setShowGuestMenu(false);
                                setFocusedField(null);
                              }}
                              className={`w-full px-4 sm:px-6 py-3 text-left transition-all duration-200 text-sm sm:text-base ${
                                guests === num
                                  ? 'bg-[#0071E3] text-white font-medium'
                                  : 'text-[#1C1C1E] hover:bg-gray-50 font-light'
                              }`}
                            >
                              {num === 6 ? `${num}+ guests` : `${num} ${num === 1 ? 'guest' : 'guests'}`}
                            </button>
                          ))}
                        </div>
                        <div className="px-4 sm:px-6 py-2 border-t border-gray-200">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowGuestMenu(false);
                              setFocusedField(null);
                            }}
                            className="w-full px-4 py-2.5 text-[#0071E3] rounded-xl text-sm sm:text-base font-medium hover:bg-[#0071E3]/10 transition-all duration-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Search Button - Inline on Desktop, Bottom on Mobile */}
                <div className="p-3 sm:p-4 md:p-4 flex items-center justify-center md:flex-shrink-0 border-t md:border-t-0 border-gray-100 md:border-none">
                  <button
                    type="button"
                    className="flex items-center justify-center gap-2 w-full md:w-auto px-6 md:px-4 md:w-14 md:h-14 lg:w-16 lg:h-16 bg-gradient-to-r from-[#0071E3] to-[#0051D0] text-white rounded-full hover:from-[#0051D0] hover:to-[#003D9E] transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transform py-4 md:py-0 group"
                    aria-label="Search"
                    onClick={() => {
                      // Scroll to listings or trigger search/filter
                      const listingsSection = document.querySelector('.listing-section');
                      if (listingsSection) {
                        listingsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }}
                  >
                    <svg
                      className="w-5 h-5 sm:w-6 sm:h-6 md:w-6 lg:w-7 transition-transform duration-300 group-hover:scale-110"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span className="md:hidden ml-2 text-base sm:text-lg font-semibold">Search</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Section - Airbnb Style Listings */}
      <div id="listings" className="listings-section px-3 sm:px-4 md:px-6 py-6 sm:py-8 md:py-12 bg-white">
        <div className="w-full max-w-6xl mx-auto">
          {/* Category Title */}
          <div key={selectedCategory} className="category-header mb-6 sm:mb-8 animate-fadeInUp">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold text-[#1C1C1E] break-words mb-2 sm:mb-3">
              {selectedCategory === "homes" && "Explore Homes"}
              {selectedCategory === "experiences" && "Featured Experiences"} 
              {selectedCategory === "services" && "Premium Services"}
            </h2>
            <p className="text-sm sm:text-base text-[#717171] break-words">
              {selectedCategory === "homes" && "Discover comfortable places to stay"}
              {selectedCategory === "experiences" && "Unique activities hosted by locals"}
              {selectedCategory === "services" && "Additional services for your stay"}
            </p>
          </div>

          {/* Listings Display */}
          {loading ? (
            <div className="text-center py-20">
              <div className="text-[#1C1C1E]/50 font-light">Loading listings...</div>
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-5xl sm:text-6xl mb-4">🏠</div>
              <h2 className="text-2xl sm:text-3xl font-light text-[#1C1C1E] mb-2">
                {listings.length === 0 ? "No listings found" : "No listings match your search"}
              </h2>
              <p className="text-[#1C1C1E]/70 font-light mb-4">
                {listings.length === 0 
                  ? "Be the first to create a listing!" 
                  : "Try adjusting your filters or search terms"}
              </p>
              {currentUser && userRole === "host" && listings.length === 0 && (
                <Link
                  to="/host/create-listing"
                  className="inline-block mt-6 bg-[#0071E3] text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full text-sm sm:text-base font-medium hover:bg-[#0051D0] transition-all shadow-md hover:shadow-lg"
                >
                  Create Listing
                </Link>
              )}
            </div>
          ) : (
            <>
              {/* Listings - Horizontal scroll on mobile, grid on desktop */}
              <div className="listing-section">
                {/* Mobile: Horizontal Scroll */}
                <div className="flex sm:hidden gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 mb-8">
                  {filteredListings.map((listing) => (
                    <div key={listing.id} className="flex-shrink-0 w-[280px]">
                      <ListingCard listing={listing} currentUser={currentUser} selectedCategory={selectedCategory} />
                    </div>
                  ))}
                </div>
                
                {/* Desktop: Grid */}
                <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8">
                  {filteredListings.map((listing) => (
                    <ListingCard key={listing.id} listing={listing} currentUser={currentUser} selectedCategory={selectedCategory} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer - Apple Style */}
      <footer className="bg-[#1C1C1E] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-12 md:pt-16 pb-8 sm:pb-10 footer-inner">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10 md:gap-12 lg:gap-16">
            {/* Logo and Brand */}
            <div className="flex flex-col items-center sm:items-start footer-column">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight mb-3 sm:mb-4 text-white">
                Voyago
              </h2>
              <p className="text-[#8E8E93] text-sm sm:text-base font-light leading-relaxed max-w-sm text-center sm:text-left break-words">
                Discover unique places to stay and experiences around the world.
              </p>
            </div>

            {/* Quick Links */}
            <div className="footer-column text-center sm:text-left">
              <h3 className="text-[#0071E3] font-semibold mb-4 sm:mb-5 text-base sm:text-lg">Quick Links</h3>
              <ul className="space-y-2 sm:space-y-3">
                <li>
                  <a href="/" className="text-white/80 hover:text-white transition-colors duration-200 text-sm sm:text-base font-light block py-0.5 break-words">
                    Home
                  </a>
                </li>
                <li>
                  <a href="#listings" className="text-white/80 hover:text-white transition-colors duration-200 text-sm sm:text-base font-light block py-0.5 break-words">
                    Explore
                  </a>
                </li>
                <li>
                  <a href="/chat" className="text-white/80 hover:text-white transition-colors duration-200 text-sm sm:text-base font-light block py-0.5 break-words">
                    Message
                  </a>
                </li>
                <li>
                  <a href="/guest/dashboard" className="text-white/80 hover:text-white transition-colors duration-200 text-sm sm:text-base font-light block py-0.5 break-words">
                    My Bookings
                  </a>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div className="footer-column text-center sm:text-left">
              <h3 className="text-[#0071E3] font-semibold mb-4 sm:mb-5 text-base sm:text-lg">Contact</h3>
              <ul className="space-y-2 sm:space-y-3">
                <li className="flex items-center justify-center sm:justify-start gap-2 sm:gap-3">
                  <svg className="w-5 h-5 text-[#0071E3] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="text-white/80 text-sm sm:text-base font-light break-words">+1 (555) 123-4567</span>
                </li>
                <li className="flex items-center justify-center sm:justify-start gap-2 sm:gap-3">
                  <svg className="w-5 h-5 text-[#0071E3] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="text-white/80 text-sm sm:text-base font-light break-words">support@voyago.com</span>
                </li>
                <li className="flex items-center justify-center sm:justify-start gap-2 sm:gap-3">
                  <svg className="w-5 h-5 text-[#0071E3] flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  <span className="text-white/80 text-sm sm:text-base font-light break-words">Facebook</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Separator */}
          <div className="border-t border-white/10 mt-10 sm:mt-12 md:mt-16 pt-6 sm:pt-8 md:pt-10 copyright-section">
            <p className="text-center text-white/60 text-xs sm:text-sm md:text-base font-light break-words">
              © 2025 Voyago. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default Home;