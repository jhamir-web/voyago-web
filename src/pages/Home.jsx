import React, { useEffect, useState, useRef, useMemo, useLayoutEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { collection, getDocs, query, where, orderBy, doc, addDoc, deleteDoc, onSnapshot, getDoc } from "firebase/firestore";
import { HERO_VIDEO_URL, getCloudinaryVideoUrl, cloudinaryConfig } from "../config/cloudinary";
import Header from "../components/Header";
import HostHomePage from "./host/HostHomePage";

// Listing Card Component - Apple Style
const ListingCard = ({ listing, currentUser }) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteId, setFavoriteId] = useState(null);
  const [rating, setRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);

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
  
  const handleFavoriteClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!currentUser) {
      // Redirect to login if not authenticated
      window.location.href = "/login";
      return;
    }

    try {
      if (isFavorite && favoriteId) {
        // Remove from favorites
        await deleteDoc(doc(db, "favorites", favoriteId));
        setIsFavorite(false);
        setFavoriteId(null);
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
        
        {/* Guest Favorite Badge */}
        <div className="absolute top-4 left-4 transform transition-transform duration-300 group-hover:scale-105">
          <span className="px-3 py-1.5 bg-white/95 backdrop-blur-md rounded-lg text-xs font-medium text-[#1C1C1E] shadow-lg">
            Guest favorite
          </span>
        </div>
        
        {/* Heart Icon */}
        <button
          onClick={handleFavoriteClick}
          className="absolute top-4 right-4 p-2.5 bg-white/90 backdrop-blur-md rounded-full hover:bg-white transition-all duration-300 shadow-lg z-10 transform hover:scale-110"
          aria-label="Add to favorites"
        >
          <svg
            className={`w-5 h-5 transition-all duration-300 ${
              isFavorite ? "fill-red-500 text-red-500 scale-110" : "text-[#1C1C1E]"
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

        {/* Category Badge */}
        {listing.category && (
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
  const [recommendedListings, setRecommendedListings] = useState([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);

  // Format date for display
  const formatDateDisplay = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };
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

  // Fetch and calculate recommendations based on booking history
  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!currentUser || userRole !== "guest") {
        setRecommendedListings([]);
        return;
      }

      try {
        setRecommendationsLoading(true);
        
        // Fetch guest's previous bookings
        const bookingsQuery = query(
          collection(db, "bookings"),
          where("guestId", "==", currentUser.uid),
          where("status", "in", ["confirmed", "completed"])
        );
        const bookingsSnapshot = await getDocs(bookingsQuery);
        
        if (bookingsSnapshot.empty) {
          setRecommendedListings([]);
          setRecommendationsLoading(false);
          return;
        }

        const bookings = bookingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Extract preferences from bookings
        const preferences = {
          categories: {}, // place, service, experience
          subcategories: {}, // resort, hotel, transient (for places)
          placeTypes: {}, // House, Cabin, Apartment, etc.
          serviceTypes: {}, // Photography, Catering, etc.
          activityTypes: {}, // Hiking, Food Tour, etc.
          locations: {},
          priceRange: { min: Infinity, max: 0, avg: 0 },
          amenities: new Set(),
          services: new Set(),
          bookedListingIds: new Set()
        };

        let totalPrice = 0;
        let priceCount = 0;

        bookings.forEach(booking => {
          // Track booked listings to exclude from recommendations
          if (booking.listingId) {
            preferences.bookedListingIds.add(booking.listingId);
          }

          // Get listing details to extract preferences
          // We'll fetch listing data for each booking
        });

        // Fetch listing details for each booking to get preferences
        const listingPromises = bookings.map(async (booking) => {
          if (!booking.listingId) return null;
          try {
            const listingDoc = await getDoc(doc(db, "listings", booking.listingId));
            if (listingDoc.exists()) {
              return { id: listingDoc.id, ...listingDoc.data() };
            }
          } catch (error) {
            console.error("Error fetching listing:", error);
          }
          return null;
        });

        const listingData = await Promise.all(listingPromises);
        const validListings = listingData.filter(l => l !== null);

        // Analyze preferences from listings
        validListings.forEach(listing => {
          // Main category preferences (place, service, experience)
          if (listing.category) {
            preferences.categories[listing.category] = (preferences.categories[listing.category] || 0) + 1;
          }

          // Subcategory preferences (resort, hotel, transient for places)
          if (listing.subcategory) {
            preferences.subcategories[listing.subcategory] = (preferences.subcategories[listing.subcategory] || 0) + 1;
          }

          // Place type preferences (House, Cabin, Apartment, etc.)
          if (listing.placeType) {
            preferences.placeTypes[listing.placeType] = (preferences.placeTypes[listing.placeType] || 0) + 1;
          }

          // Service type preferences (Photography, Catering, etc.)
          if (listing.serviceType) {
            preferences.serviceTypes[listing.serviceType] = (preferences.serviceTypes[listing.serviceType] || 0) + 1;
          }

          // Activity type preferences (Hiking, Food Tour, etc.)
          if (listing.activityType) {
            preferences.activityTypes[listing.activityType] = (preferences.activityTypes[listing.activityType] || 0) + 1;
          }

          // Location preferences (extract city/province from location)
          if (listing.location) {
            const locationParts = listing.location.split(',').map(s => s.trim());
            locationParts.forEach(part => {
              preferences.locations[part] = (preferences.locations[part] || 0) + 1;
            });
          }

          // Price range
          if (listing.price) {
            const price = parseFloat(listing.price);
            if (price > 0) {
              preferences.priceRange.min = Math.min(preferences.priceRange.min, price);
              preferences.priceRange.max = Math.max(preferences.priceRange.max, price);
              totalPrice += price;
              priceCount++;
            }
          }

          // Amenities
          if (listing.amenities && Array.isArray(listing.amenities)) {
            listing.amenities.forEach(amenity => preferences.amenities.add(amenity));
          }

          // Services
          if (listing.services && Array.isArray(listing.services)) {
            listing.services.forEach(service => preferences.services.add(service));
          }
        });

        // Calculate average price
        if (priceCount > 0) {
          preferences.priceRange.avg = totalPrice / priceCount;
        }

        // Find most preferred category
        const topCategory = Object.keys(preferences.categories).length > 0
          ? Object.keys(preferences.categories).reduce((a, b) => 
              preferences.categories[a] > preferences.categories[b] ? a : b
            )
          : null;

        // Find most preferred subcategory
        const topSubcategory = Object.keys(preferences.subcategories).length > 0
          ? Object.keys(preferences.subcategories).reduce((a, b) => 
              preferences.subcategories[a] > preferences.subcategories[b] ? a : b
            )
          : null;

        // Find most preferred place type
        const topPlaceType = Object.keys(preferences.placeTypes).length > 0
          ? Object.keys(preferences.placeTypes).reduce((a, b) => 
              preferences.placeTypes[a] > preferences.placeTypes[b] ? a : b
            )
          : null;

        // Find most preferred service type
        const topServiceType = Object.keys(preferences.serviceTypes).length > 0
          ? Object.keys(preferences.serviceTypes).reduce((a, b) => 
              preferences.serviceTypes[a] > preferences.serviceTypes[b] ? a : b
            )
          : null;

        // Find most preferred activity type
        const topActivityType = Object.keys(preferences.activityTypes).length > 0
          ? Object.keys(preferences.activityTypes).reduce((a, b) => 
              preferences.activityTypes[a] > preferences.activityTypes[b] ? a : b
            )
          : null;

        // Find most preferred location
        const topLocation = Object.keys(preferences.locations).length > 0
          ? Object.keys(preferences.locations).reduce((a, b) => 
              preferences.locations[a] > preferences.locations[b] ? a : b
            )
          : null;

        // Fetch all active listings
        const allListingsQuery = query(
          collection(db, "listings"),
          where("status", "==", "active")
        );
        const allListingsSnapshot = await getDocs(allListingsQuery);
        const allListings = allListingsSnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));

        // Score and rank listings based on preferences
        const scoredListings = allListings
          .filter(listing => !preferences.bookedListingIds.has(listing.id)) // Exclude already booked
          .map(listing => {
            let score = 0;

            // Main category match (highest weight - 35 points)
            if (topCategory && listing.category === topCategory) {
              score += 35;
            }

            // Subcategory match (for places - high weight - 25 points)
            if (topSubcategory && listing.subcategory === topSubcategory) {
              score += 25;
            }

            // Place type match (high weight - 20 points)
            if (topPlaceType && listing.placeType === topPlaceType) {
              score += 20;
            }

            // Service type match (high weight - 20 points)
            if (topServiceType && listing.serviceType === topServiceType) {
              score += 20;
            }

            // Activity type match (high weight - 20 points)
            if (topActivityType && listing.activityType === topActivityType) {
              score += 20;
            }

            // Location match (medium-high weight - 18 points)
            if (topLocation && listing.location && listing.location.includes(topLocation)) {
              score += 18;
            }

            // Price similarity (medium weight - 15 points)
            if (listing.price && preferences.priceRange.avg > 0) {
              const priceDiff = Math.abs(parseFloat(listing.price) - preferences.priceRange.avg);
              const priceRange = preferences.priceRange.max - preferences.priceRange.min || 1;
              const priceScore = Math.max(0, 15 * (1 - priceDiff / priceRange));
              score += priceScore;
            }

            // Amenities match (medium weight - 12 points)
            if (listing.amenities && Array.isArray(listing.amenities) && preferences.amenities.size > 0) {
              const matchingAmenities = listing.amenities.filter(a => preferences.amenities.has(a)).length;
              const amenityScore = (matchingAmenities / preferences.amenities.size) * 12;
              score += amenityScore;
            }

            // Services match (low weight - 8 points)
            if (listing.services && Array.isArray(listing.services) && preferences.services.size > 0) {
              const matchingServices = listing.services.filter(s => preferences.services.has(s)).length;
              const serviceScore = (matchingServices / preferences.services.size) * 8;
              score += serviceScore;
            }

            return { listing, score };
          })
          .filter(item => item.score > 0) // Only include listings with some match
          .sort((a, b) => b.score - a.score) // Sort by score descending
          .slice(0, 6) // Get top 6 recommendations
          .map(item => item.listing);

        setRecommendedListings(scoredListings);
      } catch (error) {
        console.error("Error fetching recommendations:", error);
        setRecommendedListings([]);
      } finally {
        setRecommendationsLoading(false);
      }
    };

    fetchRecommendations();
  }, [currentUser, userRole]);

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
    let filtered = [...listings];
    
    // Filter by category
    if (selectedCategory === "homes") {
      // Homes = resort, hotel, transient categories, or places with placeType
      filtered = filtered.filter(listing => 
        listing.category === "resort" || 
        listing.category === "hotel" || 
        listing.category === "transient" ||
        listing.placeType ||
        (listing.category === "place" && !listing.activityType && !listing.serviceType)
      );
    } else if (selectedCategory === "experiences") {
      // Experiences = listings with activityType or category === "experience"
      filtered = filtered.filter(listing => 
        listing.activityType || 
        listing.category === "experience" ||
        (listing.experiences && Array.isArray(listing.experiences) && listing.experiences.length > 0)
      );
    } else if (selectedCategory === "services") {
      // Services = listings with serviceType or category === "service"
      filtered = filtered.filter(listing => 
        listing.serviceType || 
        listing.category === "service" ||
        (listing.services && Array.isArray(listing.services) && listing.services.length > 0)
      );
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

    // Note: Date filtering would require checking bookings, which is more complex
    // For now, we'll just filter by category, search, and guests

    setFilteredListings(filtered);
  }, [listings, selectedCategory, searchQuery, guests]);


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
          <div className="hero-cta-buttons flex flex-col sm:flex-row gap-5 sm:gap-6 justify-center items-center">
            <Link
              to="#listings"
              onClick={(e) => {
                e.preventDefault();
                const listingsSection = document.querySelector('.listing-section');
                if (listingsSection) {
                  listingsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className="hero-cta-button bg-[#0071E3] text-white rounded-2xl text-base sm:text-lg font-medium hover:bg-[#0051D0] transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
            >
              Explore
            </Link>
            {currentUser && userRoles && userRoles.includes("host") ? (
              <Link
                to="/host/listings"
                className="hero-cta-button bg-[#FF9500] text-white rounded-2xl text-base sm:text-lg font-medium hover:bg-[#FF8500] transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
              >
                Switch to Hosting
              </Link>
            ) : (
              <Link
                to={currentUser ? "/host/onboarding" : "/login"}
                className="hero-cta-button bg-white/10 backdrop-blur-sm border border-white/30 text-white rounded-2xl text-base sm:text-lg font-medium hover:bg-white/20 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
              >
                Become A Host
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
          <div className="category-filters flex flex-wrap justify-center items-center gap-3 sm:gap-6 md:gap-8 relative pb-1">
            {/* Animated Underline - Moves to selected button */}
            {underlineStyle.width > 0 && (
              <div 
                className="absolute bottom-0 h-0.5 bg-[#1C1C1E] transition-all duration-500 ease-out"
                style={{
                  width: `${underlineStyle.width}px`,
                  left: `${underlineStyle.left}px`
                }}
              />
            )}
            
            <button
              ref={homesButtonRef}
              onClick={() => setSelectedCategory("homes")}
              className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-sm sm:text-base md:text-lg font-medium relative transition-colors duration-300"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8" viewBox="0 0 24 24" fill="none">
                {/* House body - light grey */}
                <rect x="6" y="11" width="12" height="9" fill="#D1D1D6"/>
                {/* Roof - dark grey */}
                <path d="M3 11l9-8 9 8H3z" fill="#8E8E93"/>
                {/* Door - red */}
                <rect x="10" y="16" width="4" height="4" fill="#FF3B30"/>
                {/* Bushes */}
                <circle cx="9" cy="20" r="1.5" fill="#34C759"/>
                <circle cx="15" cy="20" r="1.5" fill="#34C759"/>
                {/* Tree */}
                <circle cx="18" cy="18" r="2" fill="#30D158"/>
                {/* Chimney */}
                <rect x="7" y="7" width="2" height="4" fill="#1C1C1E"/>
              </svg>
              <span className={`font-semibold transition-colors duration-300 whitespace-nowrap ${selectedCategory === "homes" ? "text-[#1C1C1E]" : "text-[#717171]"}`}>
                Homes
              </span>
            </button>
            
            <button
              ref={experiencesButtonRef}
              onClick={() => setSelectedCategory("experiences")}
              className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-sm sm:text-base md:text-lg font-medium relative transition-colors duration-300"
            >
              <div className="relative">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8" viewBox="0 0 24 24" fill="none">
                  {/* Hot air balloon - red and orange */}
                  <ellipse cx="12" cy="8" rx="7" ry="6" fill="#FF385C"/>
                  <ellipse cx="12" cy="8" rx="5" ry="4" fill="#FF6B35"/>
                  {/* Basket - light brown */}
                  <rect x="10" y="14" width="4" height="3" rx="0.5" fill="#D4A574"/>
                  {/* Ropes */}
                  <line x1="9" y1="12" x2="10" y2="14" stroke="#8E8E93" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="15" y1="12" x2="15" y2="14" stroke="#8E8E93" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <span className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 bg-[#0071E3] text-white text-[7px] sm:text-[8px] font-bold px-1 sm:px-1.5 py-0.5 rounded-full shadow-sm">NEW</span>
              </div>
              <span className={`font-semibold transition-colors duration-300 whitespace-nowrap ${selectedCategory === "experiences" ? "text-[#1C1C1E]" : "text-[#717171]"}`}>
                Experiences
              </span>
            </button>
            
            <button
              ref={servicesButtonRef}
              onClick={() => setSelectedCategory("services")}
              className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-sm sm:text-base md:text-lg font-medium relative transition-colors duration-300"
            >
              <div className="relative">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8" viewBox="0 0 24 24" fill="none">
                  {/* Bell - silver/grey */}
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 3 9.75 3 9.75h8s3-4.5 3-9.75c0-3.87-3.13-7-7-7z" fill="#C7C7CC"/>
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 3 9.75 3 9.75h8s3-4.5 3-9.75c0-3.87-3.13-7-7-7z" fill="#E5E5EA" opacity="0.5"/>
                  {/* Bell base - dark grey */}
                  <rect x="10" y="19" width="4" height="2" fill="#8E8E93"/>
                  {/* Clapper */}
                  <circle cx="12" cy="12" r="1" fill="#8E8E93"/>
                </svg>
                <span className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 bg-[#0071E3] text-white text-[7px] sm:text-[8px] font-bold px-1 sm:px-1.5 py-0.5 rounded-full shadow-sm">NEW</span>
              </div>
              <span className={`font-semibold transition-colors duration-300 whitespace-nowrap ${selectedCategory === "services" ? "text-[#1C1C1E]" : "text-[#717171]"}`}>
                Services
              </span>
            </button>
          </div>

          {/* Search & Filter Bar - Apple Style */}
          <div className="flex justify-center search-bar-container mt-4 sm:mt-6" style={{ overflow: 'visible', position: 'relative' }}>
            <div className="w-full max-w-5xl px-2 sm:px-0" style={{ overflow: 'visible', position: 'relative' }}>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center bg-white border border-gray-200 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300" style={{ overflow: 'visible' }}>
                {/* Where - Location Search */}
                <div className="flex-1 border-b sm:border-b-0 sm:border-r border-gray-200 min-w-0">
                  <div className="px-4 sm:px-6 py-3 sm:py-4">
                    <label className="block text-xs font-semibold text-[#1C1C1E] mb-1.5 uppercase tracking-wide">
                      Where
                    </label>
                    <input
                      type="text"
                      placeholder="Search destinations"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="search-where-input w-full text-sm sm:text-base text-[#1C1C1E] placeholder:text-[#8E8E93] focus:outline-none bg-transparent font-light transition-all duration-200"
                    />
                  </div>
                </div>

                {/* Check-in Date */}
                <div className="flex-1 border-b sm:border-b-0 sm:border-r border-gray-200 min-w-0">
                  <label 
                    htmlFor="checkin-date"
                    className="block px-4 sm:px-6 py-3 sm:py-4 cursor-pointer hover:bg-gray-50 transition-all duration-200 group"
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById('checkin-date')?.showPicker?.() || document.getElementById('checkin-date')?.focus();
                    }}
                  >
                    <span className="block text-xs font-semibold text-[#1C1C1E] mb-1.5 uppercase tracking-wide">
                      Check in
                    </span>
                    <div className="relative">
                      <input
                        id="checkin-date"
                        type="date"
                        value={checkIn}
                        onChange={(e) => setCheckIn(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="absolute opacity-0 w-full h-full cursor-pointer"
                        style={{ zIndex: 1 }}
                      />
                      <span className={`text-sm sm:text-base font-light transition-all duration-200 ${checkIn ? 'text-[#1C1C1E]' : 'text-[#8E8E93]'}`}>
                        {checkIn ? formatDateDisplay(checkIn) : 'mm/dd/yyyy'}
                      </span>
                    </div>
                  </label>
                </div>

                {/* Check-out Date */}
                <div className="flex-1 border-b sm:border-b-0 sm:border-r border-gray-200 min-w-0">
                  <label 
                    htmlFor="checkout-date"
                    className="block px-4 sm:px-6 py-3 sm:py-4 cursor-pointer hover:bg-gray-50 transition-all duration-200 group"
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById('checkout-date')?.showPicker?.() || document.getElementById('checkout-date')?.focus();
                    }}
                  >
                    <span className="block text-xs font-semibold text-[#1C1C1E] mb-1.5 uppercase tracking-wide">
                      Check out
                    </span>
                    <div className="relative">
                      <input
                        id="checkout-date"
                        type="date"
                        value={checkOut}
                        onChange={(e) => setCheckOut(e.target.value)}
                        min={checkIn || new Date().toISOString().split('T')[0]}
                        className="absolute opacity-0 w-full h-full cursor-pointer"
                        style={{ zIndex: 1 }}
                      />
                      <span className={`text-sm sm:text-base font-light transition-all duration-200 ${checkOut ? 'text-[#1C1C1E]' : 'text-[#8E8E93]'}`}>
                        {checkOut ? formatDateDisplay(checkOut) : 'mm/dd/yyyy'}
                      </span>
                    </div>
                  </label>
                </div>

                {/* Guests - Dropdown */}
                <div className="flex-1 relative min-w-0" style={{ zIndex: showGuestMenu ? 50 : 'auto' }}>
                  <div 
                    className="px-4 sm:px-6 py-3 sm:py-4 cursor-pointer hover:bg-gray-50 transition-all duration-200 group"
                    onClick={() => setShowGuestMenu(!showGuestMenu)}
                  >
                    <span className="block text-xs font-semibold text-[#1C1C1E] mb-1.5 uppercase tracking-wide">
                      Guests
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-sm sm:text-base text-[#1C1C1E] font-light">
                        {guests} {guests === 1 ? 'guest' : 'guests'}
                      </span>
                      <svg 
                        className={`w-4 h-4 text-[#8E8E93] transition-all duration-300 ${showGuestMenu ? 'rotate-180' : ''} group-hover:text-[#1C1C1E]`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* Guest Menu Dropdown */}
                  {showGuestMenu && (
                    <>
                      <div 
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm" 
                        onClick={() => setShowGuestMenu(false)}
                        style={{ 
                          animation: 'fadeIn 0.2s ease-out',
                          zIndex: 40
                        }}
                      ></div>
                      <div 
                        className="absolute right-0 sm:right-auto left-0 sm:left-auto top-full mt-2 w-full sm:w-64 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-visible"
                        style={{ zIndex: 50 }}
                      >
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-sm font-semibold text-[#1C1C1E]">Adults</span>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setGuests(Math.max(1, guests - 1));
                                }}
                                className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:border-[#0071E3] hover:bg-[#0071E3]/10 transition-all duration-200 active:scale-95"
                              >
                                <svg className="w-4 h-4 text-[#1C1C1E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                </svg>
                              </button>
                              <span className="text-base font-medium text-[#1C1C1E] w-8 text-center">{guests}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setGuests(guests + 1);
                                }}
                                className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:border-[#0071E3] hover:bg-[#0071E3]/10 transition-all duration-200 active:scale-95"
                              >
                                <svg className="w-4 h-4 text-[#1C1C1E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowGuestMenu(false);
                            }}
                            className="w-full px-4 py-2.5 bg-[#0071E3] text-white rounded-xl text-sm font-medium hover:bg-[#0051D0] transition-colors duration-200 active:scale-95"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Search Button */}
                <div className="p-2 sm:p-4 flex-shrink-0">
                  <button
                    type="button"
                    className="flex items-center justify-center w-full sm:w-12 h-12 bg-[#0071E3] text-white rounded-xl hover:bg-[#0051D0] transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 active:scale-95"
                    aria-label="Search"
                    onClick={() => {
                      // Trigger search/filter
                      const input = document.querySelector('.search-where-input');
                      if (input) input.focus();
                    }}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations Section - Only show for guests with booking history */}
      {currentUser && userRole === "guest" && recommendedListings.length > 0 && (
        <div className="px-3 sm:px-4 md:px-6 py-6 sm:py-8 md:py-12 bg-gradient-to-br from-[#F5F5F7] to-white">
          <div className="w-full max-w-6xl mx-auto">
            <div className="mb-6 sm:mb-8">
              <div className="flex items-center gap-3 mb-2">
                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-[#0071E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold text-[#1C1C1E]">
                  Recommended for You
                </h2>
              </div>
              <p className="text-sm sm:text-base text-[#717171]">
                Based on your previous bookings and preferences
              </p>
            </div>

            {recommendationsLoading ? (
              <div className="text-center py-12">
                <div className="text-[#1C1C1E]/50 font-light">Loading recommendations...</div>
              </div>
            ) : (
              <div className="listing-section">
                {/* Mobile: Horizontal Scroll */}
                <div className="flex sm:hidden gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 mb-8">
                  {recommendedListings.map((listing) => (
                    <div key={listing.id} className="flex-shrink-0 w-[280px]">
                      <ListingCard listing={listing} currentUser={currentUser} />
                    </div>
                  ))}
                </div>

                {/* Desktop: Grid */}
                <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                  {recommendedListings.map((listing) => (
                    <ListingCard key={listing.id} listing={listing} currentUser={currentUser} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
                      <ListingCard listing={listing} currentUser={currentUser} />
                    </div>
                  ))}
                </div>
                
                {/* Desktop: Grid */}
                <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8">
                  {filteredListings.map((listing) => (
                    <ListingCard key={listing.id} listing={listing} currentUser={currentUser} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer - Apple Style */}
      <footer className="bg-[#1C1C1E] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 footer-inner">
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