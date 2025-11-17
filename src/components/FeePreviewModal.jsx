import React from "react";
import { createPortal } from "react-dom";

const FeePreviewModal = ({ withdrawal, feeBreakdown, onConfirm, onCancel }) => {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
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
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-scaleIn">
        {/* Content */}
        <div className="p-6 sm:p-8">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          {/* Title */}
          <h3 className="text-xl sm:text-2xl font-light text-[#1C1C1E] text-center mb-4">
            Complete Cash-out Request
          </h3>

          {/* Host Info */}
          <div className="bg-[#F2F2F7] rounded-xl p-4 mb-4">
            <p className="text-sm text-[#8E8E93] mb-1">Host</p>
            <p className="text-base font-medium text-[#1C1C1E]">{withdrawal.hostName || withdrawal.hostEmail}</p>
            <p className="text-sm text-[#8E8E93] mt-2 mb-1">PayPal Email</p>
            <p className="text-base font-medium text-[#1C1C1E]">{withdrawal.paypalEmail}</p>
          </div>

          {/* Fee Breakdown */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <h4 className="text-sm font-medium text-[#1C1C1E] mb-3">Fee Breakdown</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-[#8E8E93]">Requested Amount</span>
                <span className="text-base font-medium text-[#1C1C1E]">{formatCurrency(feeBreakdown.requestedAmount)}</span>
              </div>
              {feeBreakdown.commissionAmount > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#8E8E93]">
                    Commission ({feeBreakdown.commissionPercentage}%)
                  </span>
                  <span className="text-base font-medium text-red-600">-{formatCurrency(feeBreakdown.commissionAmount)}</span>
                </div>
              )}
              {feeBreakdown.withdrawalFee > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#8E8E93]">Withdrawal Fee</span>
                  <span className="text-base font-medium text-red-600">-{formatCurrency(feeBreakdown.withdrawalFee)}</span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-base font-medium text-[#1C1C1E]">Payout Amount</span>
                  <span className="text-xl font-semibold text-green-600">{formatCurrency(feeBreakdown.payoutAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Warning Message */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> This will automatically process a PayPal payout of {formatCurrency(feeBreakdown.payoutAmount)} to {withdrawal.paypalEmail}. Please ensure you have sufficient funds in your PayPal Business Account.
            </p>
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
              onClick={onConfirm}
              className="flex-1 px-4 py-3 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600 transition-all duration-200"
            >
              Process Payout
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default FeePreviewModal;

