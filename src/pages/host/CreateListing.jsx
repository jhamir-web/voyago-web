import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { cloudinaryConfig, CLOUDINARY_UPLOAD_URL } from "../../config/cloudinary";
import { GoogleMap, LoadScript, Marker } from "@react-google-maps/api";
import { GOOGLE_MAPS_API_KEY } from "../../config/googlemaps";

const CreateListing = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const listingType = searchParams.get("type"); // place, experience, service
  
  // Determine category based on listing type
  const getCategoryFromType = () => {
    if (listingType === "place") return "resort";
    if (listingType === "experience") return "experience";
    if (listingType === "service") return "service";
    return "resort"; // default
  };
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    location: "",
    price: "",
    category: getCategoryFromType(),
    maxGuests: "",
  });

  const [coordinates, setCoordinates] = useState({ lat: null, lng: null });
  const [mapCenter, setMapCenter] = useState({ lat: 14.5995, lng: 120.9842 }); // Default to Manila
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef(null);

  useEffect(() => {
    // Redirect to type selection if no type is provided
    if (!listingType) {
      navigate("/host/select-listing-type");
    }
  }, [listingType, navigate]);

  // Get user's location for map center
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setMapCenter({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          // Use default if geolocation fails
          console.log("Geolocation not available, using default location");
        }
      );
    }
  }, []);
  
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [validationErrors, setValidationErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleImageFiles(files);
    }
  };

  const handleImageFiles = (files) => {
    const validFiles = [];
    const errors = [];

    files.forEach((file) => {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        errors.push(`${file.name} is not an image file.`);
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        errors.push(`${file.name} is larger than 5MB.`);
        return;
      }
      
      validFiles.push(file);
    });

    if (errors.length > 0) {
      setError(errors.join(" "));
      setValidationErrors((prev) => ({ ...prev, image: errors.join(" ") }));
    }

    if (validFiles.length > 0) {
      const newImages = [...images, ...validFiles];
      setImages(newImages);
      setError("");
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.image;
        return newErrors;
      });
      
      // Create previews for new images
      validFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreviews((prev) => [...prev, reader.result]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index) => {
    const newImages = images.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    setImages(newImages);
    setImagePreviews(newPreviews);
  };

  // Drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      handleImageFiles(files);
    }
  };

  // Handle map click to set location
  const handleMapClick = (e) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setCoordinates({ lat, lng });
      
      // Reverse geocode to get address
      if (window.google && window.google.maps) {
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          if (status === "OK" && results[0]) {
            setFormData((prev) => ({
              ...prev,
              location: results[0].formatted_address,
            }));
            setValidationErrors((prev) => {
              const newErrors = { ...prev };
              delete newErrors.location;
              return newErrors;
            });
          }
        });
      }
    }
  };

  // Validate form
  const validateForm = () => {
    const errors = {};
    
    if (!formData.title.trim()) {
      errors.title = "Title is required";
    }
    
    if (!formData.category) {
      errors.category = "Category is required";
    }
    
    if (!formData.location.trim()) {
      errors.location = "Location is required";
    }
    
    if (!coordinates.lat || !coordinates.lng) {
      errors.coordinates = "Please click on the map to set your location";
    }
    
    if (!formData.price || parseFloat(formData.price) <= 0) {
      errors.price = "Please enter a valid price";
    }
    
    if (!formData.maxGuests || parseInt(formData.maxGuests) < 1) {
      errors.maxGuests = "Please enter a valid number of guests (at least 1)";
    }
    
    if (images.length === 0) {
      errors.image = "Please upload at least one image";
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save as draft function
  const handleSaveDraft = async () => {
    setError("");
    setSavingDraft(true);

    try {
      let imageUrls = [];
      
      // Upload images if provided (optional for draft)
      if (images.length > 0) {
        try {
          // Upload all images
          const uploadPromises = images.map(async (image) => {
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
              return data.secure_url;
            }
            return null;
          });

          imageUrls = await Promise.all(uploadPromises);
          imageUrls = imageUrls.filter(url => url !== null);
        } catch (uploadError) {
          console.error("Image upload error (draft):", uploadError);
          // Continue without images for draft
        }
      }

      const listingData = {
        title: formData.title.trim() || "Untitled Listing",
        description: formData.description.trim() || "",
        location: formData.location.trim() || "",
        price: formData.price ? parseFloat(formData.price) : 0,
        category: formData.category,
        maxGuests: formData.maxGuests ? parseInt(formData.maxGuests) : 1,
        experiences: [],
        services: [],
        imageUrl: imageUrls[0] || "", // Keep first image for backward compatibility
        imageUrls: imageUrls, // Store all images
        latitude: coordinates.lat || null,
        longitude: coordinates.lng || null,
        hostId: currentUser.uid,
        hostEmail: currentUser.email,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "draft", // Save as draft
      };

      await addDoc(collection(db, "listings"), listingData);
      setSuccess("Draft saved successfully! You can continue editing later.");
      
      // Redirect to host listings page after 1.5 seconds
      setTimeout(() => {
        navigate("/host/listings");
      }, 1500);
    } catch (err) {
      console.error("Error saving draft:", err);
      setError("Failed to save draft. Please try again.");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validate form
    if (!validateForm()) {
      setError("Please fill in all required fields correctly.");
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      let imageUrls = [];

      // Upload images to Cloudinary
      if (images.length > 0) {
        try {
          console.log("Starting image upload to Cloudinary...");
          
          // Upload all images
          const uploadPromises = images.map(async (image, index) => {
            const formDataUpload = new FormData();
            formDataUpload.append("file", image);
            formDataUpload.append("upload_preset", cloudinaryConfig.uploadPreset);
            formDataUpload.append("folder", `voyago/listings/${currentUser.uid}`);

            const response = await fetch(CLOUDINARY_UPLOAD_URL, {
              method: "POST",
              body: formDataUpload,
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.error?.message || `Upload failed: ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`Image ${index + 1} uploaded successfully to Cloudinary:`, data.secure_url);
            return data.secure_url;
          });

          imageUrls = await Promise.all(uploadPromises);
          console.log("All images uploaded successfully:", imageUrls);
        } catch (uploadError) {
          console.error("Cloudinary upload error:", uploadError);
          setError("❌ Failed to upload images: " + (uploadError.message || "Unknown error. Please check your Cloudinary configuration."));
          setLoading(false);
          return;
        }
      }

      // Create listing document in Firestore
      try {
        console.log("Creating Firestore document...");

        const listingData = {
          title: formData.title.trim(),
          description: formData.description.trim() || "",
          location: formData.location.trim(),
          price: parseFloat(formData.price),
          category: formData.category,
          maxGuests: parseInt(formData.maxGuests) || 1,
          experiences: [],
          services: [],
          imageUrl: imageUrls[0] || "", // Keep first image for backward compatibility
          imageUrls: imageUrls, // Store all images
          latitude: coordinates.lat,
          longitude: coordinates.lng,
          hostId: currentUser.uid,
          hostEmail: currentUser.email,
          createdAt: new Date().toISOString(),
          status: "active", // active, draft, inactive
        };

        await addDoc(collection(db, "listings"), listingData);
        console.log("Listing created successfully in Firestore!");

        setSuccess("Listing created successfully!");
        
        // Reset form
        setFormData({
          title: "",
          description: "",
          location: "",
          price: "",
          category: getCategoryFromType(),
          maxGuests: "",
        });
        setImages([]);
        setImagePreviews([]);
        setCoordinates({ lat: null, lng: null });
        setValidationErrors({});

        // Redirect to host listings page after 2 seconds
        setTimeout(() => {
          navigate("/host/listings");
        }, 2000);
      } catch (firestoreError) {
        console.error("Firestore error:", firestoreError);
        if (firestoreError.code === "permission-denied") {
          setError("❌ Permission denied. Please check Firestore security rules.");
        } else {
          setError("❌ Failed to save listing: " + (firestoreError.message || firestoreError.code || "Unknown error"));
        }
        setLoading(false);
        return;
      }
    } catch (err) {
      console.error("Unexpected error creating listing:", err);
      setError("❌ Failed to create listing: " + (err.message || err.code || "Unknown error. Please check the browser console for details."));
    } finally {
      setLoading(false);
    }
  };

  const getListingTypeLabel = () => {
    if (listingType === "place") return "Place";
    if (listingType === "experience") return "Experience";
    if (listingType === "service") return "Service";
    return "Listing";
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-light text-[#1C1C1E]">
                Create New {getListingTypeLabel()}
              </h1>
              <p className="text-sm text-[#8E8E93] font-light mt-1">
                Share your space with travelers around the world
              </p>
            </div>
            <button
              onClick={() => navigate("/host/listings")}
              className="px-4 py-2 text-[#1C1C1E] hover:bg-gray-100 rounded-lg transition-colors text-sm font-light"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information Section */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 animate-fadeInUp">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-[#0071E3] flex items-center justify-center flex-shrink-0">
                <span className="text-white font-medium text-lg">1</span>
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-light text-[#1C1C1E]">Basic Information</h2>
                <p className="text-sm text-[#8E8E93] font-light">Tell us about your listing</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-[#1C1C1E] mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 text-base border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 bg-white text-[#1C1C1E] font-light transition-all ${
                    validationErrors.title ? "border-red-300" : "border-gray-300 focus:border-[#0071E3]"
                  }`}
                  placeholder="e.g., Cozy apartment in downtown"
                  disabled={loading || savingDraft}
                />
                {validationErrors.title && (
                  <p className="mt-1 text-sm text-red-500">{validationErrors.title}</p>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-[#1C1C1E] mb-3">
                  Category <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {listingType === "place" && (
                    <>
                      <label className={`flex items-center justify-center p-4 rounded-xl cursor-pointer transition-all border-2 ${
                        formData.category === "resort"
                          ? "border-[#0071E3] bg-[#0071E3]/5"
                          : "border-gray-200 hover:border-gray-300"
                      }`}>
                        <input
                          type="radio"
                          name="category"
                          value="resort"
                          checked={formData.category === "resort"}
                          onChange={handleChange}
                          className="sr-only"
                          disabled={loading || savingDraft}
                        />
                        <span className={`text-sm font-medium ${formData.category === "resort" ? "text-[#0071E3]" : "text-[#1C1C1E]"}`}>
                          Resort
                        </span>
                      </label>
                      <label className={`flex items-center justify-center p-4 rounded-xl cursor-pointer transition-all border-2 ${
                        formData.category === "hotel"
                          ? "border-[#0071E3] bg-[#0071E3]/5"
                          : "border-gray-200 hover:border-gray-300"
                      }`}>
                        <input
                          type="radio"
                          name="category"
                          value="hotel"
                          checked={formData.category === "hotel"}
                          onChange={handleChange}
                          className="sr-only"
                          disabled={loading || savingDraft}
                        />
                        <span className={`text-sm font-medium ${formData.category === "hotel" ? "text-[#0071E3]" : "text-[#1C1C1E]"}`}>
                          Hotel
                        </span>
                      </label>
                      <label className={`flex items-center justify-center p-4 rounded-xl cursor-pointer transition-all border-2 ${
                        formData.category === "transient"
                          ? "border-[#0071E3] bg-[#0071E3]/5"
                          : "border-gray-200 hover:border-gray-300"
                      }`}>
                        <input
                          type="radio"
                          name="category"
                          value="transient"
                          checked={formData.category === "transient"}
                          onChange={handleChange}
                          className="sr-only"
                          disabled={loading || savingDraft}
                        />
                        <span className={`text-sm font-medium ${formData.category === "transient" ? "text-[#0071E3]" : "text-[#1C1C1E]"}`}>
                          Transient
                        </span>
                      </label>
                    </>
                  )}
                  {listingType === "experience" && (
                    <label className={`flex items-center justify-center p-4 rounded-xl cursor-pointer transition-all border-2 ${
                      formData.category === "experience"
                        ? "border-[#0071E3] bg-[#0071E3]/5"
                        : "border-gray-200 hover:border-gray-300"
                    }`}>
                      <input
                        type="radio"
                        name="category"
                        value="experience"
                        checked={formData.category === "experience"}
                        onChange={handleChange}
                        className="sr-only"
                        disabled={loading || savingDraft}
                      />
                      <span className={`text-sm font-medium ${formData.category === "experience" ? "text-[#0071E3]" : "text-[#1C1C1E]"}`}>
                        Experience
                      </span>
                    </label>
                  )}
                  {listingType === "service" && (
                    <label className={`flex items-center justify-center p-4 rounded-xl cursor-pointer transition-all border-2 ${
                      formData.category === "service"
                        ? "border-[#0071E3] bg-[#0071E3]/5"
                        : "border-gray-200 hover:border-gray-300"
                    }`}>
                      <input
                        type="radio"
                        name="category"
                        value="service"
                        checked={formData.category === "service"}
                        onChange={handleChange}
                        className="sr-only"
                        disabled={loading || savingDraft}
                      />
                      <span className={`text-sm font-medium ${formData.category === "service" ? "text-[#0071E3]" : "text-[#1C1C1E]"}`}>
                        Service
                      </span>
                    </label>
                  )}
                </div>
                {validationErrors.category && (
                  <p className="mt-1 text-sm text-red-500">{validationErrors.category}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-[#1C1C1E] mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={5}
                  className="w-full px-4 py-3 text-base border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] bg-white text-[#1C1C1E] font-light transition-all resize-none"
                  placeholder="Describe your listing..."
                  disabled={loading || savingDraft}
                />
              </div>
            </div>
          </div>

          {/* Location Section */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 animate-fadeInUp">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-[#0071E3] flex items-center justify-center flex-shrink-0">
                <span className="text-white font-medium text-lg">2</span>
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-light text-[#1C1C1E]">Location</h2>
                <p className="text-sm text-[#8E8E93] font-light">Pin your location on the map</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Location Input */}
              <div>
                <label className="block text-sm font-medium text-[#1C1C1E] mb-2">
                  Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 text-base border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 bg-white text-[#1C1C1E] font-light transition-all ${
                    validationErrors.location ? "border-red-300" : "border-gray-300 focus:border-[#0071E3]"
                  }`}
                  placeholder="e.g., New York, NY, USA"
                  disabled={loading || savingDraft}
                />
                {validationErrors.location && (
                  <p className="mt-1 text-sm text-red-500">{validationErrors.location}</p>
                )}
              </div>

              {/* Google Maps */}
              <div>
                <label className="block text-sm font-medium text-[#1C1C1E] mb-2">
                  Click on the map to set your location <span className="text-red-500">*</span>
                </label>
                <div className="w-full h-[400px] sm:h-[500px] rounded-xl overflow-hidden border border-gray-300 bg-gray-100">
                  {GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY !== "YOUR_GOOGLE_MAPS_API_KEY_HERE" ? (
                    <LoadScript
                      googleMapsApiKey={GOOGLE_MAPS_API_KEY}
                      onLoad={() => setMapLoaded(true)}
                    >
                      <GoogleMap
                        mapContainerStyle={{ width: '100%', height: '100%' }}
                        center={mapCenter}
                        zoom={13}
                        onClick={handleMapClick}
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
                        }}
                        onLoad={(map) => {
                          mapRef.current = map;
                        }}
                      >
                        {coordinates.lat && coordinates.lng && (
                          <Marker position={{ lat: coordinates.lat, lng: coordinates.lng }} />
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
                {validationErrors.coordinates && (
                  <p className="mt-1 text-sm text-red-500">{validationErrors.coordinates}</p>
                )}
                {coordinates.lat && coordinates.lng && (
                  <p className="mt-2 text-sm text-[#34C759] font-light">
                    ✓ Location set: {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Pricing & Details Section */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 animate-fadeInUp">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-[#0071E3] flex items-center justify-center flex-shrink-0">
                <span className="text-white font-medium text-lg">3</span>
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-light text-[#1C1C1E]">Pricing & Details</h2>
                <p className="text-sm text-[#8E8E93] font-light">Set your pricing and capacity</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-[#1C1C1E] mb-2">
                  Price per night (USD) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8E8E93]">$</span>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className={`w-full pl-8 pr-4 py-3 text-base border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 bg-white text-[#1C1C1E] font-light transition-all ${
                      validationErrors.price ? "border-red-300" : "border-gray-300 focus:border-[#0071E3]"
                    }`}
                    placeholder="0.00"
                    disabled={loading || savingDraft}
                  />
                </div>
                {validationErrors.price && (
                  <p className="mt-1 text-sm text-red-500">{validationErrors.price}</p>
                )}
              </div>

              {/* Maximum Guests */}
              <div>
                <label className="block text-sm font-medium text-[#1C1C1E] mb-2">
                  Maximum Guests <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="maxGuests"
                  value={formData.maxGuests}
                  onChange={handleChange}
                  min="1"
                  max="50"
                  className={`w-full px-4 py-3 text-base border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 bg-white text-[#1C1C1E] font-light transition-all ${
                    validationErrors.maxGuests ? "border-red-300" : "border-gray-300 focus:border-[#0071E3]"
                  }`}
                  placeholder="e.g., 4"
                  disabled={loading || savingDraft}
                />
                {validationErrors.maxGuests && (
                  <p className="mt-1 text-sm text-red-500">{validationErrors.maxGuests}</p>
                )}
                <p className="mt-2 text-xs text-[#8E8E93] font-light">
                  Maximum number of guests that can stay
                </p>
              </div>
            </div>
          </div>

          {/* Image Upload Section */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 animate-fadeInUp">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-[#0071E3] flex items-center justify-center flex-shrink-0">
                <span className="text-white font-medium text-lg">4</span>
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-light text-[#1C1C1E]">Photos</h2>
                <p className="text-sm text-[#8E8E93] font-light">Upload photos of your listing</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1C1C1E] mb-2">
                  Listing Photos <span className="text-red-500">*</span>
                </label>
                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                    isDragging
                      ? "border-[#0071E3] bg-[#0071E3]/5"
                      : "border-gray-300 hover:border-[#0071E3]"
                  }`}
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageChange}
                    className="hidden"
                    id="image-upload"
                    disabled={loading || savingDraft}
                  />
                  <label
                    htmlFor="image-upload"
                    className="cursor-pointer flex flex-col items-center gap-3"
                  >
                    <svg className="w-12 h-12 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-[#1C1C1E]">
                        {isDragging ? "Drop images here" : "Click to upload or drag and drop"}
                      </p>
                      <p className="text-xs text-[#8E8E93] font-light mt-1">
                        PNG, JPG up to 5MB each (multiple images allowed)
                      </p>
                    </div>
                  </label>
                </div>
                {validationErrors.image && (
                  <p className="mt-1 text-sm text-red-500">{validationErrors.image}</p>
                )}
                <p className="mt-2 text-xs text-[#8E8E93] font-light">
                  Maximum file size: 5MB per image
                </p>
              </div>

              {/* Image Preview Gallery */}
              {imagePreviews.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-[#1C1C1E] mb-3">
                    Uploaded Photos ({imagePreviews.length})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={preview}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-32 sm:h-40 object-cover rounded-xl border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                          disabled={loading || savingDraft}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        {index === 0 && (
                          <div className="absolute bottom-2 left-2 bg-[#0071E3] text-white text-xs px-2 py-1 rounded">
                            Main
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-light border border-red-200 animate-fadeIn">
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="p-4 bg-green-50 text-green-700 rounded-xl text-sm font-light border border-green-200 animate-fadeIn">
              {success}
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={loading || savingDraft}
              className="flex-1 sm:flex-none px-6 sm:px-8 py-3 sm:py-4 bg-white border-2 border-[#0071E3] text-[#0071E3] rounded-xl text-sm sm:text-base font-medium hover:bg-[#0071E3]/5 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingDraft ? "Saving..." : "Save as Draft"}
            </button>
            <button
              type="submit"
              disabled={loading || savingDraft}
              className="flex-1 sm:flex-none px-6 sm:px-8 py-3 sm:py-4 bg-[#0071E3] text-white rounded-xl text-sm sm:text-base font-medium hover:bg-[#0051D0] transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Publishing..." : "Publish Listing"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateListing;
