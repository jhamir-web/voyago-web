import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp, query, where, getDocs, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { PAYPAL_CLIENT_ID } from "../config/paypal";

const WalletModal = ({ isOpen, onClose }) => {
  const { currentUser, userRoles } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCashInModal, setShowCashInModal] = useState(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [cashInAmount, setCashInAmount] = useState("");
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [processingPayment, setProcessingPayment] = useState(false);
  const [processingWithdrawal, setProcessingWithdrawal] = useState(false);
  const isHost = userRoles && userRoles.includes("host");

  useEffect(() => {
    if (!isOpen || !currentUser) {
      setShowCashInModal(false);
      setCashInAmount("");
      setProcessingPayment(false);
      setLoading(true);
      return;
    }

    // Set up real-time listener for user document (wallet balance and transactions)
    const userRef = doc(db, "users", currentUser.uid);
    let isMounted = true;
    
    const unsubscribe = onSnapshot(
      userRef,
      (docSnapshot) => {
        // Only update state if component is still mounted and modal is open
        if (!isMounted || !isOpen) return;
        
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          const newBalance = data.walletBalance || 0;
          // Get ALL transactions, not limited to 10, sorted by date (newest first)
          const allTransactions = (data.transactions || []).sort((a, b) => {
            const dateA = new Date(a.date || 0).getTime();
            const dateB = new Date(b.date || 0).getTime();
            return dateB - dateA; // Newest first
          });
          
          // Only update if values actually changed to prevent unnecessary re-renders
          setBalance(prev => prev !== newBalance ? newBalance : prev);
          setTransactions(prev => {
            // Compare transaction arrays to avoid unnecessary updates
            if (prev.length !== allTransactions.length) return allTransactions;
            const hasChanged = prev.some((t, i) => 
              t.date !== allTransactions[i]?.date || 
              t.amount !== allTransactions[i]?.amount ||
              t.type !== allTransactions[i]?.type
            );
            return hasChanged ? allTransactions : prev;
          });
          setPaypalEmail(prev => {
            const newEmail = data.paypalEmail || "";
            return prev !== newEmail ? newEmail : prev;
          });
          setLoading(false);
        } else {
          setBalance(0);
          setTransactions([]);
          setPaypalEmail("");
          setLoading(false);
        }
      },
      (error) => {
        if (!isMounted || !isOpen) return;
        console.error("Error fetching wallet data:", error);
        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isOpen, currentUser]);

  useEffect(() => {
    if (!isOpen || !isHost || !currentUser) {
      setWithdrawalRequests([]);
      return;
    }

    let unsubscribe;

    // Try with orderBy first, fallback if index is missing
    const setupListener = () => {
      try {
        const withdrawalRequestsQuery = query(
          collection(db, "withdrawalRequests"),
          where("hostId", "==", currentUser.uid),
          orderBy("requestedAt", "desc")
        );

        unsubscribe = onSnapshot(
          withdrawalRequestsQuery,
          (snapshot) => {
            const requests = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            setWithdrawalRequests(requests);
          },
          (error) => {
            console.error("Error fetching withdrawal requests:", error);
            // If orderBy fails, try without it
            if (error.code === 'failed-precondition' || error.code === 'unimplemented') {
              const fallbackQuery = query(
                collection(db, "withdrawalRequests"),
                where("hostId", "==", currentUser.uid)
              );
              unsubscribe = onSnapshot(
                fallbackQuery,
                (snapshot) => {
                  const requests = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .sort((a, b) => {
                      const aTime = a.requestedAt?.toDate ? a.requestedAt.toDate().getTime() : 0;
                      const bTime = b.requestedAt?.toDate ? b.requestedAt.toDate().getTime() : 0;
                      return bTime - aTime;
                    });
                  setWithdrawalRequests(requests);
                },
                (fallbackError) => {
                  console.error("Error fetching withdrawal requests (fallback):", fallbackError);
                }
              );
            }
          }
        );
      } catch (error) {
        // If query creation fails, use fallback
        console.error("Error creating query:", error);
        const fallbackQuery = query(
          collection(db, "withdrawalRequests"),
          where("hostId", "==", currentUser.uid)
        );
        unsubscribe = onSnapshot(
          fallbackQuery,
          (snapshot) => {
            const requests = snapshot.docs
              .map(doc => ({ id: doc.id, ...doc.data() }))
              .sort((a, b) => {
                const aTime = a.requestedAt?.toDate ? a.requestedAt.toDate().getTime() : 0;
                const bTime = b.requestedAt?.toDate ? b.requestedAt.toDate().getTime() : 0;
                return bTime - aTime;
              });
            setWithdrawalRequests(requests);
          },
          (fallbackError) => {
            console.error("Error fetching withdrawal requests:", fallbackError);
          }
        );
      }
    };

    setupListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [isOpen, isHost, currentUser]);


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
      
      // Store ALL transactions, not limited
      await updateDoc(userRef, {
        walletBalance: newBalance,
        transactions: [transaction, ...existingTransactions] // Keep all transactions
      });

      // State will be updated automatically by the real-time listener
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

  const handleWithdrawalRequest = async () => {
    if (!paypalEmail || !paypalEmail.includes("@")) {
      alert("Please enter your PayPal email address.");
      return;
    }

    const amount = parseFloat(withdrawalAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid withdrawal amount.");
      return;
    }

    if (amount > balance) {
      alert(`You can only withdraw up to $${balance.toFixed(2)}.`);
      return;
    }

    try {
      setProcessingWithdrawal(true);

      // Create withdrawal request - host enters their PayPal email
      const withdrawalRequest = {
        hostId: currentUser.uid,
        hostEmail: currentUser.email,
        hostName: currentUser.displayName || currentUser.email?.split("@")[0] || "Host",
        paypalEmail: paypalEmail, // Host's PayPal email
        amount: amount,
        status: "pending", // pending, approved, completed, rejected
        requestedAt: serverTimestamp(),
        processedAt: null,
        adminNotes: null
      };

      const requestRef = await addDoc(collection(db, "withdrawalRequests"), withdrawalRequest);

      // Link admin payments to this withdrawal request (oldest first, up to withdrawal amount)
      try {
        // Try with orderBy first, fallback to sorting in memory if index is missing
        let adminPaymentsSnapshot;
        try {
          const adminPaymentsQuery = query(
            collection(db, "adminPayments"),
            where("hostId", "==", currentUser.uid),
            where("withdrawalRequestId", "==", null),
            orderBy("createdAt", "asc")
          );
          adminPaymentsSnapshot = await getDocs(adminPaymentsQuery);
        } catch (orderByError) {
          // If orderBy fails (missing index), fetch without it and sort in memory
          console.warn("orderBy failed, fetching and sorting in memory:", orderByError);
          const adminPaymentsQuery = query(
            collection(db, "adminPayments"),
            where("hostId", "==", currentUser.uid),
            where("withdrawalRequestId", "==", null)
          );
          const unsortedSnapshot = await getDocs(adminPaymentsQuery);
          
          // Sort by createdAt in memory and create a new snapshot-like object
          const sortedDocs = [...unsortedSnapshot.docs].sort((a, b) => {
            const aTime = a.data().createdAt?.toDate?.() || new Date(0);
            const bTime = b.data().createdAt?.toDate?.() || new Date(0);
            return aTime - bTime;
          });
          
          // Create a snapshot-like object with sorted docs
          adminPaymentsSnapshot = {
            docs: sortedDocs,
            empty: sortedDocs.length === 0,
            size: sortedDocs.length
          };
        }
        
        let remainingAmount = amount;
        const paymentsToLink = [];
        
        for (const paymentDoc of adminPaymentsSnapshot.docs) {
          if (remainingAmount <= 0) break;
          
          const paymentData = paymentDoc.data();
          const paymentAmount = paymentData.amount || 0;
          
          paymentsToLink.push({
            id: paymentDoc.id,
            amount: paymentAmount
          });
          
          remainingAmount -= paymentAmount;
        }
        
        // Link all payments that sum up to the withdrawal amount
        for (const payment of paymentsToLink) {
          await updateDoc(doc(db, "adminPayments", payment.id), {
            withdrawalRequestId: requestRef.id,
            withdrawalRequestedAt: serverTimestamp()
          });
        }
      } catch (error) {
        console.error("Error linking admin payments to withdrawal:", error);
        // Continue even if linking fails - the withdrawal request is still valid
      }

      // Update user's PayPal email if not set
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        paypalEmail: paypalEmail
      });

      // Update wallet balance (subtract requested amount)
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const currentBalance = userData.walletBalance || 0;
        await updateDoc(userRef, {
          walletBalance: currentBalance - amount
        });
        setBalance(currentBalance - amount);
      }

      // Add transaction record
      const transaction = {
        type: "withdrawal_request",
        amount: amount,
        withdrawalRequestId: requestRef.id,
        date: new Date().toISOString(),
        status: "pending",
        description: `Withdrawal request: $${amount.toFixed(2)} to ${paypalEmail}`
      };

      const existingTransactions = userDoc.exists() ? (userDoc.data().transactions || []) : [];
      // Store ALL transactions, not limited
      await updateDoc(userRef, {
        transactions: [transaction, ...existingTransactions] // Keep all transactions
      });

      // State will be updated automatically by the real-time listener
      alert("Withdrawal request submitted successfully! Admin will process it soon.");
      setShowWithdrawalModal(false);
      setWithdrawalAmount("");
      setProcessingWithdrawal(false);
    } catch (error) {
      console.error("Error creating withdrawal request:", error);
      alert("Failed to submit withdrawal request. Please try again.");
      setProcessingWithdrawal(false);
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" key="wallet-modal-container">
        <div 
          className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col animate-slideDownFadeIn"
          onClick={(e) => e.stopPropagation()}
          key="wallet-modal-content"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
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
          <div className="px-6 py-5 sm:px-8 sm:py-6 flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Fixed Header Section */}
            <div className="flex-shrink-0">
              {/* Balance Cards */}
              <div className="grid grid-cols-1 gap-3 mb-4 sm:mb-5">
                <div className="bg-gradient-to-r from-[#34C759] to-[#30D158] rounded-xl p-4 sm:p-5 text-center shadow-lg">
                  <p className="text-xs sm:text-sm text-white/90 font-light mb-1 sm:mb-2">Available Balance</p>
                  <p className="text-2xl sm:text-3xl font-light text-white">${balance.toFixed(2)}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className={`grid ${isHost && balance > 0 ? 'grid-cols-2' : 'grid-cols-1'} gap-3 mb-4 sm:mb-5`}>
                <button
                  onClick={() => setShowCashInModal(true)}
                  className="w-full bg-[#0071E3] text-white rounded-xl p-3 sm:p-4 font-medium hover:bg-[#0051D0] hover:shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-sm sm:text-base">Cash In</span>
                </button>
                {isHost && balance > 0 && (
                  <button
                    onClick={() => setShowWithdrawalModal(true)}
                    className="w-full bg-[#FF9500] text-white rounded-xl p-3 sm:p-4 font-medium hover:bg-[#FF8500] hover:shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className="text-sm sm:text-base">Request Withdrawal</span>
                  </button>
                )}
              </div>

            </div>

            {/* Scrollable Content Section - Combined Transaction History and Withdrawal Requests */}
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <h3 className="text-base sm:text-lg font-light text-[#1C1C1E] mb-3 sm:mb-4 flex-shrink-0">Transaction History</h3>
              {(() => {
                if (loading) {
                  return (
                    <div className="text-center py-8 flex-shrink-0">
                      <p className="text-sm sm:text-base text-[#8E8E93] font-light">Loading...</p>
                    </div>
                  );
                }

                // Combine transactions and withdrawal requests into a unified list
                const allItems = [];
                
                // Add regular transactions
                transactions.forEach((transaction) => {
                  allItems.push({
                    type: 'transaction',
                    data: transaction,
                    date: transaction.date || new Date().toISOString(),
                    matchingRequest: isHost && transaction.withdrawalRequestId 
                      ? withdrawalRequests.find(r => r.id === transaction.withdrawalRequestId)
                      : null
                  });
                });
                
                // Add withdrawal requests as transaction-like items (only if not already in transactions)
                if (isHost) {
                  withdrawalRequests.forEach((request) => {
                    // Check if this withdrawal request is already represented in transactions
                    const existsInTransactions = transactions.some(t => 
                      t.withdrawalRequestId === request.id || 
                      (t.type === 'withdrawal_request' && t.amount === request.amount)
                    );
                    
                    if (!existsInTransactions) {
                      allItems.push({
                        type: 'withdrawal_request',
                        data: request,
                        date: request.requestedAt?.toDate 
                          ? request.requestedAt.toDate().toISOString()
                          : (request.requestedAt || new Date().toISOString())
                      });
                    }
                  });
                }
                
                // Sort by date (newest first)
                allItems.sort((a, b) => {
                  const dateA = new Date(a.date).getTime();
                  const dateB = new Date(b.date).getTime();
                  return dateB - dateA;
                });

                if (allItems.length === 0) {
                  return (
                    <div className="bg-gray-50 rounded-xl p-8 sm:p-10 text-center">
                      <svg className="w-12 h-12 sm:w-16 sm:h-16 text-[#8E8E93] mx-auto mb-3 sm:mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-sm sm:text-base text-[#8E8E93] font-light">No transactions yet.</p>
                    </div>
                  );
                }

                return (
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-3 sm:space-y-4 pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                    {allItems.map((item, index) => {
                        // If it's a withdrawal request not in transactions, render it specially
                        if (item.type === 'withdrawal_request') {
                          const request = item.data;
                          const statusColors = {
                            pending: "bg-yellow-100 text-yellow-700",
                            completed: "bg-green-100 text-green-700",
                            rejected: "bg-red-100 text-red-700"
                          };
                          const statusColor = statusColors[request.status] || "bg-gray-100 text-gray-700";
                          const isRejected = request.status === 'rejected';
                          
                          return (
                            <div
                              key={`withdrawal-${request.id}`}
                              className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all duration-200"
                              style={{ animation: `fadeInUp 0.3s ease-out ${0.05 * index}s both` }}
                            >
                              <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                                <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
                                  isRejected ? 'bg-[#34C759]/10' : 'bg-red-100'
                                }`}>
                                  <svg className={`w-5 h-5 sm:w-5 sm:h-5 ${
                                    isRejected ? 'text-[#34C759]' : 'text-red-500'
                                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    {isRejected ? (
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    ) : (
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                    )}
                                  </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="text-xs sm:text-sm font-medium text-[#1C1C1E] capitalize">
                                      Withdrawal Request
                                    </p>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize flex-shrink-0 ${statusColor}`}>
                                      {request.status}
                                    </span>
                                  </div>
                                  <p className="text-xs text-[#8E8E93] font-light">
                                    {request.requestedAt?.toDate 
                                      ? request.requestedAt.toDate().toLocaleDateString('en-US', { 
                                          year: 'numeric', 
                                          month: 'short', 
                                          day: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })
                                      : new Date(request.requestedAt || request.date).toLocaleDateString('en-US', { 
                                          year: 'numeric', 
                                          month: 'short', 
                                          day: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })
                                    }
                                  </p>
                                  {request.payoutAmount && request.status === 'completed' && (
                                    <p className="text-xs text-green-600 font-medium mt-1">
                                      Payout: ${request.payoutAmount.toFixed(2)}
                                      {request.totalFees > 0 && (
                                        <span className="text-[#8E8E93] ml-1">(Fees: ${request.totalFees.toFixed(2)})</span>
                                      )}
                                    </p>
                                  )}
                                  {request.adminNotes && (
                                    <div className={`mt-2 p-2 rounded-lg ${
                                      request.status === 'rejected' ? 'bg-red-50' : 'bg-blue-50'
                                    }`}>
                                      <p className="text-xs font-medium text-[#1C1C1E] mb-0.5">
                                        {request.status === 'rejected' ? '❌ Rejection Reason:' : '📝 Admin Note:'}
                                      </p>
                                      <p className="text-xs text-[#1C1C1E] font-light">
                                        {request.adminNotes}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col items-end flex-shrink-0 ml-3">
                                <p className={`text-sm sm:text-base font-semibold ${
                                  isRejected ? 'text-[#34C759]' : 'text-red-500'
                                }`}>
                                  {isRejected ? '+' : '-'}${(request.amount || 0).toFixed(2)}
                                </p>
                                <p className={`text-xs font-medium mt-0.5 ${
                                  isRejected ? 'text-[#34C759]/80' : 'text-red-500/80'
                                }`}>
                                  {isRejected ? 'Returned to Balance' : 'Deducted from Balance'}
                                </p>
                              </div>
                            </div>
                          );
                        }
                        
                        // Regular transaction
                        const transaction = item.data;
                        const matchingRequest = item.matchingRequest;

                        return (
                          <div
                            key={`transaction-${index}-${transaction.date || index}`}
                            className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all duration-200"
                            style={{ animation: `fadeInUp 0.3s ease-out ${0.05 * index}s both` }}
                          >
                          <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                            {(() => {
                              // Money is added (credit) for: cash_in, rewards, payouts, refunds, earnings, or rejected withdrawals (money returned)
                              const isCredit = transaction.type === 'cash_in' || 
                                             transaction.type === 'reward_claim' || 
                                             transaction.type === 'booking_payout' || 
                                             transaction.type === 'booking_refund' ||
                                             transaction.type === 'booking_cancellation_refund' ||
                                             transaction.type === 'booking_earnings' ||
                                             transaction.type === 'withdrawal_rejected' ||
                                             (transaction.type === 'withdrawal_request' && transaction.status === 'rejected');
                              return (
                                <>
                                  <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
                                    isCredit ? 'bg-[#34C759]/10' : 'bg-red-100'
                                  }`}>
                                    <svg className={`w-5 h-5 sm:w-5 sm:h-5 ${
                                      isCredit ? 'text-[#34C759]' : 'text-red-500'
                                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      {isCredit ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                      ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                      )}
                                    </svg>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className="text-xs sm:text-sm font-medium text-[#1C1C1E] capitalize">
                                        {transaction.type.replace(/_/g, ' ')}
                                      </p>
                                    </div>
                                    {transaction.method && (
                                      <p className="text-xs text-[#8E8E93] font-light mb-1">
                                        via {transaction.method}
                                      </p>
                                    )}
                                    <p className="text-xs text-[#8E8E93] font-light">
                                      {new Date(transaction.date).toLocaleDateString('en-US', { 
                                        year: 'numeric', 
                                        month: 'short', 
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </p>
                                    {/* Show admin notes if available */}
                                    {matchingRequest?.adminNotes && (
                                      <p className="text-xs text-[#8E8E93] font-light mt-1 italic truncate">
                                        Note: {matchingRequest.adminNotes}
                                      </p>
                                    )}
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                          {(() => {
                            // Money is added (credit) for: cash_in, rewards, payouts, refunds, earnings, or rejected withdrawals (money returned)
                            const isCredit = transaction.type === 'cash_in' || 
                                           transaction.type === 'reward_claim' || 
                                           transaction.type === 'booking_payout' || 
                                           transaction.type === 'booking_refund' ||
                                           transaction.type === 'booking_cancellation_refund' ||
                                           transaction.type === 'booking_earnings' ||
                                           transaction.type === 'withdrawal_rejected' ||
                                           (transaction.type === 'withdrawal_request' && transaction.status === 'rejected');
                            return (
                              <div className="flex flex-col items-end flex-shrink-0 ml-3">
                                <p className={`text-sm sm:text-base font-semibold ${
                                  isCredit ? 'text-[#34C759]' : 'text-red-500'
                                }`}>
                                  {isCredit ? '+' : '-'}${Math.abs(transaction.amount).toFixed(2)}
                                </p>
                                <p className={`text-xs font-medium mt-0.5 ${
                                  isCredit ? 'text-[#34C759]/80' : 'text-red-500/80'
                                }`}>
                                  {isCredit ? 'Added to Balance' : 'Deducted from Balance'}
                                </p>
                              </div>
                            );
                          })()}
                          </div>
                        );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Withdrawal Request Modal */}
          {showWithdrawalModal && (
            <>
              <div 
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
                onClick={() => !processingWithdrawal && setShowWithdrawalModal(false)}
                style={{ animation: 'fadeIn 0.3s ease-out' }}
              ></div>
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <div 
                  className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-slideDownFadeIn"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-6 py-5 sm:px-8 sm:py-6 border-b border-gray-200">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#FF9500]/10 flex items-center justify-center">
                        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-[#FF9500]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <h2 className="text-xl sm:text-2xl font-light text-[#1C1C1E]">Request Withdrawal</h2>
                    </div>
                    {!processingWithdrawal && (
                      <button
                        onClick={() => setShowWithdrawalModal(false)}
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-full hover:bg-gray-100 flex items-center justify-center transition-all duration-200"
                      >
                        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-[#1C1C1E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className="p-6 sm:p-8">
                    <div className="mb-6">
                      <p className="text-sm text-[#8E8E93] font-light mb-4">
                        Available balance: <span className="text-[#1C1C1E] font-medium">${balance.toFixed(2)}</span>
                      </p>
                      
                      <label className="block text-sm sm:text-base font-medium text-[#1C1C1E] mb-3">
                        Your PayPal Email
                      </label>
                      <input
                        type="email"
                        value={paypalEmail}
                        onChange={(e) => setPaypalEmail(e.target.value)}
                        placeholder="your-email@paypal.com"
                        disabled={processingWithdrawal}
                        className="w-full px-4 py-3 sm:py-4 text-base sm:text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF9500] focus:border-transparent transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed mb-2"
                      />
                      <p className="text-xs text-[#8E8E93] font-light mb-4">
                        Enter your PayPal email where you want to receive withdrawal payments.
                      </p>

                      <label className="block text-sm sm:text-base font-medium text-[#1C1C1E] mb-3">
                        Withdrawal Amount (USD)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={balance}
                        step="0.01"
                        value={withdrawalAmount}
                        onChange={(e) => setWithdrawalAmount(e.target.value)}
                        placeholder="0.00"
                        disabled={processingWithdrawal}
                        className="w-full px-4 py-3 sm:py-4 text-base sm:text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF9500] focus:border-transparent transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                      <p className="text-xs sm:text-sm text-[#8E8E93] font-light mt-2">
                        Maximum: ${balance.toFixed(2)}
                      </p>
                    </div>

                    <button
                      onClick={handleWithdrawalRequest}
                      disabled={processingWithdrawal || !withdrawalAmount || !paypalEmail || parseFloat(withdrawalAmount) > balance}
                      className="w-full bg-[#FF9500] text-white rounded-2xl p-4 sm:p-5 font-medium hover:bg-[#FF8500] hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    >
                      {processingWithdrawal ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <span>Submit Request</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

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
                        <p className="text-sm sm:text-base text-[#8E8E93] font-light mb-2 sm:mb-3 text-center">
                          Pay with PayPal
                        </p>
                        <p className="text-xs text-[#8E8E93] font-light mb-4 sm:mb-5 text-center">
                          Payment will be sent to Business Account 1 (admin account)
                        </p>
                        <PayPalScriptProvider
                          options={{
                            clientId: PAYPAL_CLIENT_ID, // Uses Business Account 1 (admin account) - receives all cash-in payments
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
                              // Payment goes to Business Account 1 (admin account) via PayPal Client ID
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

