import React, { useState } from "react";
import { createPortal } from "react-dom";

const NotesModal = ({ title, placeholder = "Enter notes...", maxLength = 500, onConfirm, onCancel, initialValue = "" }) => {
  const [notes, setNotes] = useState(initialValue);
  const [error, setError] = useState("");

  const handleConfirm = () => {
    if (notes.length > maxLength) {
      setError(`Notes cannot exceed ${maxLength} characters`);
      return;
    }
    onConfirm(notes);
  };

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
          {/* Title */}
          <h3 className="text-xl sm:text-2xl font-light text-[#1C1C1E] mb-4">
            {title}
          </h3>

          {/* Textarea */}
          <div className="mb-4">
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setError("");
              }}
              placeholder={placeholder}
              maxLength={maxLength}
              rows={6}
              className="w-full px-4 py-3 bg-[#F2F2F7] rounded-xl text-sm text-[#1C1C1E] placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:bg-white transition-all resize-none"
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-red-500">{error}</span>
              <span className="text-xs text-[#8E8E93]">
                {notes.length}/{maxLength}
              </span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-3 bg-gray-100 text-[#1C1C1E] rounded-xl text-sm font-medium hover:bg-gray-200 transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-4 py-3 bg-[#0071E3] text-white rounded-xl text-sm font-medium hover:bg-[#0051D0] transition-all duration-200"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default NotesModal;

