import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../contexts/AuthContext";
import { collection, query, getDocs, where, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

const GuestWishlistsModal = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const [wishlists, setWishlists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && currentUser) {
      fetchWishlists();
    }
  }, [isOpen, currentUser]);

  const fetchWishlists = async () => {
    try {
      setLoading(true);
      // Fetch wishlists that include listings from this host
      const wishlistsQuery = query(collection(db, "wishlists"));
      const snapshot = await getDocs(wishlistsQuery);
      
      const wishlistsList = [];
      for (const docSnap of snapshot.docs) {
        const wishlistData = { id: docSnap.id, ...docSnap.data() };
        
        // Check if any listing in the wishlist belongs to this host
        if (wishlistData.listings && Array.isArray(wishlistData.listings)) {
          const hostListings = wishlistData.listings.filter(listing => 
            listing.hostId === currentUser.uid
          );
          
          if (hostListings.length > 0) {
            // Fetch guest user data
            try {
              const guestDocRef = doc(db, "users", wishlistData.userId);
              const guestDocSnap = await getDoc(guestDocRef);
              if (guestDocSnap.exists()) {
                wishlistData.guestData = { id: guestDocSnap.id, ...guestDocSnap.data() };
              }
            } catch (error) {
              console.error("Error fetching guest data:", error);
            }
            
            wishlistData.hostListings = hostListings;
            wishlistsList.push(wishlistData);
          }
        }
      }
      
      setWishlists(wishlistsList);
    } catch (error) {
      console.error("Error fetching wishlists:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-light text-[#1C1C1E]">Guest Wishlists</h2>
            <p className="text-sm text-[#8E8E93] font-light mt-1">View wishlists that include your listings</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#8E8E93] hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-[#0071E3] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : wishlists.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">💝</div>
              <p className="text-[#8E8E93] font-light text-lg">No wishlists submitted yet.</p>
              <p className="text-[#8E8E93] font-light text-sm mt-2">When guests add your listings to their wishlists, they'll appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {wishlists.map((wishlist) => (
                <div key={wishlist.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-[#0071E3]/10 flex items-center justify-center flex-shrink-0">
                      {wishlist.guestData?.photoURL ? (
                        <img
                          src={wishlist.guestData.photoURL}
                          alt={wishlist.guestData.displayName || "Guest"}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-lg text-[#0071E3]">
                          {(wishlist.guestData?.displayName || wishlist.guestData?.email || "G")[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-[#1C1C1E] mb-1">
                        {wishlist.guestData?.displayName || wishlist.guestData?.email || "Guest"}'s Wishlist
                      </h3>
                      <p className="text-sm text-[#8E8E93] font-light">
                        {wishlist.hostListings?.length || 0} of your {wishlist.hostListings?.length === 1 ? "listing" : "listings"} in this wishlist
                      </p>
                    </div>
                  </div>

                  {wishlist.hostListings && wishlist.hostListings.length > 0 && (
                    <div className="space-y-2">
                      {wishlist.hostListings.map((listing, index) => (
                        <div key={index} className="bg-white rounded-lg p-3 border border-gray-200 flex items-center gap-3">
                          {listing.imageUrl && (
                            <img
                              src={listing.imageUrl}
                              alt={listing.title}
                              className="w-16 h-16 rounded-lg object-cover"
                            />
                          )}
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-[#1C1C1E]">{listing.title}</h4>
                            <p className="text-xs text-[#8E8E93] font-light">{listing.location}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-[#1C1C1E]">${listing.price?.toFixed(2) || "0.00"}</p>
                            <p className="text-xs text-[#8E8E93] font-light">per night</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default GuestWishlistsModal;

