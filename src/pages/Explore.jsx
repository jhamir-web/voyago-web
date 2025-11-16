import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { collection, getDocs, query, where, orderBy, doc, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import Header from "../components/Header";

// Listing Card Component
const ListingCard = ({ listing, index }) => {
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

  return (
    <Link
      to={`/listing/${listing.id}`}
      className="group block bg-white rounded-xl sm:rounded-2xl overflow-hidden border border-gray-200 shadow-md hover:shadow-2xl hover:border-gray-300 transition-all duration-500 ease-out cursor-pointer transform hover:-translate-y-2 w-full animate-fadeInUp"
      style={{ 
        transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
        willChange: 'transform, box-shadow',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        animationDelay: `${index * 0.1}s`,
        animationFillMode: 'both'
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

        {/* Category Badge - Show "Home" for resort/hotel/transient, otherwise show actual category */}
        {listing.category && (listing.category === "resort" || listing.category === "hotel" || listing.category === "transient" || listing.category === "homes") ? (
          <div className="mb-2 sm:mb-3">
            <span className="inline-block px-2 sm:px-2.5 py-0.5 sm:py-1 bg-[#0071E3]/10 text-[#0071E3] rounded-md text-[10px] sm:text-xs font-medium capitalize">
              Home
            </span>
          </div>
        ) : listing.category ? (
          <div className="mb-2 sm:mb-3">
            <span className="inline-block px-2 sm:px-2.5 py-0.5 sm:py-1 bg-[#0071E3]/10 text-[#0071E3] rounded-md text-[10px] sm:text-xs font-medium capitalize">
              {listing.category}
            </span>
          </div>
        ) : null}

        {/* Price */}
        <div className="flex items-baseline gap-1">
          <span className="text-base sm:text-lg md:text-xl font-semibold text-[#1C1C1E]">
            ₱{parseFloat(listing.price || 0).toLocaleString()}
          </span>
          <span className="text-xs sm:text-sm text-[#1C1C1E]/60 font-light">night</span>
        </div>
      </div>
    </Link>
  );
};

const Explore = () => {
  const { currentUser } = useAuth();
  const [recommendedListings, setRecommendedListings] = useState([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);
  const [allListings, setAllListings] = useState([]);
  const [allListingsLoading, setAllListingsLoading] = useState(true);
  const [recommendationReasons, setRecommendationReasons] = useState({});
  const [preferencesSummary, setPreferencesSummary] = useState(null);

  // Fetch and calculate recommendations based on booking history
  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!currentUser) {
        setRecommendedListings([]);
        setRecommendationsLoading(false);
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
          // If no bookings, fetch popular listings
          const popularListingsQuery = query(
            collection(db, "listings"),
            where("status", "==", "active"),
            orderBy("createdAt", "desc")
          );
          const popularSnapshot = await getDocs(popularListingsQuery);
          const popularListings = popularSnapshot.docs
            .slice(0, 12)
            .map(doc => ({ id: doc.id, ...doc.data() }));
          setRecommendedListings(popularListings);
          setRecommendationsLoading(false);
          return;
        }

        const bookings = bookingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Extract preferences from bookings
        const preferences = {
          categories: {},
          subcategories: {},
          placeTypes: {},
          serviceTypes: {},
          activityTypes: {},
          locations: {},
          priceRange: { min: Infinity, max: 0, avg: 0 },
          amenities: new Set(),
          services: new Set(),
          bookedListingIds: new Set()
        };

        let totalPrice = 0;
        let priceCount = 0;

        bookings.forEach(booking => {
          if (booking.listingId) {
            preferences.bookedListingIds.add(booking.listingId);
          }
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
          if (listing.category) {
            preferences.categories[listing.category] = (preferences.categories[listing.category] || 0) + 1;
          }
          if (listing.subcategory) {
            preferences.subcategories[listing.subcategory] = (preferences.subcategories[listing.subcategory] || 0) + 1;
          }
          if (listing.placeType) {
            preferences.placeTypes[listing.placeType] = (preferences.placeTypes[listing.placeType] || 0) + 1;
          }
          if (listing.serviceType) {
            preferences.serviceTypes[listing.serviceType] = (preferences.serviceTypes[listing.serviceType] || 0) + 1;
          }
          if (listing.activityType) {
            preferences.activityTypes[listing.activityType] = (preferences.activityTypes[listing.activityType] || 0) + 1;
          }
          if (listing.location) {
            const locationParts = listing.location.split(',').map(s => s.trim());
            locationParts.forEach(part => {
              preferences.locations[part] = (preferences.locations[part] || 0) + 1;
            });
          }
          if (listing.price) {
            const price = parseFloat(listing.price);
            if (price > 0) {
              preferences.priceRange.min = Math.min(preferences.priceRange.min, price);
              preferences.priceRange.max = Math.max(preferences.priceRange.max, price);
              totalPrice += price;
              priceCount++;
            }
          }
          if (listing.amenities && Array.isArray(listing.amenities)) {
            listing.amenities.forEach(amenity => preferences.amenities.add(amenity));
          }
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

        const topSubcategory = Object.keys(preferences.subcategories).length > 0
          ? Object.keys(preferences.subcategories).reduce((a, b) => 
              preferences.subcategories[a] > preferences.subcategories[b] ? a : b
            )
          : null;

        const topPlaceType = Object.keys(preferences.placeTypes).length > 0
          ? Object.keys(preferences.placeTypes).reduce((a, b) => 
              preferences.placeTypes[a] > preferences.placeTypes[b] ? a : b
            )
          : null;

        const topServiceType = Object.keys(preferences.serviceTypes).length > 0
          ? Object.keys(preferences.serviceTypes).reduce((a, b) => 
              preferences.serviceTypes[a] > preferences.serviceTypes[b] ? a : b
            )
          : null;

        const topActivityType = Object.keys(preferences.activityTypes).length > 0
          ? Object.keys(preferences.activityTypes).reduce((a, b) => 
              preferences.activityTypes[a] > preferences.activityTypes[b] ? a : b
            )
          : null;

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

        // Normalize category for display (map legacy categories to "Home")
        const displayCategory = topCategory && (topCategory === "resort" || topCategory === "hotel" || topCategory === "transient") 
          ? "Home" 
          : topCategory;

        // Store preferences summary for display
        const summary = {
          topCategory: displayCategory,
          topSubcategory,
          topPlaceType,
          topServiceType,
          topActivityType,
          topLocation,
          avgPrice: preferences.priceRange.avg > 0 ? preferences.priceRange.avg : null
        };
        setPreferencesSummary(summary);

        // Score and rank listings based on preferences
        const scoredListingsWithReasons = allListings
          .filter(listing => !preferences.bookedListingIds.has(listing.id))
          .map(listing => {
            let score = 0;
            const reasons = [];

            if (topCategory && listing.category === topCategory) {
              score += 35;
              const displayCat = (topCategory === "resort" || topCategory === "hotel" || topCategory === "transient") ? "Home" : topCategory;
              reasons.push(`Matches your preferred category (${displayCat})`);
            }
            if (topSubcategory && listing.subcategory === topSubcategory) {
              score += 25;
              reasons.push(`Same type as previous bookings (${topSubcategory})`);
            }
            if (topPlaceType && listing.placeType === topPlaceType) {
              score += 20;
              reasons.push(`Similar property type (${topPlaceType})`);
            }
            if (topServiceType && listing.serviceType === topServiceType) {
              score += 20;
              reasons.push(`Matches your preferred service (${topServiceType})`);
            }
            if (topActivityType && listing.activityType === topActivityType) {
              score += 20;
              reasons.push(`Same activity type (${topActivityType})`);
            }
            if (topLocation && listing.location && listing.location.includes(topLocation)) {
              score += 18;
              reasons.push(`Located in ${topLocation}`);
            }
            if (listing.price && preferences.priceRange.avg > 0) {
              const priceDiff = Math.abs(parseFloat(listing.price) - preferences.priceRange.avg);
              const priceRange = preferences.priceRange.max - preferences.priceRange.min || 1;
              const priceScore = Math.max(0, 15 * (1 - priceDiff / priceRange));
              score += priceScore;
              if (priceScore > 10) {
                reasons.push(`Similar to your usual price range`);
              }
            }
            if (listing.amenities && Array.isArray(listing.amenities) && preferences.amenities.size > 0) {
              const matchingAmenities = listing.amenities.filter(a => preferences.amenities.has(a)).length;
              const amenityScore = (matchingAmenities / preferences.amenities.size) * 12;
              score += amenityScore;
              if (matchingAmenities > 0) {
                reasons.push(`Has amenities you prefer (${matchingAmenities} match${matchingAmenities > 1 ? 'es' : ''})`);
              }
            }
            if (listing.services && Array.isArray(listing.services) && preferences.services.size > 0) {
              const matchingServices = listing.services.filter(s => preferences.services.has(s)).length;
              const serviceScore = (matchingServices / preferences.services.size) * 8;
              score += serviceScore;
              if (matchingServices > 0) {
                reasons.push(`Includes services you've used (${matchingServices} match${matchingServices > 1 ? 'es' : ''})`);
              }
            }

            return { listing, score, reasons };
          })
          .filter(item => item.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 12);

        // Store reasons for each listing
        const reasonsMap = {};
        scoredListingsWithReasons.forEach(({ listing, reasons }) => {
          reasonsMap[listing.id] = reasons;
        });
        setRecommendationReasons(reasonsMap);

        // Extract just the listings
        const scoredListings = scoredListingsWithReasons.map(item => item.listing);
        setRecommendedListings(scoredListings);
      } catch (error) {
        console.error("Error fetching recommendations:", error);
        setRecommendedListings([]);
      } finally {
        setRecommendationsLoading(false);
      }
    };

    fetchRecommendations();
  }, [currentUser]);

  // Fetch all listings
  useEffect(() => {
    const fetchAllListings = async () => {
      try {
        setAllListingsLoading(true);
        console.log("Fetching all listings...");
        
        // Fetch all active listings without orderBy to avoid index requirements
        const allListingsQuery = query(
          collection(db, "listings"),
          where("status", "==", "active")
        );
        const allListingsSnapshot = await getDocs(allListingsQuery);
        console.log("All listings snapshot size:", allListingsSnapshot.size);
        
        const listings = allListingsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        console.log("Fetched listings count:", listings.length);
        
        // Sort by createdAt in memory (newest first)
        listings.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return dateB - dateA;
        });
        
        setAllListings(listings);
      } catch (error) {
        console.error("Error fetching all listings:", error);
        // If query fails, try fetching without status filter
        try {
          console.log("Trying to fetch all listings without status filter...");
          const allListingsQuery = query(collection(db, "listings"));
          const allListingsSnapshot = await getDocs(allListingsQuery);
          const listings = allListingsSnapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data()
            }))
            .filter(listing => listing.status === "active" || !listing.status);
          
          listings.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB - dateA;
          });
          
          console.log("Fetched listings without status filter:", listings.length);
          setAllListings(listings);
        } catch (fallbackError) {
          console.error("Fallback fetch also failed:", fallbackError);
          setAllListings([]);
        }
      } finally {
        setAllListingsLoading(false);
      }
    };

    fetchAllListings();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F5F7] via-white to-[#F5F5F7]">
      <Header />
      
      {/* Hero Section with Animation */}
      <div className="relative overflow-hidden pt-24 sm:pt-28 md:pt-32 pb-12 sm:pb-16 md:pb-20 px-3 sm:px-4 md:px-6">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0071E3]/5 via-transparent to-[#0071E3]/5"></div>
        
        <div className="relative w-full max-w-6xl mx-auto text-center animate-fadeInUp">
          <div className="inline-flex items-center justify-center gap-2 sm:gap-3 mb-4 sm:mb-6 px-4 py-2 bg-[#0071E3]/10 rounded-full animate-pulse-slow">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-[#0071E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="text-xs sm:text-sm font-medium text-[#0071E3]">Personalized Recommendations</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light text-[#1C1C1E] mb-4 sm:mb-6 animate-fadeInUp" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
            Discover Your
            <span className="block mt-2 bg-gradient-to-r from-[#0071E3] to-[#0051D0] bg-clip-text text-transparent font-semibold">
              Perfect Getaway
            </span>
          </h1>
          
          <p className="text-base sm:text-lg md:text-xl text-[#717171] font-light max-w-2xl mx-auto mb-6 sm:mb-8 animate-fadeInUp" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
            {currentUser 
              ? "Curated listings based on your booking history and preferences" 
              : "Explore handpicked listings for your next adventure"}
          </p>
        </div>
      </div>

      {/* Recommendations Section */}
      <div className="px-3 sm:px-4 md:px-6 py-6 sm:py-8 md:py-12">
        <div className="w-full max-w-6xl mx-auto">
          {recommendationsLoading ? (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center gap-3 animate-pulse">
                <div className="w-2 h-2 bg-[#0071E3] rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                <div className="w-2 h-2 bg-[#0071E3] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-[#0071E3] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
              <p className="mt-4 text-[#1C1C1E]/50 font-light">Loading personalized recommendations...</p>
            </div>
          ) : recommendedListings.length === 0 ? (
            <div className="text-center py-20 animate-fadeInUp">
              <svg className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 text-[#1C1C1E]/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <h3 className="text-xl sm:text-2xl font-light text-[#1C1C1E] mb-2">No recommendations yet</h3>
              <p className="text-sm sm:text-base text-[#717171] font-light">
                {currentUser 
                  ? "Book your first listing to get personalized recommendations!" 
                  : "Sign in to get personalized recommendations based on your preferences"}
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6 sm:mb-8 animate-fadeInUp">
                <div className="flex items-center gap-3 mb-2">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-[#0071E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-[#1C1C1E]">
                    Recommended for You
                  </h2>
                </div>
                <p className="text-sm sm:text-base text-[#717171] font-light mb-3">
                  {currentUser 
                    ? "Based on your previous bookings and preferences" 
                    : "Discover amazing places to stay"}
                </p>
                {currentUser && preferencesSummary && (
                  <div className="bg-[#F5F5F7] rounded-lg p-4 sm:p-5 border border-gray-200 animate-fadeInUp" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
                    <p className="text-xs sm:text-sm font-medium text-[#1C1C1E] mb-2">Why these recommendations?</p>
                    <ul className="text-xs sm:text-sm text-[#717171] space-y-1">
                      {preferencesSummary.topCategory && (
                        <li className="flex items-center gap-2">
                          <svg className="w-3 h-3 text-[#0071E3] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Your preferred category: <span className="font-medium text-[#1C1C1E] capitalize">{preferencesSummary.topCategory}</span>
                        </li>
                      )}
                      {preferencesSummary.topPlaceType && (
                        <li className="flex items-center gap-2">
                          <svg className="w-3 h-3 text-[#0071E3] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          You often book: <span className="font-medium text-[#1C1C1E] capitalize">{preferencesSummary.topPlaceType}</span>
                        </li>
                      )}
                      {preferencesSummary.topActivityType && (
                        <li className="flex items-center gap-2">
                          <svg className="w-3 h-3 text-[#0071E3] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Your favorite activity: <span className="font-medium text-[#1C1C1E] capitalize">{preferencesSummary.topActivityType}</span>
                        </li>
                      )}
                      {preferencesSummary.topLocation && (
                        <li className="flex items-center gap-2">
                          <svg className="w-3 h-3 text-[#0071E3] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Popular location in your bookings: <span className="font-medium text-[#1C1C1E]">{preferencesSummary.topLocation}</span>
                        </li>
                      )}
                      {preferencesSummary.avgPrice && (
                        <li className="flex items-center gap-2">
                          <svg className="w-3 h-3 text-[#0071E3] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Similar to your average price: <span className="font-medium text-[#1C1C1E]">₱{Math.round(preferencesSummary.avgPrice).toLocaleString()}/night</span>
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>

              {/* Mobile: Horizontal Scroll */}
              <div className="flex sm:hidden gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6">
                {recommendedListings.map((listing, index) => (
                  <div key={listing.id} className="flex-shrink-0 w-[280px]">
                    <div className="mb-3">
                      <ListingCard listing={listing} index={index} />
                    </div>
                    {recommendationReasons[listing.id] && recommendationReasons[listing.id].length > 0 && (
                      <div className="mt-2 p-3 bg-[#F5F5F7] rounded-lg border border-gray-200">
                        <p className="text-[10px] font-medium text-[#1C1C1E] mb-1.5">Why recommended:</p>
                        <ul className="text-[10px] text-[#717171] space-y-1">
                          {recommendationReasons[listing.id].slice(0, 2).map((reason, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-[#0071E3] mt-0.5">•</span>
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop: Grid */}
              <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {recommendedListings.map((listing, index) => (
                  <div key={listing.id}>
                    <ListingCard listing={listing} index={index} />
                    {recommendationReasons[listing.id] && recommendationReasons[listing.id].length > 0 && (
                      <div className="mt-3 p-3 bg-[#F5F5F7] rounded-lg border border-gray-200 animate-fadeInUp" style={{ animationDelay: `${(index + 1) * 0.1}s`, animationFillMode: 'both' }}>
                        <p className="text-xs font-medium text-[#1C1C1E] mb-2">Why recommended:</p>
                        <ul className="text-xs text-[#717171] space-y-1.5">
                          {recommendationReasons[listing.id].slice(0, 3).map((reason, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <svg className="w-3 h-3 text-[#0071E3] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* All Listings Section */}
      <div className="px-3 sm:px-4 md:px-6 py-6 sm:py-8 md:py-12 bg-white">
        <div className="w-full max-w-6xl mx-auto">
          <div className="mb-6 sm:mb-8 animate-fadeInUp">
            <div className="flex items-center gap-3 mb-2">
              <svg className="w-6 h-6 sm:w-8 sm:h-8 text-[#0071E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-[#1C1C1E]">
                All Listings
              </h2>
            </div>
            <p className="text-sm sm:text-base text-[#717171] font-light">
              Browse through all available listings
            </p>
          </div>

          {allListingsLoading ? (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center gap-3 animate-pulse">
                <div className="w-2 h-2 bg-[#0071E3] rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                <div className="w-2 h-2 bg-[#0071E3] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-[#0071E3] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
              <p className="mt-4 text-[#1C1C1E]/50 font-light">Loading all listings...</p>
            </div>
          ) : allListings.length === 0 ? (
            <div className="text-center py-20 animate-fadeInUp">
              <svg className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 text-[#1C1C1E]/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="text-xl sm:text-2xl font-light text-[#1C1C1E] mb-2">No listings found</h3>
              <p className="text-sm sm:text-base text-[#717171] font-light">
                Check back later for new listings
              </p>
            </div>
          ) : (
            <>
              {/* Mobile: Horizontal Scroll */}
              <div className="flex sm:hidden gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6">
                {allListings.map((listing, index) => (
                  <div key={listing.id} className="flex-shrink-0 w-[280px]">
                    <ListingCard listing={listing} index={index + (recommendedListings.length || 0)} />
                  </div>
                ))}
              </div>

              {/* Desktop: Grid */}
              <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {allListings.map((listing, index) => (
                  <ListingCard key={listing.id} listing={listing} index={index + (recommendedListings.length || 0)} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Explore;

