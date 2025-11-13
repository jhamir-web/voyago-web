import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { PAYPAL_CLIENT_ID } from "../config/paypal";

const WalletModal = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCashInModal, setShowCashInModal] = useState(false);
  const [cashInAmount, setCashInAmount] = useState("");
  const [processingPayment, setProcessingPayment] = useState(false);

  useEffect(() => {
    if (isOpen && currentUser) {
      fetchWalletData();
    } else {
      setShowCashInModal(false);
      setCashInAmount("");
      setProcessingPayment(false);
    }
  }, [isOpen, currentUser]);

  const fetchWalletData = async () => {
    try {
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setBalance(data.walletBalance || 0);
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error("Error fetching wallet data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCashInSuccess = async (amount) => {
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      const currentBalance = userDoc.exists() ? (userDoc.data().walletBalance || 0) : 0;
      const newBalance = currentBalance + amount;
      
      const transaction = {
        type: "cash_in",
        amount: amount,
        date: new Date().toISOString(),
        status: "completed",
        method: "paypal"
      };

      const existingTransactions = userDoc.exists() ? (userDoc.data().transactions || []) : [];
      
      await updateDoc(userRef, {
        walletBalance: newBalance,
        transactions: [transaction, ...existingTransactions].slice(0, 10) // Keep last 10
      });

      setBalance(newBalance);
      setTransactions([transaction, ...transactions].slice(0, 10));
      setCashInAmount("");
      setShowCashInModal(false);
      setProcessingPayment(false);
    } catch (error) {
      console.error("Error processing cash in:", error);
      alert("Failed to process cash in. Please try again.");
      setProcessingPayment(false);
    }
  };

  const handlePayPalApprove = async (data, actions) => {
    try {
      setProcessingPayment(true);
      const order = await actions.order.capture();
      
      // Get the amount from the order (already in USD)
      const amount = parseFloat(order.purchase_units[0].amount.value);
      
      await handleCashInSuccess(amount);
    } catch (error) {
      console.error("PayPal payment error:", error);
      alert("Payment failed. Please try again.");
      setProcessingPayment(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
        style={{ animation: 'fadeIn 0.3s ease-out' }}
      ></div>

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div 
          className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-slideDownFadeIn"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0071E3]/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#0071E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="text-xl sm:text-2xl font-light text-[#1C1C1E]">My Wallet</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-all duration-200"
            >
              <svg className="w-5 h-5 text-[#1C1C1E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-6 sm:px-8 sm:py-8">
            {/* Balance Card */}
            <div className="bg-gradient-to-r from-[#34C759] to-[#30D158] rounded-2xl p-8 sm:p-10 text-center shadow-lg mb-6 sm:mb-8">
              <p className="text-base sm:text-lg text-white/90 font-light mb-3 sm:mb-4">Current Balance</p>
              <p className="text-5xl sm:text-6xl font-light text-white">${balance.toFixed(2)}</p>
            </div>

            {/* Cash In Button */}
            <button
              onClick={() => setShowCashInModal(true)}
              className="w-full bg-[#0071E3] text-white rounded-2xl p-4 sm:p-5 font-medium hover:bg-[#0051D0] hover:shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 mb-6 sm:mb-8"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-base sm:text-lg">Cash In</span>
            </button>

            {/* Recent Transactions */}
            <div>
              <h3 className="text-lg sm:text-xl font-light text-[#1C1C1E] mb-4 sm:mb-5">Recent Transactions</h3>
              {loading ? (
                <div className="text-center py-8">
                  <p className="text-sm sm:text-base text-[#8E8E93] font-light">Loading...</p>
                </div>
              ) : transactions.length > 0 ? (
                <div className="space-y-3 sm:space-y-4">
                  {transactions.map((transaction, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 sm:p-5 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all duration-200"
                      style={{ animation: `fadeInUp 0.3s ease-out ${0.05 * index}s both` }}
                    >
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                          transaction.type === 'cash_in' || transaction.type === 'reward_claim' ? 'bg-[#34C759]/10' : 'bg-red-100'
                        }`}>
                          <svg className={`w-5 h-5 sm:w-6 sm:h-6 ${
                            transaction.type === 'cash_in' || transaction.type === 'reward_claim' ? 'text-[#34C759]' : 'text-red-500'
                          }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {transaction.type === 'cash_in' || transaction.type === 'reward_claim' ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                            )}
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm sm:text-base font-medium text-[#1C1C1E] capitalize mb-1">
                            {transaction.type.replace('_', ' ')}
                            {transaction.method && (
                              <span className="text-xs text-[#8E8E93] font-light ml-2">via {transaction.method}</span>
                            )}
                          </p>
                          <p className="text-xs sm:text-sm text-[#8E8E93] font-light">
                            {new Date(transaction.date).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </p>
                        </div>
                      </div>
                      <p className={`text-base sm:text-lg font-medium ${
                        transaction.type === 'cash_in' || transaction.type === 'reward_claim' ? 'text-[#34C759]' : 'text-red-500'
                      }`}>
                        {transaction.type === 'cash_in' || transaction.type === 'reward_claim' ? '+' : '-'}${Math.abs(transaction.amount).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-8 sm:p-10 text-center">
                  <svg className="w-12 h-12 sm:w-16 sm:h-16 text-[#8E8E93] mx-auto mb-3 sm:mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm sm:text-base text-[#8E8E93] font-light">No transactions yet.</p>
                </div>
              )}
            </div>
          </div>

          {/* Cash In Modal */}
          {showCashInModal && (
            <>
              <div 
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
                onClick={() => !processingPayment && setShowCashInModal(false)}
                style={{ animation: 'fadeIn 0.3s ease-out' }}
              ></div>
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <div 
                  className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-slideDownFadeIn"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Cash In Modal Header */}
                  <div className="flex items-center justify-between px-6 py-5 sm:px-8 sm:py-6 border-b border-gray-200">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#0071E3]/10 flex items-center justify-center">
                        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-[#0071E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                      <h2 className="text-xl sm:text-2xl font-light text-[#1C1C1E]">Cash In</h2>
                    </div>
                    {!processingPayment && (
                      <button
                        onClick={() => setShowCashInModal(false)}
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-full hover:bg-gray-100 flex items-center justify-center transition-all duration-200"
                      >
                        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-[#1C1C1E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Cash In Modal Content */}
                  <div className="p-6 sm:p-8">
                    <div className="mb-6 sm:mb-8">
                      <label className="block text-sm sm:text-base font-medium text-[#1C1C1E] mb-3 sm:mb-4">
                        Enter Amount (USD)
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        value={cashInAmount}
                        onChange={(e) => setCashInAmount(e.target.value)}
                        placeholder="0.00"
                        disabled={processingPayment}
                        className="w-full px-4 py-3 sm:py-4 text-base sm:text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0071E3] focus:border-transparent transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                      <p className="text-xs sm:text-sm text-[#8E8E93] font-light mt-2">
                        Minimum amount: $1.00
                      </p>
                    </div>

                    {cashInAmount && parseFloat(cashInAmount) >= 1 && (
                      <div className="mb-6 sm:mb-8">
                        <p className="text-sm sm:text-base text-[#8E8E93] font-light mb-4 sm:mb-5 text-center">
                          Pay with PayPal
                        </p>
                        <PayPalScriptProvider
                          options={{
                            clientId: PAYPAL_CLIENT_ID,
                            currency: "USD",
                            intent: "capture",
                            components: "buttons",
                            enableFunding: "paypal",
                          }}
                        >
                          <PayPalButtons
                            style={{ layout: "vertical" }}
                            createOrder={(data, actions) => {
                              // Amount is already in USD
                              return actions.order.create({
                                purchase_units: [
                                  {
                                    description: `Wallet Cash In - $${cashInAmount}`,
                                    amount: {
                                      currency_code: "USD",
                                      value: parseFloat(cashInAmount).toFixed(2),
                                    },
                                  },
                                ],
                              });
                            }}
                            onApprove={handlePayPalApprove}
                            onError={(err) => {
                              console.error("PayPal error:", err);
                              alert("Payment failed. Please try again.");
                              setProcessingPayment(false);
                            }}
                            onCancel={() => {
                              setProcessingPayment(false);
                            }}
                          />
                        </PayPalScriptProvider>
                      </div>
                    )}

                    {processingPayment && (
                      <div className="text-center py-4">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#0071E3] mb-3"></div>
                        <p className="text-sm sm:text-base text-[#8E8E93] font-light">Processing payment...</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default WalletModal;

