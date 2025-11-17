import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { collection, addDoc, query, where, getDocs, getDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { cloudinaryConfig, CLOUDINARY_UPLOAD_URL } from "../../config/cloudinary";
import { GoogleMap, LoadScript, Marker } from "@react-google-maps/api";
import { GOOGLE_MAPS_API_KEY } from "../../config/googlemaps";

// Libraries array must be constant to avoid LoadScript reload warnings
const GOOGLE_MAPS_LIBRARIES = ["places", "geometry"];

const CreateListingFlow = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get("category"); // place, service, experience
  const listingId = searchParams.get("id"); // For editing existing listings
  const [isEditing, setIsEditing] = useState(false);
  const [loadingListing, setLoadingListing] = useState(false);

  // Step management
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    category: category || "",
    describePlace: "", // Entire Place, Private Room, Shared Room
    placeType: "", // House, Cabin, Apartment, etc.
    serviceType: "", // Photography, Catering, etc.
    activityType: "", // Hiking, Food Tour, etc.
    subcategory: "", // Resort, Hotel, Transient for places
    title: "",
    description: "",
    location: "",
    address: "",
    city: "",
    province: "",
    zipcode: "",
    price: "",
    maxGuests: "",
    bedrooms: 0,
    beds: 0,
    bathrooms: 0,
    amenities: [],
    experiences: [],
    services: [],
    businessHours: {},
    transportation: "",
    itinerary: [],
    promoCode: "",
    promoDescription: "",
    discount: 0,
    maxUses: 0,
  });

  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [coordinates, setCoordinates] = useState({ lat: null, lng: null });
  const [mapCenter, setMapCenter] = useState({ lat: 14.5995, lng: 120.9842 });
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState({
    plan: "starter",
    limit: 3,
    activeCount: 0,
  });

  // Define steps based on category
  const getSteps = () => {
    if (category === "place") {
      return [
        { id: "describePlace", title: "Describe Place", component: "DescribePlace", validation: () => formData.describePlace !== "" },
        { id: "placeType", title: "Type of Place", component: "PlaceTypeSelection", validation: () => formData.placeType !== "" },
        { id: "location", title: "Location", component: "Location", validation: () => formData.address.trim() !== "" && formData.city.trim() !== "" && formData.province.trim() !== "" && formData.zipcode.trim() !== "" && formData.location.trim() !== "" && coordinates.lat !== null },
        { id: "basicInfo", title: "Basic Info", component: "BasicInfo", validation: () => true },
        { id: "guests", title: "Number of Guest", component: "Guests", validation: () => formData.maxGuests !== "" && parseInt(formData.maxGuests) > 0 },
        { id: "amenities", title: "Amenities", component: "Amenities", validation: () => true },
        { id: "photos", title: "Photos", component: "Photos", validation: () => imagePreviews.length > 0 },
        { id: "titleDescription", title: "Title & Description", component: "TitleDescription", validation: () => formData.title.trim() !== "" && formData.description.trim() !== "" },
        { id: "pricing", title: "Pricing", component: "Pricing", validation: () => formData.price !== "" && parseFloat(formData.price) > 0 },
        { id: "discounts", title: "Discounts", component: "Discounts", validation: () => true },
        { id: "preview", title: "Preview & Publish", component: "Preview", validation: () => true },
      ];
    } else if (category === "service") {
      return [
        { id: "serviceType", title: "Choose your service", component: "ServiceTypeSelection" },
        { id: "qualification", title: "Your qualifications", component: "Qualification" },
        { id: "location", title: "Where do you provide this service?", component: "Location" },
        { id: "photos", title: "Add photos", component: "Photos" },
        { id: "titleDescription", title: "Title & Description", component: "TitleDescription" },
        { id: "intro", title: "Introduction", component: "Intro" },
        { id: "guests", title: "Maximum capacity", component: "Guests" },
        { id: "pricing", title: "Set your price", component: "Pricing" },
        { id: "businessHours", title: "Business hours", component: "BusinessHours" },
        { id: "discounts", title: "Discounts & Offers", component: "Discounts" },
        { id: "preview", title: "Preview & Publish", component: "Preview" },
      ];
    } else if (category === "experience") {
      return [
        { id: "activityType", title: "Choose your activity", component: "ActivityTypeSelection" },
        { id: "experience", title: "Experience details", component: "ExperienceDetails" },
        { id: "qualification", title: "Your qualifications", component: "Qualification" },
        { id: "location", title: "Where does this take place?", component: "Location" },
        { id: "photos", title: "Add photos", component: "Photos" },
        { id: "titleDescription", title: "Title & Description", component: "TitleDescription" },
        { id: "itinerary", title: "Create itinerary", component: "Itinerary" },
        { id: "businessHours", title: "Schedule", component: "BusinessHours" },
        { id: "guests", title: "Group size", component: "Guests" },
        { id: "transportation", title: "Transportation", component: "Transportation" },
        { id: "pricing", title: "Experience pricing", component: "Pricing" },
        { id: "discounts", title: "Experience discounts", component: "Discounts" },
        { id: "preview", title: "Preview & Publish", component: "Preview" },
      ];
    }
    return [];
  };

  const steps = getSteps();
  const totalSteps = steps.length;
  const progressPercentage = ((currentStep + 1) / totalSteps) * 100;

  // Redirect if no category
  useEffect(() => {
    if (!category || !["place", "service", "experience"].includes(category)) {
      navigate("/host/select-listing-type");
    }
  }, [category, navigate]);

  // Load existing listing data when editing
  useEffect(() => {
    const loadListing = async () => {
      if (!listingId || !currentUser) return;

      try {
        setLoadingListing(true);
        const listingDoc = await getDoc(doc(db, "listings", listingId));
        
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

        setIsEditing(true);
        
        // Populate form data
        setFormData(prev => ({
          ...prev,
          category: data.category || category || "",
          describePlace: data.describePlace || "",
          placeType: data.placeType || "",
          serviceType: data.serviceType || "",
          activityType: data.activityType || "",
          subcategory: data.subcategory || "",
          title: data.title || "",
          description: data.description || "",
          location: data.location || "",
          address: data.address || "",
          city: data.city || "",
          province: data.province || "",
          zipcode: data.zipcode || "",
          price: data.price ? data.price.toString() : "",
          maxGuests: data.maxGuests ? data.maxGuests.toString() : "",
          bedrooms: data.bedrooms || 0,
          beds: data.beds || 0,
          bathrooms: data.bathrooms || 0,
          amenities: data.amenities || [],
          experiences: data.experiences || [],
          services: data.services || [],
          businessHours: data.businessHours || {},
          transportation: data.transportation || "",
          itinerary: data.itinerary || [],
          promoCode: data.promoCode || "",
          promoDescription: data.promoDescription || "",
          discount: data.discount || 0,
          maxUses: data.maxUses || 0,
        }));

        // Load images
        if (data.imageUrls && Array.isArray(data.imageUrls) && data.imageUrls.length > 0) {
          setImagePreviews(data.imageUrls.filter(url => url && url.trim() !== ""));
        } else if (data.imageUrl) {
          setImagePreviews([data.imageUrl]);
        }

        // Load coordinates
        if (data.latitude && data.longitude) {
          setCoordinates({ lat: data.latitude, lng: data.longitude });
          setMapCenter({ lat: data.latitude, lng: data.longitude });
        }
      } catch (error) {
        console.error("Error loading listing:", error);
        setError("Failed to load listing data");
      } finally {
        setLoadingListing(false);
      }
    };

    loadListing();
  }, [listingId, currentUser, category, navigate]);

  // Track changes
  useEffect(() => {
    const hasData = formData.title.trim() || 
                   formData.description.trim() || 
                   formData.location.trim() || 
                   formData.price || 
                   images.length > 0 ||
                   coordinates.lat !== null ||
                   formData.placeType ||
                   formData.serviceType ||
                   formData.activityType;
    setHasChanges(hasData);
  }, [formData, images, coordinates]);

  // Get user's location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setMapCenter({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => console.log("Geolocation not available")
      );
    }
  }, []);

  // Save as draft (manual only)
  const saveAsDraft = async () => {
    if (!hasChanges && !isEditing) return;
    
    try {
      setSavingDraft(true);
      let newImageUrls = [];

      // Upload new images if any
      if (images.length > 0) {
        const uploadPromises = images.map(async (image) => {
          const formDataUpload = new FormData();
          formDataUpload.append("file", image);
          formDataUpload.append("upload_preset", cloudinaryConfig.uploadPreset);
          formDataUpload.append("folder", `voyago/listings/${currentUser.uid}${isEditing ? "" : "/drafts"}`);

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

        newImageUrls = (await Promise.all(uploadPromises)).filter(url => url !== null);
      }

      // Merge existing imageUrls with new ones when editing
      // Filter out base64 data URLs (they start with "data:") and keep only actual URLs
      const existingImageUrls = isEditing && imagePreviews.length > 0
        ? imagePreviews.filter(url => !url.startsWith("data:"))
        : [];
      const allImageUrls = [...existingImageUrls, ...newImageUrls];

      const draftData = {
        title: formData.title.trim() || "Untitled Listing",
        description: formData.description.trim() || "",
        location: formData.location.trim() || "",
        address: formData.address.trim() || "",
        city: formData.city.trim() || "",
        province: formData.province.trim() || "",
        zipcode: formData.zipcode.trim() || "",
        price: formData.price ? parseFloat(formData.price) : 0,
        category: formData.subcategory || (category === "place" ? "resort" : category),
        describePlace: formData.describePlace || null,
        placeType: formData.placeType || null,
        serviceType: formData.serviceType || null,
        activityType: formData.activityType || null,
        maxGuests: formData.maxGuests ? parseInt(formData.maxGuests) : 1,
        bedrooms: formData.bedrooms || 0,
        beds: formData.beds || 0,
        bathrooms: formData.bathrooms || 0,
        amenities: formData.amenities || [],
        experiences: formData.experiences || [],
        services: formData.services || [],
        businessHours: formData.businessHours || {},
        transportation: formData.transportation || "",
        itinerary: formData.itinerary || [],
        promoCode: formData.promoCode || "",
        promoDescription: formData.promoDescription || "",
        discount: formData.discount || 0,
        maxUses: formData.maxUses || 0,
        imageUrl: allImageUrls[0] || "", // First photo as thumbnail
        imageUrls: allImageUrls,
        latitude: coordinates.lat || null,
        longitude: coordinates.lng || null,
        updatedAt: new Date().toISOString(),
        status: "draft",
      };

      if (isEditing && listingId) {
        // Update existing listing
        await updateDoc(doc(db, "listings", listingId), draftData);
        console.log("Draft updated");
      } else {
        // Create new draft
        await addDoc(collection(db, "listings"), {
          ...draftData,
          hostId: currentUser.uid,
          hostEmail: currentUser.email,
          createdAt: new Date().toISOString(),
        });
        console.log("Draft saved automatically");
      }
    } catch (err) {
      console.error("Error saving draft:", err);
    } finally {
      setSavingDraft(false);
    }
  };

  const handleNext = () => {
    const currentStepData = steps[currentStep];
    if (currentStepData?.validation && !currentStepData.validation()) {
      setError("Please complete the required fields before proceeding.");
      return;
    }
    setError("");
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  // Check if current step is valid
  const isCurrentStepValid = () => {
    const currentStepData = steps[currentStep];
    if (!currentStepData?.validation) return true;
    return currentStepData.validation();
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    } else {
      // Go back to category selection without auto-saving
      navigate("/host/select-listing-type");
    }
  };

  const handleSaveAndExit = async () => {
    if (hasChanges) {
      await saveAsDraft();
    }
    navigate("/host/listings");
  };

  const handlePublish = async () => {
    setLoading(true);
    setError("");

    // Validation
    if (!formData.title.trim() || !formData.location.trim() || !formData.price) {
      setError("Please complete all required fields.");
      setLoading(false);
      return;
    }

    // Check subscription limit (only for new listings, not when editing)
    if (!isEditing) {
      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const subscriptionPlan = userData.subscriptionPlan || "starter";
          const subscriptionStatus = userData.subscriptionStatus || "inactive";
          
          // Check if subscription is active
          if (subscriptionStatus !== "active") {
            setError("❌ Your subscription is not active. Please complete your subscription payment in the onboarding process.");
            setLoading(false);
            return;
          }
          
          // Get plan limits
          const planLimits = {
            starter: 3,
            pro: 10,
            elite: 1000 // Unlimited (but we'll use 1000 as a high number)
          };
          
          const listingLimit = planLimits[subscriptionPlan] || 3;
          
          // Count existing active listings
          const listingsQuery = query(
            collection(db, "listings"),
            where("hostId", "==", currentUser.uid),
            where("status", "==", "active")
          );
          const listingsSnapshot = await getDocs(listingsQuery);
          const activeListingsCount = listingsSnapshot.size;
          
          // Check if limit is reached (for elite, 1000 is effectively unlimited)
          if (subscriptionPlan !== "elite" && activeListingsCount >= listingLimit) {
            // Show upgrade modal instead of blocking
            setSubscriptionInfo({
              plan: subscriptionPlan,
              limit: listingLimit,
              activeCount: activeListingsCount,
            });
            setShowUpgradeModal(true);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.error("Error checking subscription limit:", err);
        setError("Failed to verify subscription. Please try again.");
        setLoading(false);
        return;
      }
    }

    try {
      let newImageUrls = [];

      // Upload new images if any
      if (images.length > 0) {
        const uploadPromises = images.map(async (image) => {
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
            return data.secure_url;
          }
          return null;
        });

        newImageUrls = (await Promise.all(uploadPromises)).filter(url => url !== null);
      }

      // Merge existing imageUrls with new ones when editing
      // Filter out base64 data URLs (they start with "data:") and keep only actual URLs
      const existingImageUrls = isEditing && imagePreviews.length > 0
        ? imagePreviews.filter(url => !url.startsWith("data:"))
        : [];
      const allImageUrls = [...existingImageUrls, ...newImageUrls];

      const listingData = {
        title: formData.title.trim(),
        description: formData.description.trim() || "",
        location: formData.location.trim(),
        address: formData.address.trim() || "",
        city: formData.city.trim() || "",
        province: formData.province.trim() || "",
        zipcode: formData.zipcode.trim() || "",
        price: parseFloat(formData.price),
        category: formData.subcategory || (category === "place" ? "resort" : category),
        describePlace: formData.describePlace || null,
        placeType: formData.placeType || null,
        serviceType: formData.serviceType || null,
        activityType: formData.activityType || null,
        maxGuests: formData.maxGuests ? parseInt(formData.maxGuests) : 1,
        bedrooms: formData.bedrooms || 0,
        beds: formData.beds || 0,
        bathrooms: formData.bathrooms || 0,
        amenities: formData.amenities || [],
        experiences: formData.experiences || [],
        services: formData.services || [],
        promoCode: formData.promoCode || "",
        promoDescription: formData.promoDescription || "",
        discount: formData.discount || 0,
        maxUses: formData.maxUses || 0,
        imageUrl: allImageUrls[0] || "", // First photo as thumbnail
        imageUrls: allImageUrls,
        latitude: coordinates.lat || null,
        longitude: coordinates.lng || null,
        updatedAt: new Date().toISOString(),
        status: "active",
      };

      if (isEditing && listingId) {
        // Update existing listing
        await updateDoc(doc(db, "listings", listingId), listingData);
      } else {
        // Create new listing
        await addDoc(collection(db, "listings"), {
          ...listingData,
          hostId: currentUser.uid,
          hostEmail: currentUser.email,
          createdAt: new Date().toISOString(),
        });
      }
      navigate("/host/listings");
    } catch (err) {
      console.error("Error publishing listing:", err);
      setError("Failed to publish listing. Please try again.");
    } finally {
      setLoading(false);
    }
  };


  // Render step component
  const renderStep = () => {
    const step = steps[currentStep];
    if (!step) return null;

    switch (step.component) {
      case "DescribePlace":
        return <DescribePlace formData={formData} setFormData={setFormData} />;
      case "PlaceTypeSelection":
        return <PlaceTypeSelection formData={formData} setFormData={setFormData} />;
      case "ServiceTypeSelection":
        return <ServiceTypeSelection formData={formData} setFormData={setFormData} />;
      case "ActivityTypeSelection":
        return <ActivityTypeSelection formData={formData} setFormData={setFormData} />;
      case "Location":
        return (
          <LocationStep
            formData={formData}
            setFormData={setFormData}
            coordinates={coordinates}
            setCoordinates={setCoordinates}
            mapCenter={mapCenter}
            setMapCenter={setMapCenter}
            mapLoaded={mapLoaded}
            setMapLoaded={setMapLoaded}
            mapRef={mapRef}
          />
        );
      case "BasicInfo":
        return <BasicInfo formData={formData} setFormData={setFormData} />;
      case "Guests":
        return <Guests formData={formData} setFormData={setFormData} />;
      case "Amenities":
        return <Amenities formData={formData} setFormData={setFormData} />;
      case "Photos":
        return (
          <Photos
            images={images}
            setImages={setImages}
            imagePreviews={imagePreviews}
            setImagePreviews={setImagePreviews}
          />
        );
      case "TitleDescription":
        return <TitleDescription formData={formData} setFormData={setFormData} />;
      case "Pricing":
        return <Pricing formData={formData} setFormData={setFormData} />;
      case "Discounts":
        return <Discounts formData={formData} setFormData={setFormData} />;
      case "Preview":
        return <Preview formData={formData} imagePreviews={imagePreviews} coordinates={coordinates} />;
      case "ExperienceDetails":
        return <ExperienceDetails formData={formData} setFormData={setFormData} />;
      case "Qualification":
        return <Qualification formData={formData} setFormData={setFormData} />;
      case "Itinerary":
        return <Itinerary formData={formData} setFormData={setFormData} />;
      case "BusinessHours":
        return <BusinessHours formData={formData} setFormData={setFormData} />;
      case "Transportation":
        return <Transportation formData={formData} setFormData={setFormData} />;
      case "Intro":
        return <Intro formData={formData} setFormData={setFormData} />;
      default:
        return <div>Step not implemented</div>;
    }
  };

  if (!category || loadingListing) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="text-[#1C1C1E] font-light">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* Progress Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Step Names */}
          {category === "place" && (
            <div className="flex items-center justify-between mb-3 overflow-x-auto pb-2 scrollbar-hide">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`flex-shrink-0 text-xs font-light transition-colors ${
                    index === currentStep
                      ? "text-[#0071E3] border-b-2 border-[#0071E3] pb-1"
                      : index < currentStep
                      ? "text-[#1C1C1E]"
                      : "text-[#8E8E93]"
                  }`}
                >
                  {step.title}
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-light text-[#8E8E93]">
              Step {currentStep + 1} of {totalSteps} • {steps[currentStep]?.title}
            </span>
            <button
              onClick={handleSaveAndExit}
              disabled={savingDraft}
              className="text-sm font-light text-[#8E8E93] hover:text-[#1C1C1E] transition-colors disabled:opacity-50"
            >
              {savingDraft ? "Saving..." : "Save & Exit"}
            </button>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-[#0071E3] h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          <div className="text-right mt-2">
            <span className="text-sm font-light text-[#0071E3]">
              {Math.round(progressPercentage)}% Complete
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="bg-white rounded-3xl shadow-sm p-6 sm:p-8 lg:p-12 animate-fadeInUp">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm border-2 border-red-100">
              {error}
            </div>
          )}

          {renderStep()}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={handleBack}
              disabled={loading || savingDraft}
              className="px-6 py-3 bg-gray-100 text-[#1C1C1E] rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {currentStep === 0 ? "Back to Categories" : "Back"}
            </button>
            {currentStep === totalSteps - 1 ? (
              <button
                onClick={handlePublish}
                disabled={loading || savingDraft}
                className="px-8 py-3 bg-[#0071E3] text-white rounded-xl text-sm font-medium hover:bg-[#0051D0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Publishing..." : "Publish Listing"}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={loading || savingDraft || !isCurrentStepValid()}
                className={`px-8 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isCurrentStepValid()
                    ? "bg-[#0071E3] text-white hover:bg-[#0051D0]"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Upgrade Plan Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 animate-fadeIn overflow-y-auto">
          {/* Blurred Background Overlay */}
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-md"
            onClick={() => setShowUpgradeModal(false)}
          />

          {/* Modal Content */}
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden animate-scaleIn my-8">
            <div className="p-6 sm:p-8">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl sm:text-3xl font-light text-[#1C1C1E] mb-2">
                    Upgrade Your Plan
                  </h3>
                  <p className="text-sm text-[#8E8E93] font-light">
                    You've reached your {subscriptionInfo.plan.charAt(0).toUpperCase() + subscriptionInfo.plan.slice(1)} plan limit of {subscriptionInfo.limit} active listings.
                  </p>
                </div>
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="text-[#8E8E93] hover:text-[#1C1C1E] transition-colors flex-shrink-0"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Current Usage */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-light text-[#1C1C1E]">Current Usage:</span>
                  <span className="text-lg font-medium text-[#FF3B30]">
                    {subscriptionInfo.activeCount} / {subscriptionInfo.limit} listings
                  </span>
                </div>
              </div>

              {/* Available Plans */}
              <div className="mb-6">
                <h4 className="text-lg font-light text-[#1C1C1E] mb-4">Choose a plan that fits your needs:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(() => {
                    const allPlans = [
                      {
                        id: "starter",
                        name: "Starter",
                        price: 29,
                        listings: 3,
                        description: "Perfect for new hosts",
                      },
                      {
                        id: "pro",
                        name: "Pro",
                        price: 79,
                        listings: 10,
                        description: "Ideal for growing hosts",
                        popular: true,
                      },
                      {
                        id: "elite",
                        name: "Elite",
                        price: 199,
                        listings: 1000,
                        description: "Best for businesses",
                      },
                    ];
                    
                    // Filter out current plan and show only upgrade options
                    const upgradePlans = allPlans.filter(plan => {
                      if (subscriptionInfo.plan === "starter") {
                        return plan.id === "pro" || plan.id === "elite";
                      } else if (subscriptionInfo.plan === "pro") {
                        return plan.id === "elite";
                      }
                      return false; // Elite has no upgrades
                    });

                    return upgradePlans.map((plan) => (
                      <div
                        key={plan.id}
                        className={`relative bg-white border-2 rounded-2xl p-6 transition-all duration-300 hover:shadow-lg ${
                          plan.popular
                            ? "border-[#0071E3] shadow-md"
                            : "border-gray-200 hover:border-[#0071E3]/50"
                        }`}
                      >
                        {plan.popular && (
                          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-[#0071E3] text-white px-3 py-1 rounded-full text-xs font-medium">
                            Most Popular
                          </div>
                        )}
                        <h5 className="text-xl font-light text-[#1C1C1E] mb-2">{plan.name}</h5>
                        <div className="mb-3">
                          <span className="text-3xl font-light text-[#1C1C1E]">${plan.price}</span>
                          <span className="text-sm text-[#8E8E93] font-light"> / year</span>
                        </div>
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-[#34C759]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-sm font-light text-[#1C1C1E]">
                              {plan.listings === 1000 ? "Unlimited" : plan.listings} listings
                            </span>
                          </div>
                          <p className="text-xs text-[#8E8E93] font-light">{plan.description}</p>
                        </div>
                        <button
                          onClick={() => {
                            setShowUpgradeModal(false);
                            navigate("/host/onboarding?upgrade=true&plan=" + plan.id);
                          }}
                          className={`w-full py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                            plan.popular
                              ? "bg-[#0071E3] text-white hover:bg-[#0051D0] shadow-sm"
                              : "bg-gray-100 text-[#1C1C1E] hover:bg-gray-200"
                          }`}
                        >
                          Upgrade to {plan.name}
                        </button>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <p className="text-xs text-[#8E8E93] font-light">
                  You can save your current listing as a draft and continue after upgrading.
                </p>
                <button
                  onClick={() => {
                    setShowUpgradeModal(false);
                    handleSaveAndExit();
                  }}
                  className="px-4 py-2 bg-gray-100 text-[#1C1C1E] rounded-xl text-sm font-medium hover:bg-gray-200 transition-all duration-200"
                >
                  Save as Draft
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Step Components
const PlaceTypeSelection = ({ formData, setFormData }) => {
  const placeTypes = [
    { id: "house", label: "House", icon: "🏠" },
    { id: "cabin", label: "Cabin", icon: "🏡" },
    { id: "apartment", label: "Apartment", icon: "🏢" },
    { id: "villa", label: "Villa", icon: "🏛️" },
    { id: "bungalow", label: "Bungalow", icon: "🏘️" },
    { id: "farmhouse", label: "Farmhouse", icon: "🚜" },
    { id: "condo", label: "Condo", icon: "🏬" },
    { id: "loft", label: "Loft", icon: "🏭" },
    { id: "tiny-home", label: "Tiny Home", icon: "📦" },
    { id: "tent", label: "Tent", icon: "⛺" },
    { id: "rv", label: "RV / Camper", icon: "🚐" },
    { id: "boat", label: "Boat", icon: "⛵" },
    { id: "castle", label: "Castle", icon: "🏰" },
    { id: "dome", label: "Dome", icon: "🌐" },
    { id: "treehouse", label: "Treehouse", icon: "🌳" },
  ];

  return (
    <div className="space-y-6 animate-fadeInUp">
      <h2 className="text-3xl sm:text-4xl font-light text-[#1C1C1E] mb-2">What type of place is this?</h2>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
        {placeTypes.map((type) => (
          <button
            key={type.id}
            onClick={() => setFormData(prev => ({ ...prev, placeType: type.id }))}
            className={`p-6 rounded-2xl border-2 transition-all duration-200 ${
              formData.placeType === type.id
                ? "border-[#0071E3] bg-[#0071E3]/5 shadow-md"
                : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
            }`}
          >
            <div className="text-4xl mb-2">{type.icon}</div>
            <div className="text-sm font-medium text-[#1C1C1E]">{type.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

const ServiceTypeSelection = ({ formData, setFormData }) => {
  const serviceTypes = [
    { id: "photography", label: "Photography", description: "Capture memories professionally", icon: "📷" },
    { id: "catering", label: "Catering", description: "Delicious food for events", icon: "🍽️" },
    { id: "chef", label: "Chef", description: "Hire a private chef for your occasion", icon: "👨‍🍳" },
    { id: "hairstyling", label: "Hairstyling", description: "Professional hair services", icon: "💇" },
  ];

  return (
    <div className="space-y-6 animate-fadeInUp">
      <h2 className="text-3xl sm:text-4xl font-light text-[#1C1C1E] mb-2">Choose Your Service</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {serviceTypes.map((type) => (
          <button
            key={type.id}
            onClick={() => setFormData(prev => ({ ...prev, serviceType: type.id }))}
            className={`p-6 rounded-2xl border-2 transition-all duration-200 text-left ${
              formData.serviceType === type.id
                ? "border-[#0071E3] bg-[#0071E3]/5 shadow-md"
                : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
            }`}
          >
            <div className="text-4xl mb-3">{type.icon}</div>
            <div className="text-lg font-medium text-[#1C1C1E] mb-1">{type.label}</div>
            <div className="text-sm text-[#8E8E93] font-light">{type.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

const ActivityTypeSelection = ({ formData, setFormData }) => {
  const activityTypes = [
    { id: "hiking", label: "Hiking", description: "Explore nature trails", icon: "🥾" },
    { id: "food-tour", label: "Food Tour", description: "Discover local cuisine", icon: "🍕" },
    { id: "museum-tour", label: "Museum Tour", description: "Immerse in art & history", icon: "🏛️" },
    { id: "theme-park", label: "Theme Park Tour", description: "Enjoy thrilling rides and attractions", icon: "🎢" },
  ];

  return (
    <div className="space-y-6 animate-fadeInUp">
      <h2 className="text-3xl sm:text-4xl font-light text-[#1C1C1E] mb-2">Choose Your Activity</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {activityTypes.map((type) => (
          <button
            key={type.id}
            onClick={() => setFormData(prev => ({ ...prev, activityType: type.id }))}
            className={`p-6 rounded-2xl border-2 transition-all duration-200 text-left ${
              formData.activityType === type.id
                ? "border-[#0071E3] bg-[#0071E3]/5 shadow-md"
                : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
            }`}
          >
            <div className="text-4xl mb-3">{type.icon}</div>
            <div className="text-lg font-medium text-[#1C1C1E] mb-1">{type.label}</div>
            <div className="text-sm text-[#8E8E93] font-light">{type.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

const DescribePlace = ({ formData, setFormData }) => {
  const options = [
    { id: "entire", label: "Entire Place", description: "Guests have the whole place", icon: "🏠" },
    { id: "private", label: "Private Room", description: "Guests share some spaces", icon: "🚪" },
    { id: "shared", label: "Shared Room", description: "Guests stay in a shared space", icon: "🛏️" },
  ];

  return (
    <div className="space-y-6 animate-fadeInUp">
      <div>
      <h2 className="text-3xl sm:text-4xl font-light text-[#1C1C1E] mb-2">Describe Place</h2>
        <p className="text-sm text-[#8E8E93] font-light">Choose how guests will experience your place</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {options.map((option) => (
          <button
            key={option.id}
            onClick={() => setFormData(prev => ({ ...prev, describePlace: option.id }))}
            className={`group p-6 rounded-2xl border-2 transition-all duration-200 text-left hover:shadow-lg ${
              formData.describePlace === option.id
                ? "border-[#0071E3] bg-[#0071E3]/5 shadow-md"
                : "border-gray-200 hover:border-[#0071E3]/30 hover:bg-gray-50"
            }`}
          >
            <div className="text-4xl mb-3">{option.icon}</div>
            <div className="text-lg sm:text-xl font-semibold text-[#1C1C1E] mb-2 group-hover:text-[#0071E3] transition-colors">
              {option.label}
            </div>
            <div className="text-sm text-[#8E8E93] font-light leading-relaxed">{option.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

const LocationStep = ({ formData, setFormData, coordinates, setCoordinates, mapCenter, setMapCenter, mapLoaded, setMapLoaded, mapRef }) => {
  const [searchQuery, setSearchQuery] = useState(formData.location || "");

  // Reset mapLoaded when component mounts to ensure fresh state
  useEffect(() => {
    setMapLoaded(false);
    mapRef.current = null;
  }, []);

  // Initialize search query from formData when component mounts or location changes
  useEffect(() => {
    if (formData.location && formData.location.trim() !== "" && !searchQuery) {
      setSearchQuery(formData.location);
    } else if (!formData.location && (formData.address || formData.city)) {
      // If no location but we have address fields, construct a search query
      const constructed = `${formData.address || ""}, ${formData.city || ""}, ${formData.province || ""} ${formData.zipcode || ""}`.trim().replace(/,\s*,/g, ",").replace(/,\s*$/, "");
      if (constructed && !searchQuery) {
        setSearchQuery(constructed);
      }
    }
  }, [formData.location, formData.address, formData.city]);

  // Initialize address fields from coordinates when map loads
  useEffect(() => {
    if (mapLoaded && coordinates.lat && coordinates.lng && (!formData.address || !formData.city)) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat: coordinates.lat, lng: coordinates.lng } }, (results, status) => {
        if (status === "OK" && results[0]) {
          const addressComponents = results[0].address_components;
          const parsed = { address: "", city: "", province: "", zipcode: "" };
          addressComponents.forEach(component => {
            if (component.types.includes("street_number") || component.types.includes("route")) {
              parsed.address = (parsed.address || "") + component.long_name + " ";
            }
            if (component.types.includes("locality")) parsed.city = component.long_name;
            if (component.types.includes("administrative_area_level_1")) parsed.province = component.long_name;
            if (component.types.includes("postal_code")) parsed.zipcode = component.long_name;
          });
          // Only update if fields are empty
          if (!formData.address || !formData.city) {
            setFormData(prev => ({
              ...prev,
              address: parsed.address.trim() || prev.address,
              city: parsed.city || prev.city,
              province: parsed.province || prev.province,
              zipcode: parsed.zipcode || prev.zipcode,
              location: results[0].formatted_address || prev.location,
            }));
            setSearchQuery(results[0].formatted_address);
          }
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, coordinates.lat, coordinates.lng]);


  const handleAddressSearch = async () => {
    const searchAddress = searchQuery.trim();
    if (!searchAddress || !mapLoaded) {
      return;
    }

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: searchAddress }, (results, status) => {
      if (status === "OK" && results[0]) {
        const location = results[0].geometry.location;
        const lat = location.lat();
        const lng = location.lng();
        
        // Update coordinates
        setCoordinates({ lat, lng });
        setMapCenter({ lat, lng });
        
        // Parse and populate address fields
        const addressComponents = results[0].address_components;
        const parsed = { address: "", city: "", province: "", zipcode: "" };
        addressComponents.forEach(component => {
          if (component.types.includes("street_number") || component.types.includes("route")) {
            parsed.address = (parsed.address || "") + component.long_name + " ";
          }
          if (component.types.includes("locality")) parsed.city = component.long_name;
          if (component.types.includes("administrative_area_level_1")) parsed.province = component.long_name;
          if (component.types.includes("postal_code")) parsed.zipcode = component.long_name;
        });

        // Update formData with all address information
        setFormData(prev => ({
          ...prev,
          address: parsed.address.trim(),
          city: parsed.city,
          province: parsed.province,
          zipcode: parsed.zipcode,
          location: results[0].formatted_address,
        }));
        
        // Update map center and zoom
        if (mapRef.current) {
          mapRef.current.setCenter({ lat, lng });
          mapRef.current.setZoom(15);
        }
      } else {
        console.error("Geocoding failed:", status);
        alert("Could not find that address. Please try a different search term.");
      }
    });
  };

  return (
    <div className="space-y-6 animate-fadeInUp">
      <h2 className="text-3xl sm:text-4xl font-light text-[#1C1C1E] mb-2">Where's your place located?</h2>
      <div className="space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter" && mapLoaded) {
                e.preventDefault();
                handleAddressSearch();
              }
            }}
            className="flex-1 px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-sm text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] transition-all"
            placeholder="Search your address..."
          />
          <button
            type="button"
            onClick={handleAddressSearch}
            className="px-6 py-3 bg-[#0071E3] text-white rounded-xl text-sm font-medium hover:bg-[#0051D0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!mapLoaded || !searchQuery.trim()}
          >
            Search
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input
            type="text"
            value={formData.address || ""}
            onChange={(e) => {
              const newAddress = e.target.value;
              setFormData(prev => {
                const fullAddress = `${newAddress}, ${prev.city || ""}, ${prev.province || ""} ${prev.zipcode || ""}`.trim().replace(/,\s*,/g, ",").replace(/,\s*$/, "");
                return {
                  ...prev,
                  address: newAddress,
                  location: fullAddress || prev.location,
                };
              });
            }}
            className="px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-sm text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] transition-all"
            placeholder="Address *"
            required
          />
          <input
            type="text"
            value={formData.city || ""}
            onChange={(e) => {
              const newCity = e.target.value;
              setFormData(prev => {
                const fullAddress = `${prev.address || ""}, ${newCity}, ${prev.province || ""} ${prev.zipcode || ""}`.trim().replace(/,\s*,/g, ",").replace(/,\s*$/, "");
                return {
                  ...prev,
                  city: newCity,
                  location: fullAddress || prev.location,
                };
              });
            }}
            className="px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-sm text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] transition-all"
            placeholder="City *"
            required
          />
          <input
            type="text"
            value={formData.province || ""}
            onChange={(e) => {
              const newProvince = e.target.value;
              setFormData(prev => {
                const fullAddress = `${prev.address || ""}, ${prev.city || ""}, ${newProvince} ${prev.zipcode || ""}`.trim().replace(/,\s*,/g, ",").replace(/,\s*$/, "");
                return {
                  ...prev,
                  province: newProvince,
                  location: fullAddress || prev.location,
                };
              });
            }}
            className="px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-sm text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] transition-all"
            placeholder="Province *"
            required
          />
          <input
            type="text"
            value={formData.zipcode || ""}
            onChange={(e) => {
              const newZipcode = e.target.value;
              setFormData(prev => {
                const fullAddress = `${prev.address || ""}, ${prev.city || ""}, ${prev.province || ""} ${newZipcode}`.trim().replace(/,\s*,/g, ",").replace(/,\s*$/, "");
                return {
                  ...prev,
                  zipcode: newZipcode,
                  location: fullAddress || prev.location,
                };
              });
            }}
            className="px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-sm text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] transition-all"
            placeholder="Zipcode *"
            required
          />
        </div>
      </div>
      <div className="w-full h-64 rounded-xl overflow-hidden border-2 border-gray-200">
        <LoadScript 
          googleMapsApiKey={GOOGLE_MAPS_API_KEY} 
          libraries={GOOGLE_MAPS_LIBRARIES}
        >
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
                const geocoder = new window.google.maps.Geocoder();
                geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                  if (status === "OK" && results[0]) {
                    const address = results[0].formatted_address;
                    setSearchQuery(address);
                    // Parse address components if available
                    const addressComponents = results[0].address_components;
                    const parsed = { address: "", city: "", province: "", zipcode: "" };
                    addressComponents.forEach(component => {
                      if (component.types.includes("street_number") || component.types.includes("route")) {
                        parsed.address = (parsed.address || "") + component.long_name + " ";
                      }
                      if (component.types.includes("locality")) parsed.city = component.long_name;
                      if (component.types.includes("administrative_area_level_1")) parsed.province = component.long_name;
                      if (component.types.includes("postal_code")) parsed.zipcode = component.long_name;
                    });
                    setFormData(prev => ({
                      ...prev,
                      address: parsed.address.trim(),
                      city: parsed.city,
                      province: parsed.province,
                      zipcode: parsed.zipcode,
                      location: address,
                    }));
                  }
                });
              }
            }}
            onLoad={(map) => {
              mapRef.current = map;
              setMapLoaded(true);
              // Center map on existing coordinates if available
              if (coordinates.lat && coordinates.lng) {
                map.setCenter({ lat: coordinates.lat, lng: coordinates.lng });
                map.setZoom(15);
              } else if (formData.location && formData.location.trim() !== "") {
                // If we have a location but no coordinates, geocode it
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
                    const geocoder = new window.google.maps.Geocoder();
                    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                      if (status === "OK" && results[0]) {
                        const address = results[0].formatted_address;
                        setFormData(prev => ({ ...prev, location: address }));
                        setSearchQuery(address);
                        // Parse address components
                        const addressComponents = results[0].address_components;
                        const parsed = { address: "", city: "", province: "", zipcode: "" };
                        addressComponents.forEach(component => {
                          if (component.types.includes("street_number") || component.types.includes("route")) {
                            parsed.address = (parsed.address || "") + component.long_name + " ";
                          }
                          if (component.types.includes("locality")) parsed.city = component.long_name;
                          if (component.types.includes("administrative_area_level_1")) parsed.province = component.long_name;
                          if (component.types.includes("postal_code")) parsed.zipcode = component.long_name;
                        });
                        setFormData(prev => ({
                          ...prev,
                          address: parsed.address.trim(),
                          city: parsed.city,
                          province: parsed.province,
                          zipcode: parsed.zipcode,
                          location: address,
                        }));
                      }
                    });
                  }
                }}
              />
            )}
          </GoogleMap>
        </LoadScript>
      </div>
      <p className="text-xs text-[#8E8E93]">
        Click on the map to pin your location, or drag the marker to adjust
      </p>
    </div>
  );
};

const BasicInfo = ({ formData, setFormData }) => {
  const updateCount = (field, delta) => {
    const currentValue = formData[field] || 0;
    const newValue = Math.max(0, currentValue + delta);
    setFormData(prev => ({ ...prev, [field]: newValue }));
  };

  return (
    <div className="space-y-6 animate-fadeInUp">
      <h2 className="text-3xl sm:text-4xl font-light text-[#1C1C1E] mb-2">Share some basic information.</h2>
      <p className="text-sm text-[#8E8E93] font-light mb-6">Let guests know about your place's setup.</p>
      <div className="space-y-4">
        {/* Bedrooms */}
        <div className="p-6 rounded-xl border-2 border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#F2F2F7] flex items-center justify-center">
                <svg className="w-6 h-6 text-[#1C1C1E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <span className="text-base font-medium text-[#1C1C1E]">Bedrooms</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => updateCount("bedrooms", -1)}
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={formData.bedrooms <= 0}
              >
                <svg className="w-5 h-5 text-[#1C1C1E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <span className="text-2xl font-light text-[#0071E3] min-w-[3rem] text-center">{formData.bedrooms || 0}</span>
              <button
                type="button"
                onClick={() => updateCount("bedrooms", 1)}
                className="w-10 h-10 rounded-full bg-[#0071E3] hover:bg-[#0051D0] flex items-center justify-center transition-colors"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Beds */}
        <div className="p-6 rounded-xl border-2 border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#F2F2F7] flex items-center justify-center">
                <svg className="w-6 h-6 text-[#1C1C1E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <span className="text-base font-medium text-[#1C1C1E]">Beds</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => updateCount("beds", -1)}
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={formData.beds <= 0}
              >
                <svg className="w-5 h-5 text-[#1C1C1E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <span className="text-2xl font-light text-[#0071E3] min-w-[3rem] text-center">{formData.beds || 0}</span>
              <button
                type="button"
                onClick={() => updateCount("beds", 1)}
                className="w-10 h-10 rounded-full bg-[#0071E3] hover:bg-[#0051D0] flex items-center justify-center transition-colors"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Bathrooms */}
        <div className="p-6 rounded-xl border-2 border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#F2F2F7] flex items-center justify-center">
                <svg className="w-6 h-6 text-[#1C1C1E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-base font-medium text-[#1C1C1E]">Bathrooms</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => updateCount("bathrooms", -1)}
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={formData.bathrooms <= 0}
              >
                <svg className="w-5 h-5 text-[#1C1C1E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <span className="text-2xl font-light text-[#0071E3] min-w-[3rem] text-center">{formData.bathrooms || 0}</span>
              <button
                type="button"
                onClick={() => updateCount("bathrooms", 1)}
                className="w-10 h-10 rounded-full bg-[#0071E3] hover:bg-[#0051D0] flex items-center justify-center transition-colors"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Guests = ({ formData, setFormData }) => {
  const updateGuests = (delta) => {
    const currentValue = parseInt(formData.maxGuests) || 0;
    const newValue = Math.max(1, currentValue + delta);
    setFormData(prev => ({ ...prev, maxGuests: newValue.toString() }));
  };

  return (
    <div className="space-y-6 animate-fadeInUp">
      <h2 className="text-3xl sm:text-4xl font-light text-[#1C1C1E] mb-2">Maximum number of guests.</h2>
      <p className="text-sm text-[#8E8E93] font-light mb-8">What's the guest capacity for your place?</p>
      <div className="flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={() => updateGuests(-1)}
          className="w-14 h-14 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={parseInt(formData.maxGuests) <= 1}
        >
          <svg className="w-6 h-6 text-[#1C1C1E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <div className="text-center">
          <div className="text-6xl font-light text-[#0071E3] mb-2">{formData.maxGuests || 1}</div>
          <div className="text-sm text-[#8E8E93] font-light">guests</div>
        </div>
        <button
          type="button"
          onClick={() => updateGuests(1)}
          className="w-14 h-14 rounded-full bg-[#0071E3] hover:bg-[#0051D0] flex items-center justify-center transition-colors"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>
  );
};

const Amenities = ({ formData, setFormData }) => {
  const [customAmenity, setCustomAmenity] = useState("");
  const standardAmenities = [
    "WiFi", "Kitchen", "Washer", "Dryer", "Air Conditioning", "Heating", "TV", "Parking", "Pool", "Hot Tub", "Gym", "Workspace"
  ];

  const toggleAmenity = (amenity) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }));
  };

  const addCustomAmenity = () => {
    if (customAmenity.trim() && !formData.amenities.includes(customAmenity.trim())) {
      setFormData(prev => ({
        ...prev,
        amenities: [...prev.amenities, customAmenity.trim()]
      }));
      setCustomAmenity("");
    }
  };

  return (
    <div className="space-y-6 animate-fadeInUp">
      <h2 className="text-3xl sm:text-4xl font-light text-[#1C1C1E] mb-2">What amenities do you offer?</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {standardAmenities.map((amenity) => (
          <button
            key={amenity}
            type="button"
            onClick={() => toggleAmenity(amenity)}
            className={`p-4 rounded-xl border-2 transition-all duration-200 ${
              formData.amenities.includes(amenity)
                ? "border-[#0071E3] bg-[#0071E3]/5"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="text-sm font-medium text-[#1C1C1E]">{amenity}</div>
          </button>
        ))}
      </div>
      <div className="border-t border-gray-200 pt-6">
        <label className="block text-sm font-medium text-[#1C1C1E] mb-2">Add Custom Amenity</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={customAmenity}
            onChange={(e) => setCustomAmenity(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && addCustomAmenity()}
            className="flex-1 px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-sm text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] transition-all"
            placeholder="Enter custom amenity"
          />
          <button
            type="button"
            onClick={addCustomAmenity}
            className="px-6 py-3 bg-[#0071E3] text-white rounded-xl text-sm font-medium hover:bg-[#0051D0] transition-colors"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
};

