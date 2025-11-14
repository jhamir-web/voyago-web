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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FF9500] rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2v7m-2 2H10a2 2 0 01-2-2V9a2 2 0 012-2h2m-4 5h4m-4 0v5a2 2 0 002 2h4a2 2 0 002-2v-5m-6 0h6" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-light text-[#1C1C1E]">Manage Coupons</h2>
              <p className="text-sm text-[#8E8E93] font-light">View, create, or delete your coupons</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-[#FF9500] text-white rounded-xl font-medium hover:bg-[#E6850E] transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Coupon
            </button>
            <button
              onClick={onClose}
              className="p-2 text-[#8E8E93] hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-[#FF9500] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : coupons.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎁</div>
              <p className="text-[#8E8E93] font-light text-lg">You haven't created any coupons yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {coupons.map((coupon) => (
                <div key={coupon.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-[#1C1C1E] mb-1">{coupon.title}</h3>
                      <p className="text-sm text-[#8E8E93] font-light">{coupon.type}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteCoupon(coupon.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-light text-[#FF9500]">{coupon.discountPercentage}%</span>
                      <span className="text-sm text-[#8E8E93] font-light">off</span>
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-gray-200">
                      <p className="text-xs text-[#8E8E93] font-light mb-1">Coupon Code</p>
                      <p className="text-sm font-mono font-medium text-[#1C1C1E]">{coupon.code}</p>
                    </div>
                    {coupon.description && (
                      <p className="text-sm text-[#8E8E93] font-light">{coupon.description}</p>
                    )}
                    <div className="text-xs text-[#8E8E93] font-light">
                      Valid: {new Date(coupon.startDate).toLocaleDateString()} - {new Date(coupon.endDate).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Coupon Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#FF9500] rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2v7m-2 2H10a2 2 0 01-2-2V9a2 2 0 012-2h2m-4 5h4m-4 0v5a2 2 0 002 2h4a2 2 0 002-2v-5m-6 0h6" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-light text-[#1C1C1E]">Create New Coupon</h2>
                  <p className="text-sm text-[#8E8E93] font-light">Attract more guests with special offers</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 text-[#8E8E93] hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateCoupon} className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-[#1C1C1E] mb-2">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#FF9500]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2v7m-2 2H10a2 2 0 01-2-2V9a2 2 0 012-2h2m-4 5h4m-4 0v5a2 2 0 002 2h4a2 2 0 002-2v-5m-6 0h6" />
                      </svg>
                      Coupon Title *
                    </span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Summer Special - 10% Off on First Stay"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#FF9500] bg-white text-[#1C1C1E] font-light"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1C1C1E] mb-2">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#FF9500]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      Coupon Type
                    </span>
                  </label>
                  <input
                    type="text"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#FF9500] bg-white text-[#1C1C1E] font-light"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1C1C1E] mb-2">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#FF9500]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      Discount Percentage *
                    </span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.discountPercentage}
                    onChange={(e) => setFormData({ ...formData, discountPercentage: e.target.value })}
                    placeholder="e.g. 10 for 10%"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#FF9500] bg-white text-[#1C1C1E] font-light"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-[#1C1C1E] mb-2">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#FF9500]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Description
                    </span>
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe the coupon benefits, terms and conditions, or any special notes for guests..."
                    rows="3"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#FF9500] bg-white text-[#1C1C1E] font-light resize-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-[#1C1C1E] mb-2">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#FF9500]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2v7m-2 2H10a2 2 0 01-2-2V9a2 2 0 012-2h2m-4 5h4m-4 0v5a2 2 0 002 2h4a2 2 0 002-2v-5m-6 0h6" />
                      </svg>
                      Coupon Code *
                    </span>
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="Click Generate to create code"
                      maxLength="8"
                      className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#FF9500] bg-white text-[#1C1C1E] font-mono font-medium"
                      required
                    />
                    <button
                      type="button"
                      onClick={generateCode}
                      className="px-6 py-3 bg-[#FF9500] text-white rounded-xl font-medium hover:bg-[#E6850E] transition-all flex items-center gap-2"
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

                <div>
                  <label className="block text-sm font-medium text-[#1C1C1E] mb-2">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#FF9500]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Start Date *
                    </span>
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#FF9500] bg-white text-[#1C1C1E] font-light"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1C1C1E] mb-2">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#FF9500]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      End Date *
                    </span>
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#FF9500] bg-white text-[#1C1C1E] font-light"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-6 py-3 border-2 border-gray-200 text-[#1C1C1E] rounded-xl font-medium hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-[#FF9500] text-white rounded-xl font-medium hover:bg-[#E6850E] transition-all"
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

