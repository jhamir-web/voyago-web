import React from "react";
import { createPortal } from "react-dom";

const ConfirmModal = ({ title, message, type = "danger", confirmText = "Confirm", cancelText = "Cancel", onConfirm, onCancel, children }) => {
  const getTypeStyles = () => {
    switch (type) {
      case "danger":
        return {
          icon: (
            <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ),
          confirmButton: "bg-red-500 hover:bg-red-600 text-white",
        };
      case "warning":
        return {
          icon: (
            <svg className="w-12 h-12 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ),
          confirmButton: "bg-amber-500 hover:bg-amber-600 text-white",
        };
      case "success":
        return {
          icon: (
            <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          confirmButton: "bg-green-500 hover:bg-green-600 text-white",
        };
      default:
        return {
          icon: (
            <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          confirmButton: "bg-blue-500 hover:bg-blue-600 text-white",
        };
    }
  };

  const styles = getTypeStyles();

  return createPortal(
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      {/* Blurred Background Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />

      {/* Modal Content */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-scaleIn">
        {/* Content */}
        <div className="p-6 sm:p-8">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            {styles.icon}
          </div>

          {/* Title */}
          <h3 className="text-xl sm:text-2xl font-light text-[#1C1C1E] text-center mb-3">
            {title}
          </h3>

          {/* Message */}
          <p className="text-sm sm:text-base text-[#8E8E93] font-light text-center mb-6 leading-relaxed">
            {message}
          </p>

          {/* Custom Content */}
          {children && (
            <div className="mb-6">
              {children}
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-3 bg-gray-100 text-[#1C1C1E] rounded-xl text-sm font-medium hover:bg-gray-200 transition-all duration-200"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${styles.confirmButton}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmModal;

