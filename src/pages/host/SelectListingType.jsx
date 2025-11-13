import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const SelectListingType = () => {
  const navigate = useNavigate();
  const { currentUser, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="text-[#1C1C1E] font-light">Loading...</div>
      </div>
    );
  }

  if (!currentUser) {
    navigate("/login");
    return null;
  }

  const listingTypes = [
    {
      id: "place",
      title: "Place",
      description: "List a property, hotel, resort, or accommodation",
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      category: "resort"
    },
    {
      id: "experience",
      title: "Experience",
      description: "Offer unique activities, tours, or experiences",
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      category: "experience"
    },
    {
      id: "service",
      title: "Service",
      description: "Provide additional services like cleaning, catering, or transportation",
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      category: "service"
    }
  ];

  const handleSelectType = (type) => {
    navigate(`/host/create-listing?type=${type.id}`);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-4xl animate-fadeInUp">
        <div className="bg-white rounded-2xl p-6 sm:p-8 lg:p-12 shadow-sm border border-gray-100">
          <div className="text-center mb-8 sm:mb-12">
            <h1 className="text-3xl sm:text-4xl font-light text-[#1C1C1E] mb-3">
              What would you like to list?
            </h1>
            <p className="text-base sm:text-lg text-[#8E8E93] font-light">
              Choose the type of listing you want to create
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {listingTypes.map((type, index) => (
              <button
                key={type.id}
                onClick={() => handleSelectType(type)}
                className="group p-6 sm:p-8 bg-white border-2 border-gray-200 rounded-2xl hover:border-[#0071E3] hover:shadow-lg transition-all duration-300 text-left animate-fadeInUp"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="w-16 h-16 mb-4 rounded-xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center group-hover:bg-[#0071E3] group-hover:text-white transition-all duration-300">
                  {type.icon}
                </div>
                <h3 className="text-xl font-medium text-[#1C1C1E] mb-2 group-hover:text-[#0071E3] transition-colors duration-300">
                  {type.title}
                </h3>
                <p className="text-sm text-[#8E8E93] font-light leading-relaxed">
                  {type.description}
                </p>
              </button>
            ))}
          </div>

          <div className="mt-8 sm:mt-12 text-center">
            <button
              onClick={() => navigate("/host/listings")}
              className="text-sm text-[#8E8E93] font-light hover:text-[#1C1C1E] transition-colors duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SelectListingType;


