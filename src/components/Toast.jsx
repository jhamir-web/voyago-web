import React, { useEffect, useState } from "react";

const Toast = ({ message, type = "info", onClose, duration = 10000, actionButton = null }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Auto-dismiss after duration
    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    // Wait for exit animation to complete
    setTimeout(() => {
      setIsVisible(false);
      if (onClose) onClose();
    }, 300);
  };

  if (!isVisible) return null;

  const typeStyles = {
    success: {
      bg: "bg-green-50",
      border: "border-green-200",
      text: "text-green-700",
      icon: (
        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    error: {
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-700",
      icon: (
        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
    },
    info: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-700",
      icon: (
        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    warning: {
      bg: "bg-yellow-50",
      border: "border-yellow-200",
      text: "text-yellow-700",
      icon: (
        <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
  };

  const styles = typeStyles[type] || typeStyles.info;

  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-md w-full sm:w-auto animate-slideInRight ${
        isExiting ? "animate-slideOutRight" : ""
      }`}
      style={{ animationDuration: "300ms" }}
    >
      <div
        className={`${styles.bg} ${styles.border} border-2 rounded-2xl shadow-xl p-4 sm:p-5 backdrop-blur-sm`}
      >
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="flex-shrink-0 mt-0.5">{styles.icon}</div>
          <div className="flex-1 min-w-0">
            <p className={`${styles.text} text-sm sm:text-base font-medium leading-relaxed`}>
              {message}
            </p>
          </div>
          <button
            onClick={handleClose}
            className={`flex-shrink-0 ${styles.text} hover:opacity-70 transition-opacity p-1`}
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          {actionButton}
          <button
            onClick={handleClose}
            className={`${styles.text} bg-white/50 hover:bg-white/70 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${styles.border}`}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default Toast;

