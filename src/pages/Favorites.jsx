import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { collection, query, where, getDocs, onSnapshot, doc, deleteDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import Header from "../components/Header";

// Listing Card Component - Reused from Home.jsx
const ListingCard = ({ listing, currentUser, onRemove }) => {
  const [isFavorite, setIsFavorite] = useState(true);
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

  // Get favorite ID
  useEffect(() => {
    const getFavoriteId = async () => {
      if (!currentUser || !listing.id) return;
      try {
        const favoritesQuery = query(
          collection(db, "favorites"),
          where("userId", "==", currentUser.uid),
          where("listingId", "==", listing.id)
        );
        const snapshot = await getDocs(favoritesQuery);
        if (!snapshot.empty) {
          setFavoriteId(snapshot.docs[0].id);
        }
      } catch (error) {
        console.error("Error getting favorite ID:", error);
      }
    };
    getFavoriteId();
  }, [currentUser, listing.id]);

  const handleFavoriteClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!currentUser || !favoriteId) return;

    try {
      await deleteDoc(doc(db, "favorites", favoriteId));
      setIsFavorite(false);
      if (onRemove) {
        onRemove(listing.id);
      }
    } catch (error) {
      console.error("Error removing favorite:", error);
      alert("Failed to remove favorite. Please try again.");
    }
  };

  return (
    <Link
      to={`/listing/${listing.id}`}
      className="group block bg-white rounded-xl sm:rounded-2xl overflow-hidden border border-gray-200 shadow-md hover:shadow-2xl hover:border-gray-300 transition-all duration-500 ease-out cursor-pointer transform hover:-translate-y-2 w-full animate-fadeInUp"
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
          aria-label="Remove from favorites"
        >
          <svg
            className="w-5 h-5 transition-all duration-300 fill-red-500 text-red-500 scale-110"
            fill="currentColor"
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
            <span className="text-xs sm:text-sm text-[#1C1C1E]/60 font-light">night</span>
          </div>
        </div>
      </div>
    </Link>
  );
};

const Favorites = () => {
  const { currentUser, userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!currentUser) {
      navigate("/login");
      return;
    }

    fetchFavorites();
  }, [currentUser, authLoading, navigate]);

  const fetchFavorites = async () => {
    try {
      setLoading(true);
      
      // Fetch user's favorites
      const favoritesQuery = query(
        collection(db, "favorites"),
        where("userId", "==", currentUser.uid)
      );
      
      const favoritesSnapshot = await getDocs(favoritesQuery);
      const favoritesData = [];
      
      favoritesSnapshot.forEach((doc) => {
        favoritesData.push({
          id: doc.id,
          ...doc.data()
        });
      });

      // Sort by createdAt (newest first)
      favoritesData.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA;
      });

      setFavorites(favoritesData);

      // Fetch full listing details for each favorite
      const listingIds = favoritesData.map(fav => fav.listingId);
      if (listingIds.length > 0) {
        const listingsData = [];
        
        // Fetch each listing by document ID
        for (const listingId of listingIds) {
          try {
            const listingRef = doc(db, "listings", listingId);
            const listingDocSnap = await getDoc(listingRef);
            
            if (listingDocSnap.exists()) {
              listingsData.push({
                id: listingDocSnap.id,
                ...listingDocSnap.data()
              });
            }
          } catch (error) {
            console.error(`Error fetching listing ${listingId}:`, error);
          }
        }
        
        setListings(listingsData);
      } else {
        setListings([]);
      }
    } catch (error) {
      console.error("Error fetching favorites:", error);
    } finally {
      setLoading(false);
    }
  };

  // Use real-time listener for favorites
  useEffect(() => {
    if (!currentUser) return;

    const favoritesQuery = query(
      collection(db, "favorites"),
      where("userId", "==", currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      favoritesQuery,
      async (snapshot) => {
        const favoritesData = [];
        snapshot.forEach((doc) => {
          favoritesData.push({
            id: doc.id,
            ...doc.data()
          });
        });

        // Sort by createdAt (newest first)
        favoritesData.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return dateB - dateA;
        });

        setFavorites(favoritesData);

        // Fetch full listing details
        const listingIds = favoritesData.map(fav => fav.listingId);
        if (listingIds.length > 0) {
          const listingsData = [];
          
          for (const listingId of listingIds) {
            try {
              const listingRef = doc(db, "listings", listingId);
              const listingDocSnap = await getDoc(listingRef);
              
              if (listingDocSnap.exists()) {
                listingsData.push({
                  id: listingDocSnap.id,
                  ...listingDocSnap.data()
                });
              }
            } catch (error) {
              console.error(`Error fetching listing ${listingId}:`, error);
            }
          }
          
          setListings(listingsData);
        } else {
          setListings([]);
        }
      },
      (error) => {
        console.error("Error in favorites listener:", error);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  const handleRemoveFavorite = (listingId) => {
    // Remove from local state
    setListings(prev => prev.filter(listing => listing.id !== listingId));
    setFavorites(prev => prev.filter(fav => fav.listingId !== listingId));
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="text-[#1C1C1E] font-light">Loading favorites...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <Header />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        {/* Page Header */}
        <div className="mb-8 sm:mb-12 animate-fadeInUp">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-light text-[#1C1C1E] mb-3 sm:mb-4">
            Your Favorites
          </h1>
          <p className="text-sm sm:text-base text-[#1C1C1E]/70 font-light">
            {listings.length === 0 
              ? "You haven't saved any favorites yet" 
              : `${listings.length} ${listings.length === 1 ? 'listing' : 'listings'} saved`}
          </p>
        </div>

        {/* Favorites Grid */}
        {listings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            {listings.map((listing, index) => (
              <div
                key={listing.id}
                style={{
                  animation: `fadeInUp 0.6s ease-out ${index * 0.1}s both`
                }}
              >
                <ListingCard 
                  listing={listing} 
                  currentUser={currentUser}
                  onRemove={handleRemoveFavorite}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 sm:py-24 lg:py-32 animate-fadeInUp">
            <div className="w-24 h-24 sm:w-32 sm:h-32 mb-6 sm:mb-8 rounded-full bg-gray-100 flex items-center justify-center">
              <svg 
                className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={1.5} 
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" 
                />
              </svg>
            </div>
            <h2 className="text-xl sm:text-2xl font-light text-[#1C1C1E] mb-3 sm:mb-4">
              No favorites yet
            </h2>
            <p className="text-sm sm:text-base text-[#1C1C1E]/60 font-light mb-6 sm:mb-8 text-center max-w-md">
              Start exploring and save your favorite listings to see them here
            </p>
            <Link
              to="/"
              className="px-6 sm:px-8 py-3 sm:py-4 bg-[#0071E3] text-white rounded-xl sm:rounded-2xl text-sm sm:text-base font-medium hover:bg-[#0051D0] transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
            >
              Explore Listings
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default Favorites;

