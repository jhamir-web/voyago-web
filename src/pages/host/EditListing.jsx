import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { cloudinaryConfig, CLOUDINARY_UPLOAD_URL } from "../../config/cloudinary";
import { GoogleMap, LoadScript, Marker } from "@react-google-maps/api";
import { GOOGLE_MAPS_API_KEY } from "../../config/googlemaps";

const EditListing = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    location: "",
    price: "",
    category: "resort",
    maxGuests: "",
  });

  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [currentImageUrl, setCurrentImageUrl] = useState("");
  const [coordinates, setCoordinates] = useState({ lat: null, lng: null });
  const [mapCenter, setMapCenter] = useState({ lat: 14.5995, lng: 120.9842 }); // Default to Manila
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!currentUser || !id) return;

    const fetchListing = async () => {
      try {
        setLoading(true);
        const listingDoc = await getDoc(doc(db, "listings", id));
        
        if (!listingDoc.exists()) {
          setError("Listing not found");
          setTimeout(() => navigate("/host/listings"), 2000);
          return;
        }

        const data = listingDoc.data();
        
        // Check if user owns this listing
        if (data.hostId !== currentUser.uid) {
          setError("You don't have permission to edit this listing");
          setTimeout(() => navigate("/host/listings"), 2000);
          return;
        }

        setFormData({
          title: data.title || "",
          description: data.description || "",
          location: data.location || "",
          price: data.price?.toString() || "",
          category: data.category || "resort",
          maxGuests: data.maxGuests?.toString() || "",
        });

        if (data.imageUrl) {
          setCurrentImageUrl(data.imageUrl);
        }

        // Load coordinates if they exist
        if (data.latitude && data.longitude) {
          setCoordinates({ lat: data.latitude, lng: data.longitude });
          setMapCenter({ lat: data.latitude, lng: data.longitude });
        } else if (data.location) {
          // Store location for geocoding after map loads
          setMapCenter({ lat: 14.5995, lng: 120.9842 }); // Default center
        }
      } catch (error) {
        console.error("Error fetching listing:", error);
        setError("Failed to load listing");
      } finally {
        setLoading(false);
      }
    };

    fetchListing();
  }, [id, currentUser, navigate]);

  // Get user's location for map center if no coordinates
  useEffect(() => {
    if (!coordinates.lat && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setMapCenter({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          console.log("Geolocation not available, using default location");
        }
      );
    }
  }, []);

  // Track form changes
  useEffect(() => {
    const hasData = formData.title.trim() || 
                   formData.description.trim() || 
                   formData.location.trim() || 
                   formData.price || 
                   image !== null ||
                   coordinates.lat !== null;
    setHasChanges(hasData);
  }, [formData, image, coordinates]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file.");
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        setError("Image size must be less than 5MB.");
        return;
      }
      
      setImage(file);
      setError("");
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };


  const handleSaveDraft = async () => {
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      let imageUrl = currentImageUrl;
      
      // Upload new image if provided
      if (image) {
        try {
          const formDataUpload = new FormData();
          formDataUpload.append("file", image);
          formDataUpload.append("upload_preset", cloudinaryConfig.uploadPreset);
          formDataUpload.append("folder", `voyago/listings/${currentUser.uid}/drafts`);

          const response = await fetch(CLOUDINARY_UPLOAD_URL, {
            method: "POST",
            body: formDataUpload,
          });

          if (response.ok) {
            const data = await response.json();
            imageUrl = data.secure_url;
          }
        } catch (uploadError) {
          console.error("Image upload error:", uploadError);
        }
      }

      await updateDoc(doc(db, "listings", id), {
        title: formData.title.trim() || "Untitled Listing",
        description: formData.description.trim() || "",
        location: formData.location.trim() || "",
        price: formData.price ? parseFloat(formData.price) : 0,
        category: formData.category,
        maxGuests: formData.maxGuests ? parseInt(formData.maxGuests) : 1,
        imageUrl: imageUrl,
        latitude: coordinates.lat || null,
        longitude: coordinates.lng || null,
        updatedAt: new Date().toISOString(),
        status: "draft",
      });

      setSuccess("Draft updated successfully!");
      setTimeout(() => {
        navigate("/host/listings");
      }, 1500);
    } catch (err) {
      console.error("Error saving draft:", err);
      setError("Failed to save draft. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Handle cancel without auto-save
  const handleCancel = () => {
    navigate("/host/listings");
  };

  const handlePublish = async () => {
    setError("");
    setSuccess("");
    setPublishing(true);

    // Validation
    if (!formData.title.trim()) {
      setError("Please enter a title.");
      setPublishing(false);
      return;
    }
    if (!formData.description.trim()) {
      setError("Please enter a description.");
      setPublishing(false);
      return;
    }
    if (!formData.location.trim()) {
      setError("Please enter a location.");
      setPublishing(false);
      return;
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      setError("Please enter a valid price.");
      setPublishing(false);
      return;
    }
    if (!formData.maxGuests || parseInt(formData.maxGuests) < 1) {
      setError("Please enter a valid maximum number of guests (at least 1).");
      setPublishing(false);
      return;
    }
    if (!currentImageUrl && !image) {
      setError("Please upload an image.");
      setPublishing(false);
      return;
    }

    try {
      let imageUrl = currentImageUrl;

      // Upload new image if provided
      if (image) {
        try {
          const formDataUpload = new FormData();
          formDataUpload.append("file", image);
          formDataUpload.append("upload_preset", cloudinaryConfig.uploadPreset);
          formDataUpload.append("folder", `voyago/listings/${currentUser.uid}`);

          const response = await fetch(CLOUDINARY_UPLOAD_URL, {
            method: "POST",
            body: formDataUpload,
          });

          if (response.ok) {
            const data = await response.json();
            imageUrl = data.secure_url;
          } else {
            throw new Error("Image upload failed");
          }
        } catch (uploadError) {
          console.error("Cloudinary upload error:", uploadError);
          setError("Failed to upload image. Please try again.");
          setPublishing(false);
          return;
        }
      }

      await updateDoc(doc(db, "listings", id), {
        title: formData.title.trim(),
        description: formData.description.trim(),
        location: formData.location.trim(),
        price: parseFloat(formData.price),
        category: formData.category,
        maxGuests: parseInt(formData.maxGuests) || 1,
        imageUrl: imageUrl,
        latitude: coordinates.lat || null,
        longitude: coordinates.lng || null,
        updatedAt: new Date().toISOString(),
        status: "active",
      });

      setSuccess("Listing published successfully!");
      setTimeout(() => {
        navigate("/host/listings");
      }, 1500);
    } catch (err) {
      console.error("Error publishing listing:", err);
      setError("Failed to publish listing. Please try again.");
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#1C1C1E] font-light">Loading listing...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-light text-[#1C1C1E] mb-2">
            Edit Listing
          </h1>
          <p className="text-sm sm:text-base text-[#1C1C1E]/70 font-light">
            Update your listing information
          </p>
        </div>

        <div className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-xs sm:text-sm font-light text-[#1C1C1E] mb-2">
              Title *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:border-[#0071E3] bg-white text-[#1C1C1E] font-light transition-colors"
              placeholder="e.g., Cozy apartment in downtown"
              disabled={saving || publishing}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs sm:text-sm font-light text-[#1C1C1E] mb-3">
              Category *
            </label>
            <div className="space-y-2">
              <label className="flex items-center p-3 sm:p-4 rounded-lg cursor-pointer transition-all border border-gray-300 hover:border-gray-400">
                <input
                  type="radio"
                  name="category"
                  value="resort"
                  checked={formData.category === "resort"}
                  onChange={handleChange}
                  className="mr-2 sm:mr-3 accent-[#0071E3]"
                  disabled={saving || publishing}
                />
                <span className="text-sm sm:text-base text-[#1C1C1E] font-light">Resort</span>
              </label>
              <label className="flex items-center p-3 sm:p-4 rounded-lg cursor-pointer transition-all border border-gray-300 hover:border-gray-400">
                <input
                  type="radio"
                  name="category"
                  value="hotel"
                  checked={formData.category === "hotel"}
                  onChange={handleChange}
                  className="mr-2 sm:mr-3 accent-[#0071E3]"
                  disabled={saving || publishing}
                />
                <span className="text-sm sm:text-base text-[#1C1C1E] font-light">Hotel</span>
              </label>
              <label className="flex items-center p-3 sm:p-4 rounded-lg cursor-pointer transition-all border border-gray-300 hover:border-gray-400">
                <input
                  type="radio"
                  name="category"
                  value="transient"
                  checked={formData.category === "transient"}
                  onChange={handleChange}
                  className="mr-2 sm:mr-3 accent-[#0071E3]"
                  disabled={saving || publishing}
                />
                <span className="text-sm sm:text-base text-[#1C1C1E] font-light">Transient</span>
              </label>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs sm:text-sm font-light text-[#1C1C1E] mb-2">
              Description *
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={5}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:border-[#0071E3] bg-white text-[#1C1C1E] font-light transition-colors resize-none"
              placeholder="Describe your listing..."
              disabled={saving || publishing}
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs sm:text-sm font-light text-[#1C1C1E] mb-2">
              Location *
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                onBlur={async () => {
                  // Geocode address to coordinates when user leaves the field
                  if (formData.location.trim() && mapLoaded) {
                    const geocoder = new window.google.maps.Geocoder();
                    geocoder.geocode({ address: formData.location }, (results, status) => {
                      if (status === "OK" && results[0]) {
                        const location = results[0].geometry.location;
                        const lat = location.lat();
                        const lng = location.lng();
                        setCoordinates({ lat, lng });
                        setMapCenter({ lat, lng });
                        if (mapRef.current) {
                          mapRef.current.setCenter({ lat, lng });
                          mapRef.current.setZoom(15);
                        }
                      }
                    });
                  }
                }}
                className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:border-[#0071E3] bg-white text-[#1C1C1E] font-light transition-colors"
                placeholder="e.g., New York, NY, USA"
                disabled={saving || publishing}
              />
              <button
                type="button"
                onClick={async () => {
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                      (position) => {
                        const lat = position.coords.latitude;
                        const lng = position.coords.longitude;
                        setCoordinates({ lat, lng });
                        setMapCenter({ lat, lng });
                        if (mapRef.current) {
                          mapRef.current.setCenter({ lat, lng });
                          mapRef.current.setZoom(15);
                        }
                        // Reverse geocode
                        const geocoder = new window.google.maps.Geocoder();
                        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                          if (status === "OK" && results[0]) {
                            setFormData(prev => ({ ...prev, location: results[0].formatted_address }));
                          }
                        });
                      },
                      () => {
                        setError("Unable to get your location. Please enter it manually.");
                      }
                    );
                  }
                }}
                className="px-4 py-2.5 sm:py-3 bg-[#0071E3] text-white rounded-lg text-sm font-medium hover:bg-[#0051D0] transition-colors disabled:opacity-50"
                disabled={saving || publishing || !mapLoaded}
                title="Use my current location"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
            <div className="w-full h-64 rounded-lg overflow-hidden border-2 border-gray-300 mb-2">
              <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY} libraries={["places", "geometry"]}>
                <GoogleMap
                  mapContainerStyle={{ width: "100%", height: "100%" }}
                  center={coordinates.lat ? { lat: coordinates.lat, lng: coordinates.lng } : mapCenter}
                  zoom={coordinates.lat ? 15 : 10}
                  onClick={(e) => {
                    if (e.latLng) {
                      const lat = e.latLng.lat();
                      const lng = e.latLng.lng();
                      setCoordinates({ lat, lng });
                      setMapCenter({ lat, lng });
                      // Reverse geocode to get address
                      const geocoder = new window.google.maps.Geocoder();
                      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                        if (status === "OK" && results[0]) {
                          setFormData(prev => ({ ...prev, location: results[0].formatted_address }));
                        }
                      });
                    }
                  }}
                  onLoad={(map) => {
                    mapRef.current = map;
                    setMapLoaded(true);
                    // Geocode existing location if coordinates don't exist
                    if (!coordinates.lat && formData.location) {
                      const geocoder = new window.google.maps.Geocoder();
                      geocoder.geocode({ address: formData.location }, (results, status) => {
                        if (status === "OK" && results[0]) {
                          const location = results[0].geometry.location;
                          const lat = location.lat();
                          const lng = location.lng();
                          setCoordinates({ lat, lng });
                          setMapCenter({ lat, lng });
                          map.setCenter({ lat, lng });
                          map.setZoom(15);
                        }
                      });
                    }
                  }}
                  options={{
                    disableDefaultUI: false,
                    zoomControl: true,
                    streetViewControl: false,
                    mapTypeControl: false,
                    fullscreenControl: true,
                  }}
                >
                  {coordinates.lat && coordinates.lng && (
                    <Marker
                      position={{ lat: coordinates.lat, lng: coordinates.lng }}
                      draggable={true}
                      onDragEnd={(e) => {
                        if (e.latLng) {
                          const lat = e.latLng.lat();
                          const lng = e.latLng.lng();
                          setCoordinates({ lat, lng });
                          setMapCenter({ lat, lng });
                          // Reverse geocode to get address
                          const geocoder = new window.google.maps.Geocoder();
                          geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                            if (status === "OK" && results[0]) {
                              setFormData(prev => ({ ...prev, location: results[0].formatted_address }));
                            }
                          });
                        }
                      }}
                    />
                  )}
                </GoogleMap>
              </LoadScript>
            </div>
            <p className="text-xs text-[#1C1C1E]/50 font-light">
              Click on the map to pin your location, drag the marker to adjust, or enter an address above
            </p>
          </div>

          {/* Price */}
          <div>
            <label className="block text-xs sm:text-sm font-light text-[#1C1C1E] mb-2">
              Price per night (USD) *
            </label>
            <input
              type="number"
              name="price"
              value={formData.price}
              onChange={handleChange}
              min="0"
              step="0.01"
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:border-[#0071E3] bg-white text-[#1C1C1E] font-light transition-colors"
              placeholder="0.00"
              disabled={saving || publishing}
            />
          </div>

          {/* Maximum Guests */}
          <div>
            <label className="block text-xs sm:text-sm font-light text-[#1C1C1E] mb-2">
              Maximum Guests *
            </label>
            <input
              type="number"
              name="maxGuests"
              value={formData.maxGuests}
              onChange={handleChange}
              min="1"
              max="50"
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:border-[#0071E3] bg-white text-[#1C1C1E] font-light transition-colors"
              placeholder="e.g., 4"
              disabled={saving || publishing}
              required
            />
            <p className="mt-2 text-xs text-[#1C1C1E]/50 font-light">
              Maximum number of guests that can stay at this place
            </p>
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-xs sm:text-sm font-light text-[#1C1C1E] mb-2">
              Image {!currentImageUrl && "*"}
            </label>
            <div className="space-y-3">
              {currentImageUrl && !imagePreview && (
                <div className="mb-3">
                  <p className="text-xs text-[#8E8E93] font-light mb-2">Current image:</p>
                  <img
                    src={currentImageUrl}
                    alt="Current listing"
                    className="w-full h-64 object-cover rounded-lg border border-gray-300"
                  />
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:border-[#0071E3] bg-white text-[#1C1C1E] font-light transition-colors file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-light file:bg-[#0071E3] file:text-white file:cursor-pointer hover:file:bg-[#0051D0]"
                disabled={saving || publishing}
              />
              {imagePreview && (
                <div className="mt-3">
                  <p className="text-xs text-[#8E8E93] font-light mb-2">New image preview:</p>
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-64 object-cover rounded-lg border border-gray-300"
                  />
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-[#1C1C1E]/50 font-light">
              Maximum file size: 5MB. Leave empty to keep current image.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-xs sm:text-sm font-light border border-red-200">
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="p-3 bg-green-50 text-green-700 rounded-lg text-xs sm:text-sm font-light border border-green-200">
              {success}
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 sm:flex-none px-6 sm:px-8 py-3 sm:py-4 bg-white border-2 border-gray-200 text-[#1C1C1E] rounded-2xl text-sm sm:text-base font-light hover:border-gray-300 hover:bg-gray-50 transition-all duration-300 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={saving || publishing}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving || publishing}
              className="flex-1 sm:flex-none px-6 sm:px-8 py-3 sm:py-4 bg-white border-2 border-[#0071E3] text-[#0071E3] rounded-2xl text-sm sm:text-base font-light hover:bg-[#0071E3]/5 transition-all duration-300 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save as Draft"}
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={saving || publishing}
              className="flex-1 sm:flex-none px-6 sm:px-8 py-3 sm:py-4 bg-[#0071E3] text-white rounded-2xl text-sm sm:text-base font-light hover:bg-[#0051D0] transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {publishing ? "Publishing..." : "Publish Listing"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditListing;


