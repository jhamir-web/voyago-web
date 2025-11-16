import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../contexts/AuthContext";
import { collection, query, getDocs, addDoc, deleteDoc, doc, serverTimestamp, where } from "firebase/firestore";
import { db } from "../firebase";

const CouponManagementModal = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    type: "First-Time Guest",
    discountPercentage: "",
    description: "",
    code: "",
    startDate: "",
    endDate: ""
  });

  useEffect(() => {
    if (isOpen && currentUser) {
      fetchCoupons();
    }
  }, [isOpen, currentUser]);

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const couponsQuery = query(
        collection(db, "coupons"),
        where("hostId", "==", currentUser.uid)
      );
      const snapshot = await getDocs(couponsQuery);
      const couponsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCoupons(couponsList);
    } catch (error) {
      console.error("Error fetching coupons:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, code });
  };

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.code || !formData.discountPercentage || !formData.startDate || !formData.endDate) {
      alert("Please fill in all required fields.");
      return;
    }

    try {
      await addDoc(collection(db, "coupons"), {
        hostId: currentUser.uid,
        title: formData.title,
        type: formData.type,
        discountPercentage: parseFloat(formData.discountPercentage),
        description: formData.description || "",
        code: formData.code.toUpperCase(),
        startDate: formData.startDate,
        endDate: formData.endDate,
        createdAt: serverTimestamp(),
        active: true
      });

      setShowCreateModal(false);
      setFormData({
        title: "",
        type: "First-Time Guest",
        discountPercentage: "",
        description: "",
        code: "",
        startDate: "",
        endDate: ""
      });
      fetchCoupons();
      alert("Coupon created successfully!");
    } catch (error) {
      console.error("Error creating coupon:", error);
      alert("Failed to create coupon. Please try again.");
    }
  };

  const handleDeleteCoupon = async (couponId) => {
    if (!window.confirm("Are you sure you want to delete this coupon?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "coupons", couponId));
      fetchCoupons();
      alert("Coupon deleted successfully!");
    } catch (error) {
      console.error("Error deleting coupon:", error);
      alert("Failed to delete coupon. Please try again.");
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={onClose}></div>
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-slideDownFadeIn">
        {/* Header */}
        <div className="flex items-center justify-between p-6 sm:p-8 border-b border-gray-200 bg-gradient-to-r from-white to-gray-50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#0071E3] rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2v7m-2 2H10a2 2 0 01-2-2V9a2 2 0 012-2h2m-4 5h4m-4 0v5a2 2 0 002 2h4a2 2 0 002-2v-5m-6 0h6" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-light text-[#1C1C1E] mb-1">Manage Coupons</h2>
              <p className="text-sm text-[#8E8E93] font-light">View, create, or delete your coupons</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 bg-[#0071E3] text-white rounded-xl font-medium hover:bg-[#0051D0] transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Create Coupon</span>
              <span className="sm:hidden">Create</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-[#8E8E93] hover:bg-gray-100 rounded-lg transition-colors duration-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-10 h-10 border-4 border-[#0071E3] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : coupons.length === 0 ? (
            <div className="text-center py-16 animate-fadeInUp">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#0071E3]/10 flex items-center justify-center">
                <svg className="w-10 h-10 text-[#0071E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v13m0-13V6a2 2 0 112 2v7m-2 2H10a2 2 0 01-2-2V9a2 2 0 012-2h2m-4 5h4m-4 0v5a2 2 0 002 2h4a2 2 0 002-2v-5m-6 0h6" />
                </svg>
              </div>
              <h3 className="text-xl font-light text-[#1C1C1E] mb-2">No coupons yet</h3>
              <p className="text-[#8E8E93] font-light text-sm mb-6 max-w-sm mx-auto">
                Create your first coupon to attract more guests with special offers
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-[#0071E3] text-white rounded-xl font-medium hover:bg-[#0051D0] transition-all duration-200 shadow-md hover:shadow-lg"
              >
                Create Your First Coupon
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {coupons.map((coupon, index) => (
                <div
                  key={coupon.id}
                  className="group bg-white rounded-2xl p-5 sm:p-6 border-2 border-gray-200 hover:border-[#0071E3] hover:shadow-xl transition-all duration-300 animate-fadeInUp"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  {/* Header with Delete */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg sm:text-xl font-semibold text-[#1C1C1E] mb-1 line-clamp-1 group-hover:text-[#0071E3] transition-colors">
                        {coupon.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-[#8E8E93] font-light">{coupon.type}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteCoupon(coupon.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200 hover:scale-110 flex-shrink-0 ml-2"
                      title="Delete coupon"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {/* Discount Badge */}
                  <div className="mb-4">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#0071E3]/10 rounded-xl border border-[#0071E3]/20">
                      <span className="text-2xl sm:text-3xl font-bold text-[#0071E3]">{coupon.discountPercentage}%</span>
                      <span className="text-sm text-[#8E8E93] font-light">off</span>
                    </div>
                  </div>

                  {/* Coupon Code */}
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 mb-4 border border-gray-200 group-hover:border-[#0071E3]/30 transition-colors">
                    <p className="text-xs text-[#8E8E93] font-light mb-2 uppercase tracking-wide">Coupon Code</p>
                    <div className="flex items-center justify-between">
                      <p className="text-base sm:text-lg font-mono font-bold text-[#1C1C1E] tracking-wider">
                        {coupon.code}
                      </p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(coupon.code);
                          alert("Coupon code copied to clipboard!");
                        }}
                        className="p-1.5 text-[#0071E3] hover:bg-[#0071E3]/10 rounded-lg transition-colors"
                        title="Copy code"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  {coupon.description && (
                    <p className="text-sm text-[#8E8E93] font-light mb-4 line-clamp-2">{coupon.description}</p>
                  )}

                  {/* Validity Period */}
                  <div className="flex items-center gap-2 text-xs text-[#8E8E93] font-light pt-4 border-t border-gray-100">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>
                      Valid: {new Date(coupon.startDate).toLocaleDateString()} - {new Date(coupon.endDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Coupon Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fadeIn">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={() => setShowCreateModal(false)}></div>
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-slideDownFadeIn">
            {/* Header */}
            <div className="flex items-center justify-between p-6 sm:p-8 border-b border-gray-200 bg-gradient-to-r from-white to-gray-50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#0071E3] rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2v7m-2 2H10a2 2 0 01-2-2V9a2 2 0 012-2h2m-4 5h4m-4 0v5a2 2 0 002 2h4a2 2 0 002-2v-5m-6 0h6" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-light text-[#1C1C1E] mb-1">Create New Coupon</h2>
                  <p className="text-sm text-[#8E8E93] font-light">Attract more guests with special offers</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 text-[#8E8E93] hover:bg-gray-100 rounded-lg transition-colors duration-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateCoupon} className="flex-1 overflow-y-auto p-6 sm:p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Coupon Title */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-[#1C1C1E] mb-2">
                    Coupon Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Summer Special - 10% Off on First Stay"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] bg-white text-[#1C1C1E] font-light transition-all"
                    required
                  />
                </div>

                {/* Coupon Type */}
                <div>
                  <label className="block text-sm font-medium text-[#1C1C1E] mb-2">
                    Coupon Type
                  </label>
                  <input
                    type="text"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    placeholder="e.g., First-Time Guest"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] bg-white text-[#1C1C1E] font-light transition-all"
                  />
                </div>

                {/* Discount Percentage */}
                <div>
                  <label className="block text-sm font-medium text-[#1C1C1E] mb-2">
                    Discount Percentage <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={formData.discountPercentage}
                      onChange={(e) => setFormData({ ...formData, discountPercentage: e.target.value })}
                      placeholder="e.g. 10"
                      className="w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] bg-white text-[#1C1C1E] font-light transition-all"
                      required
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8E8E93] font-light">%</span>
                  </div>
                </div>

                {/* Description */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-[#1C1C1E] mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe the coupon benefits, terms and conditions, or any special notes for guests..."
                    rows="3"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] bg-white text-[#1C1C1E] font-light resize-none transition-all"
                  />
                </div>

                {/* Coupon Code */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-[#1C1C1E] mb-2">
                    Coupon Code <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="Click Generate to create code"
                      maxLength="8"
                      className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] bg-white text-[#1C1C1E] font-mono font-bold text-lg tracking-wider transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={generateCode}
                      className="px-6 py-3 bg-[#0071E3] text-white rounded-xl font-medium hover:bg-[#0051D0] transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg whitespace-nowrap"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Generate
                    </button>
                  </div>
                  <p className="text-xs text-[#8E8E93] font-light mt-2">
                    The coupon code will be used by guests to apply this discount. You can generate a new code or enter your own (8 characters, letters and numbers only).
                  </p>
                </div>

                {/* Start Date */}
                <div>
                  <label className="block text-sm font-medium text-[#1C1C1E] mb-2">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] bg-white text-[#1C1C1E] font-light transition-all"
                    required
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-sm font-medium text-[#1C1C1E] mb-2">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] bg-white text-[#1C1C1E] font-light transition-all"
                    required
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-6 py-3 border-2 border-gray-200 text-[#1C1C1E] rounded-xl font-medium hover:bg-gray-50 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-[#0071E3] text-white rounded-xl font-medium hover:bg-[#0051D0] transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  Create Coupon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

export default CouponManagementModal;