const Photos = ({ images, setImages, imagePreviews, setImagePreviews }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (files) => {
    const validFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    const newPreviews = [];
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        newPreviews.push(reader.result);
        if (newPreviews.length === validFiles.length) {
          setImagePreviews(prev => [...prev, ...newPreviews]);
          setImages(prev => [...prev, ...validFiles]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = (e) => {
    handleFiles(e.target.files || []);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleRemoveImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6 animate-fadeInUp">
      <h2 className="text-3xl sm:text-4xl font-light text-[#1C1C1E] mb-2">Add Photos</h2>
      <p className="text-sm text-[#8E8E93] font-light mb-6">Showcase your space with beautiful photos. The first photo will be used as the cover image.</p>
      
      {/* Drag and Drop Area */}
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
        id="photo-upload"
      />
      {imagePreviews.length === 0 ? (
        <label
          htmlFor="photo-upload"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`block w-full h-64 sm:h-80 bg-[#F2F2F7] border-2 border-dashed rounded-xl cursor-pointer transition-all flex items-center justify-center ${
            isDragging
              ? "border-[#0071E3] bg-[#0071E3]/10 scale-[1.02]"
              : "border-gray-300 hover:border-[#0071E3] hover:bg-[#0071E3]/5"
          }`}
        >
          <div className="text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-base font-medium text-[#1C1C1E] mb-1">Drag and drop photos here</p>
            <p className="text-sm text-[#8E8E93] font-light">or click to browse</p>
            <p className="text-xs text-[#8E8E93] font-light mt-2">You can upload multiple photos at once</p>
          </div>
        </label>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`w-full min-h-64 sm:min-h-80 bg-[#F2F2F7] border-2 border-dashed rounded-xl transition-all p-4 ${
            isDragging
              ? "border-[#0071E3] bg-[#0071E3]/10"
              : "border-gray-300"
          }`}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {imagePreviews.map((preview, index) => (
              <div key={index} className="relative group aspect-square">
                {index === 0 && (
                  <div className="absolute top-2 left-2 z-10 bg-[#0071E3] text-white text-xs font-medium px-2 py-1 rounded">
                    Cover
                  </div>
                )}
                <img
                  src={preview}
                  alt={`Photo ${index + 1}`}
                  className="w-full h-full object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRemoveImage(index);
                  }}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            <div
              className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-[#0071E3] transition-colors cursor-pointer"
              onClick={() => {
                document.getElementById("photo-upload").click();
              }}
            >
              <div className="text-center">
                <svg className="w-8 h-8 mx-auto mb-1 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <p className="text-xs text-[#8E8E93] font-light">Add more</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const TitleDescription = ({ formData, setFormData }) => {
  const titleMaxLength = 80;
  const descriptionMaxLength = 1000;
  const titleLength = formData.title.length;
  const descriptionLength = formData.description.length;

  return (
    <div className="space-y-6 animate-fadeInUp">
      <h2 className="text-3xl sm:text-4xl font-light text-[#1C1C1E] mb-2">Create your title and description</h2>
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-[#1C1C1E] mb-2">Title</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => {
              if (e.target.value.length <= titleMaxLength) {
                setFormData(prev => ({ ...prev, title: e.target.value }));
              }
            }}
            className="w-full px-4 py-3 bg-white border-2 border-[#0071E3]/30 rounded-xl text-sm text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] transition-all"
            placeholder="Catchy title for your listing."
            maxLength={titleMaxLength}
          />
          <div className="text-right mt-1">
            <span className={`text-xs ${titleLength >= titleMaxLength ? "text-red-500" : "text-[#8E8E93]"}`}>
              {titleLength}/{titleMaxLength} characters
            </span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#1C1C1E] mb-2">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => {
              if (e.target.value.length <= descriptionMaxLength) {
                setFormData(prev => ({ ...prev, description: e.target.value }));
              }
            }}
            rows={8}
            className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-sm text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] transition-all resize-none"
            placeholder="Describe what makes your place special..."
            maxLength={descriptionMaxLength}
          />
          <div className="text-right mt-1">
            <span className={`text-xs ${descriptionLength >= descriptionMaxLength ? "text-red-500" : "text-[#8E8E93]"}`}>
              {descriptionLength}/{descriptionMaxLength} characters
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const Pricing = ({ formData, setFormData }) => {
  return (
    <div className="space-y-6 animate-fadeInUp">
        <div>
        <h2 className="text-3xl sm:text-4xl font-light text-[#1C1C1E] mb-2">Set your price</h2>
        <p className="text-sm text-[#8E8E93] font-light">Enter the price for your listing</p>
        </div>
        <div>
        <label className="block text-sm font-medium text-[#1C1C1E] mb-3">
          Price <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-medium text-[#1C1C1E]">$</span>
          <input
            type="number"
            value={formData.price}
            onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
            min="0"
            step="0.01"
            className="w-full pl-10 pr-4 py-4 bg-white border-2 border-gray-200 rounded-xl text-base text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] transition-all"
            placeholder="0.00"
          />
        </div>
        <p className="mt-2 text-xs text-[#8E8E93] font-light">
          This is the fixed price guests will pay for your listing (USD)
        </p>
      </div>
    </div>
  );
};

const Preview = ({ formData, imagePreviews, coordinates }) => {
  const getPlaceTypeLabel = (id) => {
    const types = {
      house: "House",
      cabin: "Cabin",
      apartment: "Apartment",
      villa: "Villa",
      bungalow: "Bungalow",
      farmhouse: "Farmhouse",
      condo: "Condo",
      loft: "Loft",
      "tiny-home": "Tiny Home",
      tent: "Tent",
      rv: "RV / Camper",
      boat: "Boat",
      castle: "Castle",
      dome: "Dome",
      treehouse: "Treehouse",
    };
    return types[id] || id;
  };

  const getDescribePlaceLabel = (id) => {
    const types = {
      entire: "Entire Place",
      private: "Private Room",
      shared: "Shared Room",
    };
    return types[id] || "";
  };

  return (
    <div className="space-y-6 animate-fadeInUp">
      <h2 className="text-3xl sm:text-4xl font-light text-[#1C1C1E] mb-6">Preview & Publish</h2>
      
      {/* Cover Image */}
      {imagePreviews.length > 0 && (
        <div className="relative w-full h-64 sm:h-80 rounded-2xl overflow-hidden bg-gray-100 mb-6">
          <img
            src={imagePreviews[0]}
            alt="Cover"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end p-6">
            <div>
              <h3 className="text-3xl font-light text-white mb-1">{formData.title || "Untitled Listing"}</h3>
              <p className="text-lg text-white/90 font-light">{formData.location || "Location not set"}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-6">
        {formData.placeType && (
          <span className="px-3 py-1 bg-gray-100 text-[#1C1C1E] rounded-full text-sm font-light">
            {getPlaceTypeLabel(formData.placeType)}
          </span>
        )}
        {formData.describePlace && (
          <span className="px-3 py-1 bg-gray-100 text-[#1C1C1E] rounded-full text-sm font-light">
            {getDescribePlaceLabel(formData.describePlace)}
          </span>
        )}
      </div>

      {/* Location */}
      <div className="mb-6">
        <div className="text-sm text-[#8E8E93] mb-1">Location</div>
        <div className="text-base font-light text-[#1C1C1E]">{formData.location || "Not set"}</div>
      </div>

      {/* Basic Info Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-[#F2F2F7] rounded-xl">
          <div className="text-xs text-[#8E8E93] mb-1">Bedrooms</div>
          <div className="text-xl font-light text-[#1C1C1E]">{formData.bedrooms || 0}</div>
        </div>
        <div className="p-4 bg-[#F2F2F7] rounded-xl">
          <div className="text-xs text-[#8E8E93] mb-1">Beds</div>
          <div className="text-xl font-light text-[#1C1C1E]">{formData.beds || 0}</div>
        </div>
        <div className="p-4 bg-[#F2F2F7] rounded-xl">
          <div className="text-xs text-[#8E8E93] mb-1">Bathrooms</div>
          <div className="text-xl font-light text-[#1C1C1E]">{formData.bathrooms || 0}</div>
        </div>
        <div className="p-4 bg-[#F2F2F7] rounded-xl">
          <div className="text-xs text-[#8E8E93] mb-1">Max Guests</div>
          <div className="text-xl font-light text-[#1C1C1E]">{formData.maxGuests || 1}</div>
        </div>
      </div>

      {/* Gallery */}
      {imagePreviews.length > 1 && (
        <div className="mb-6">
          <div className="text-sm font-medium text-[#1C1C1E] mb-3">Gallery</div>
          <div className="grid grid-cols-3 gap-2">
            {imagePreviews.slice(1, 4).map((img, index) => (
              <img
                key={index}
                src={img}
                alt={`Gallery ${index + 2}`}
                className="w-full h-24 object-cover rounded-lg"
              />
            ))}
          </div>
        </div>
      )}

      {/* Pricing */}
      <div className="mb-6">
        <div className="text-sm font-medium text-[#1C1C1E] mb-3">Pricing</div>
        <div className="p-4 bg-[#F2F2F7] rounded-xl">
          <div className="text-2xl font-light text-[#1C1C1E]">
            ${formData.price || "0"} <span className="text-sm text-[#8E8E93]">/night</span>
          </div>
        </div>
      </div>

      {/* Description */}
      {formData.description && (
        <div className="mb-6">
          <div className="text-sm font-medium text-[#1C1C1E] mb-3">Description</div>
          <div className="p-4 bg-[#F2F2F7] rounded-xl">
            <p className="text-sm font-light text-[#1C1C1E] leading-relaxed">{formData.description}</p>
          </div>
        </div>
      )}

      {/* Amenities */}
      {formData.amenities && formData.amenities.length > 0 && (
        <div className="mb-6">
          <div className="text-sm font-medium text-[#1C1C1E] mb-3">Amenities</div>
          <div className="flex flex-wrap gap-2">
            {formData.amenities.map((amenity, index) => (
              <span key={index} className="px-3 py-1 bg-[#F2F2F7] text-[#1C1C1E] rounded-full text-sm font-light">
                {amenity}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Discounts = ({ formData, setFormData }) => {
  const generatePromoCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, promoCode: code }));
  };

  return (
    <div className="space-y-6 animate-fadeInUp">
      <h2 className="text-3xl sm:text-4xl font-light text-[#1C1C1E] mb-2">Create a Promo Code</h2>
      <p className="text-sm text-[#8E8E93] font-light mb-6">Generate and customize special promo codes for your guests.</p>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[#1C1C1E] mb-2">Promo Code</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={formData.promoCode}
              onChange={(e) => setFormData(prev => ({ ...prev, promoCode: e.target.value }))}
              className="flex-1 px-4 py-3 bg-[#F2F2F7] border border-transparent rounded-xl text-sm text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:bg-white transition-all"
              placeholder="Enter or generate code"
            />
            <button
              type="button"
              onClick={generatePromoCode}
              className="px-6 py-3 bg-[#0071E3] text-white rounded-xl text-sm font-medium hover:bg-[#0051D0] transition-colors"
            >
              Generate
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#1C1C1E] mb-2">Description</label>
          <textarea
            value={formData.promoDescription || ""}
            onChange={(e) => setFormData(prev => ({ ...prev, promoDescription: e.target.value }))}
            rows={3}
            className="w-full px-4 py-3 bg-[#F2F2F7] border border-transparent rounded-xl text-sm text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:bg-white transition-all resize-none"
            placeholder="e.g., Special promo for November guests"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#1C1C1E] mb-2">Discount (%)</label>
            <input
              type="number"
              value={formData.discount}
              onChange={(e) => setFormData(prev => ({ ...prev, discount: parseFloat(e.target.value) || 0 }))}
              min="0"
              max="100"
              className="w-full px-4 py-3 bg-[#F2F2F7] border border-transparent rounded-xl text-sm text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:bg-white transition-all"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1C1C1E] mb-2">Maximum Uses</label>
            <input
              type="number"
              value={formData.maxUses}
              onChange={(e) => setFormData(prev => ({ ...prev, maxUses: parseInt(e.target.value) || 0 }))}
              min="0"
              className="w-full px-4 py-3 bg-[#F2F2F7] border border-transparent rounded-xl text-sm text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:bg-white transition-all"
              placeholder="0"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Experience Details Component
const ExperienceDetails = ({ formData, setFormData }) => {
  return (
    <div className="space-y-6 animate-fadeInUp">
      <h2 className="text-3xl sm:text-4xl font-light text-[#1C1C1E] mb-2">Tell us about your experience</h2>
      <p className="text-sm text-[#8E8E93] font-light mb-6">Share what makes your experience unique and special.</p>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[#1C1C1E] mb-2">What will guests experience?</label>
          <textarea
            value={formData.description || ""}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            rows={6}
            className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-sm text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] transition-all resize-none"
            placeholder="Describe the highlights, activities, and what makes this experience memorable..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1C1C1E] mb-2">What's included?</label>
          <textarea
            value={formData.experienceDetails || ""}
            onChange={(e) => setFormData(prev => ({ ...prev, experienceDetails: e.target.value }))}
            rows={4}
            className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-sm text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] transition-all resize-none"
            placeholder="Equipment, meals, transportation, guide services, etc."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1C1C1E] mb-2">What should guests bring?</label>
          <textarea
            value={formData.guestRequirements || ""}
            onChange={(e) => setFormData(prev => ({ ...prev, guestRequirements: e.target.value }))}
            rows={3}
            className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-sm text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] transition-all resize-none"
            placeholder="Comfortable shoes, water bottle, camera, etc."
          />
        </div>
      </div>
    </div>
  );
};

// Qualification Component
const Qualification = ({ formData, setFormData }) => {
  const qualifications = [
    "Certified Guide", "Licensed Professional", "Years of Experience", "Local Expert", 
    "Safety Certified", "First Aid Certified", "Language Skills", "Awards & Recognition"
  ];

  const toggleQualification = (qual) => {
    const currentQuals = formData.qualifications || [];
    setFormData(prev => ({
      ...prev,
      qualifications: currentQuals.includes(qual)
        ? currentQuals.filter(q => q !== qual)
        : [...currentQuals, qual]
    }));
  };

  return (
    <div className="space-y-6 animate-fadeInUp">
      <h2 className="text-3xl sm:text-4xl font-light text-[#1C1C1E] mb-2">Your qualifications</h2>
      <p className="text-sm text-[#8E8E93] font-light mb-6">Help guests trust your expertise by sharing your qualifications.</p>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[#1C1C1E] mb-3">Select your qualifications</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {qualifications.map((qual) => (
              <button
                key={qual}
                type="button"
                onClick={() => toggleQualification(qual)}
                className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                  (formData.qualifications || []).includes(qual)
                    ? "border-[#0071E3] bg-[#0071E3]/5"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="text-sm font-medium text-[#1C1C1E]">{qual}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1C1C1E] mb-2">Additional Information</label>
          <textarea
            value={formData.qualificationDetails || ""}
            onChange={(e) => setFormData(prev => ({ ...prev, qualificationDetails: e.target.value }))}
            rows={4}
            className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-sm text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] transition-all resize-none"
            placeholder="Tell us more about your background, experience, certifications, or any other relevant qualifications..."
          />
        </div>
      </div>
    </div>
  );
};

// Itinerary Component
const Itinerary = ({ formData, setFormData }) => {
  const [newItem, setNewItem] = useState({ title: "", description: "", duration: "", time: "" });

  const addItineraryItem = () => {
    if (newItem.title.trim()) {
      const currentItinerary = formData.itinerary || [];
      setFormData(prev => ({
        ...prev,
        itinerary: [...currentItinerary, { ...newItem, title: newItem.title.trim() }]
      }));
      setNewItem({ title: "", description: "", duration: "", time: "" });
    }
  };

  const removeItineraryItem = (index) => {
    const currentItinerary = formData.itinerary || [];
    setFormData(prev => ({
      ...prev,
      itinerary: currentItinerary.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="space-y-6 animate-fadeInUp">
      <h2 className="text-3xl sm:text-4xl font-light text-[#1C1C1E] mb-2">Create your itinerary</h2>
      <p className="text-sm text-[#8E8E93] font-light mb-6">Break down your experience into steps or activities.</p>
      
      {/* Existing Itinerary Items */}
      {(formData.itinerary || []).length > 0 && (
        <div className="space-y-3 mb-6">
          {(formData.itinerary || []).map((item, index) => (
            <div key={index} className="p-4 bg-white border-2 border-gray-200 rounded-xl">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="font-medium text-[#1C1C1E] mb-1">{item.title || `Step ${index + 1}`}</h4>
                  {item.description && (
                    <p className="text-sm text-[#8E8E93] font-light">{item.description}</p>
                  )}
                  <div className="flex gap-4 mt-2 text-xs text-[#8E8E93]">
                    {item.duration && <span>Duration: {item.duration}</span>}
                    {item.time && <span>Time: {item.time}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeItineraryItem(index)}
                  className="ml-4 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add New Itinerary Item */}
      <div className="p-6 bg-white border-2 border-dashed border-gray-300 rounded-xl">
        <h3 className="text-lg font-medium text-[#1C1C1E] mb-4">Add Itinerary Item</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#1C1C1E] mb-2">Title *</label>
            <input
              type="text"
              value={newItem.title}
              onChange={(e) => setNewItem(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-sm text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] transition-all"
              placeholder="e.g., Welcome & Introduction"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1C1C1E] mb-2">Description</label>
            <textarea
              value={newItem.description}
              onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-sm text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] transition-all resize-none"
              placeholder="Describe what happens in this step..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1C1C1E] mb-2">Duration</label>
              <input
                type="text"
                value={newItem.duration}
                onChange={(e) => setNewItem(prev => ({ ...prev, duration: e.target.value }))}
                className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-sm text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] transition-all"
                placeholder="e.g., 2 hours"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1C1C1E] mb-2">Time</label>
              <input
                type="text"
                value={newItem.time}
                onChange={(e) => setNewItem(prev => ({ ...prev, time: e.target.value }))}
                className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-sm text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] transition-all"
                placeholder="e.g., 9:00 AM"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={addItineraryItem}
            disabled={!newItem.title.trim()}
            className="w-full px-6 py-3 bg-[#0071E3] text-white rounded-xl text-sm font-medium hover:bg-[#0051D0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add to Itinerary
          </button>
        </div>
      </div>
    </div>
  );
};

// Business Hours Component (Schedule)
const BusinessHours = ({ formData, setFormData }) => {
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  
  const updateHours = (day, field, value) => {
    const currentHours = formData.businessHours || {};
    setFormData(prev => ({
      ...prev,
      businessHours: {
        ...currentHours,
        [day]: {
          ...(currentHours[day] || {}),
          [field]: value
        }
      }
    }));
  };

  const toggleDay = (day) => {
    const currentHours = formData.businessHours || {};
    if (currentHours[day] && currentHours[day].open) {
      // Remove day
      const updated = { ...currentHours };
      delete updated[day];
      setFormData(prev => ({ ...prev, businessHours: updated }));
    } else {
      // Add day with default hours
      updateHours(day, "open", "09:00");
      updateHours(day, "close", "17:00");
    }
  };

  return (
    <div className="space-y-6 animate-fadeInUp">
      <h2 className="text-3xl sm:text-4xl font-light text-[#1C1C1E] mb-2">Set your schedule</h2>
      <p className="text-sm text-[#8E8E93] font-light mb-6">When is your experience available? Select the days and times.</p>
      
      <div className="space-y-4">
        {days.map((day) => {
          const dayHours = (formData.businessHours || {})[day];
          const isActive = dayHours && dayHours.open;
          
          return (
            <div key={day} className="p-4 bg-white border-2 border-gray-200 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={() => toggleDay(day)}
                    className="w-5 h-5 text-[#0071E3] rounded border-gray-300 focus:ring-[#0071E3]"
                  />
                  <span className="text-base font-medium text-[#1C1C1E] capitalize">{day}</span>
                </label>
              </div>
              
              {isActive && (
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <label className="block text-xs font-medium text-[#8E8E93] mb-1">Open</label>
                    <input
                      type="time"
                      value={dayHours.open || "09:00"}
                      onChange={(e) => updateHours(day, "open", e.target.value)}
                      className="w-full px-3 py-2 bg-[#F2F2F7] border border-gray-200 rounded-lg text-sm text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8E8E93] mb-1">Close</label>
                    <input
                      type="time"
                      value={dayHours.close || "17:00"}
                      onChange={(e) => updateHours(day, "close", e.target.value)}
                      className="w-full px-3 py-2 bg-[#F2F2F7] border border-gray-200 rounded-lg text-sm text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] transition-all"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Transportation Component
const Transportation = ({ formData, setFormData }) => {
  const transportationOptions = [
    "Not included - Guests provide own transportation",
    "Pickup service available",
    "Meeting point provided",
    "Public transportation accessible",
    "Parking available",
    "Walking distance from city center"
  ];

  return (
    <div className="space-y-6 animate-fadeInUp">
      <h2 className="text-3xl sm:text-4xl font-light text-[#1C1C1E] mb-2">Transportation</h2>
      <p className="text-sm text-[#8E8E93] font-light mb-6">How will guests get to your experience?</p>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[#1C1C1E] mb-3">Select transportation options</label>
          <div className="space-y-2">
            {transportationOptions.map((option) => (
              <label key={option} className="flex items-center gap-3 p-4 bg-white border-2 border-gray-200 rounded-xl cursor-pointer hover:border-gray-300 transition-colors">
                <input
                  type="radio"
                  name="transportation"
                  value={option}
                  checked={formData.transportation === option}
                  onChange={(e) => setFormData(prev => ({ ...prev, transportation: e.target.value }))}
                  className="w-5 h-5 text-[#0071E3] border-gray-300 focus:ring-[#0071E3]"
                />
                <span className="text-sm font-medium text-[#1C1C1E]">{option}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1C1C1E] mb-2">Additional Details</label>
          <textarea
            value={formData.transportationDetails || ""}
            onChange={(e) => setFormData(prev => ({ ...prev, transportationDetails: e.target.value }))}
            rows={4}
            className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-sm text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] transition-all resize-none"
            placeholder="Provide specific details about pickup locations, meeting points, parking information, or public transportation instructions..."
          />
        </div>
      </div>
    </div>
  );
};

// Intro Component (for services)
const Intro = ({ formData, setFormData }) => {
  return (
    <div className="space-y-6 animate-fadeInUp">
      <h2 className="text-3xl sm:text-4xl font-light text-[#1C1C1E] mb-2">Introduce yourself</h2>
      <p className="text-sm text-[#8E8E93] font-light mb-6">Tell guests about yourself and why they should book your service.</p>
      
      <div>
        <label className="block text-sm font-medium text-[#1C1C1E] mb-2">Your Introduction</label>
        <textarea
          value={formData.intro || ""}
          onChange={(e) => setFormData(prev => ({ ...prev, intro: e.target.value }))}
          rows={8}
          className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-sm text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] transition-all resize-none"
          placeholder="Share your background, expertise, passion, and what makes your service special..."
        />
      </div>
    </div>
  );
};

export default CreateListingFlow;

