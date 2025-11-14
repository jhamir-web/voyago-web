import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { claimReward, POINTS_FOR_REWARD, REWARD_AMOUNT } from "../utils/points";

const RewardsCenterModal = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState("points");
  const [points, setPoints] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claimingReward, setClaimingReward] = useState(false);
  const [showRewardSuccess, setShowRewardSuccess] = useState(false);
  const [rewardAmount, setRewardAmount] = useState(0);
  const [rewardsClaimed, setRewardsClaimed] = useState(1);

  useEffect(() => {
    if (isOpen && currentUser) {
      fetchRewardsData();
    } else {
      setShowRewardSuccess(false);
    }
  }, [isOpen, currentUser]);

  const fetchRewardsData = async () => {
    try {
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setPoints(data.points || 0);
        setWalletBalance(data.walletBalance || 0);
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error("Error fetching rewards data:", error);
    } finally {
      setLoading(false);
    }
  };

  const progressToReward = POINTS_FOR_REWARD;
  const progress = points % progressToReward;
  const pointsNeeded = progressToReward - progress;
  const canClaimReward = points >= progressToReward;
  const rewardsAvailable = Math.floor(points / progressToReward);
  const canClaimAll = rewardsAvailable > 0;

  const handleClaimReward = async () => {
    if (!canClaimReward || claimingReward) return;
    
    setClaimingReward(true);
    try {
      const result = await claimReward(currentUser.uid);
      if (result.success) {
        // Refresh data
        await fetchRewardsData();
        setRewardAmount(result.rewardAmount);
        setRewardsClaimed(result.rewardsClaimed || 1);
        setShowRewardSuccess(true);
      } else {
        alert(result.error || "Failed to claim reward. Please try again.");
      }
    } catch (error) {
      console.error("Error claiming reward:", error);
      alert("Failed to claim reward. Please try again.");
    } finally {
      setClaimingReward(false);
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
          className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-slideDownFadeIn"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 sm:px-8 sm:py-6 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#0071E3]/10 flex items-center justify-center">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-[#0071E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2v7m-2 2H10a2 2 0 01-2-2V9a2 2 0 012-2h2m-4 5h4m-4 0v5a2 2 0 002 2h4a2 2 0 002-2v-5m-6 0h6" />
                </svg>
              </div>
              <h2 className="text-xl sm:text-2xl font-light text-[#1C1C1E]">Rewards Center</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full hover:bg-gray-100 flex items-center justify-center transition-all duration-200"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-[#1C1C1E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 flex-shrink-0">
            <button
              onClick={() => setActiveTab("points")}
              className={`flex-1 px-6 sm:px-8 py-4 sm:py-5 text-sm sm:text-base font-medium transition-all duration-200 relative ${
                activeTab === "points" 
                  ? "text-[#0071E3] border-b-2 border-[#0071E3]" 
                  : "text-[#8E8E93] hover:text-[#1C1C1E]"
              }`}
            >
              <div className="flex items-center justify-center gap-2 sm:gap-3">
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                <span>Points & Rewards</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab("wallet")}
              className={`flex-1 px-6 sm:px-8 py-4 sm:py-5 text-sm sm:text-base font-medium transition-all duration-200 relative ${
                activeTab === "wallet" 
                  ? "text-[#0071E3] border-b-2 border-[#0071E3]" 
                  : "text-[#8E8E93] hover:text-[#1C1C1E]"
              }`}
            >
              <div className="flex items-center justify-center gap-2 sm:gap-3">
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>Wallet</span>
              </div>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8 sm:py-8">
            {activeTab === "points" ? (
              <div className="space-y-6 sm:space-y-8">
                {/* Points Display */}
                <div className="bg-[#0071E3] rounded-2xl p-8 sm:p-10 text-center shadow-lg">
                  <p className="text-5xl sm:text-6xl font-light text-white mb-3 sm:mb-4">{points}</p>
                  <p className="text-base sm:text-lg text-white/90 font-light">Total Points Earned</p>
                </div>

                {/* Progress to Reward */}
                <div className="bg-gray-50 rounded-2xl p-6 sm:p-8">
                  <h3 className="text-lg sm:text-xl font-light text-[#1C1C1E] mb-5 sm:mb-6">Progress to Reward</h3>
                  <div className="mb-5 sm:mb-6">
                    <div className="flex justify-between text-sm sm:text-base text-[#8E8E93] font-light mb-3 sm:mb-4">
                      <span>{progress}/{progressToReward} points</span>
                      <span>Claim ${REWARD_AMOUNT} at {progressToReward} points</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 sm:h-4 overflow-hidden">
                      <div 
                        className="bg-[#0071E3] h-full rounded-full transition-all duration-500"
                        style={{ width: `${(progress / progressToReward) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  <p className="text-sm sm:text-base text-[#8E8E93] font-light mb-5 sm:mb-6">
                    110 points per booking • 50 points per review • Claim ${REWARD_AMOUNT} at {progressToReward} points
                  </p>
                  
                  {/* Claim All Button - Show if user can claim multiple rewards */}
                  {canClaimAll && rewardsAvailable > 1 && (
                    <button
                      onClick={handleClaimReward}
                      disabled={claimingReward}
                      className={`w-full px-5 py-3 sm:py-3.5 rounded-xl text-sm sm:text-base font-medium transition-all duration-200 mb-3 ${
                        "bg-[#34C759] text-white hover:bg-[#30D158] hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                      } ${claimingReward ? "opacity-50 cursor-wait" : ""}`}
                    >
                      {claimingReward ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Claiming All...
                        </span>
                      ) : (
                        `🎁 Claim All ${rewardsAvailable} Rewards ($${(rewardsAvailable * REWARD_AMOUNT).toFixed(0)})`
                      )}
                    </button>
                  )}
                  
                  {/* Single Claim Button */}
                  <button
                    onClick={handleClaimReward}
                    disabled={!canClaimReward || claimingReward}
                    className={`w-full px-5 py-3 sm:py-3.5 rounded-xl text-sm sm:text-base font-medium transition-all duration-200 ${
                      canClaimReward
                        ? "bg-[#0071E3] text-white hover:bg-[#0051D0] hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                        : "bg-gray-300 text-gray-600 cursor-not-allowed"
                    } ${claimingReward ? "opacity-50 cursor-wait" : ""}`}
                  >
                    {claimingReward ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Claiming...
                      </span>
                    ) : canClaimReward ? (
                      `🎉 Claim $${REWARD_AMOUNT} Reward`
                    ) : (
                      `Need ${pointsNeeded} More Points`
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6 sm:space-y-8">
                {/* Wallet Balance */}
                <div className="bg-gradient-to-r from-[#34C759] to-[#30D158] rounded-2xl p-8 sm:p-10 text-center shadow-lg">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4 sm:mb-5">
                    <svg className="w-7 h-7 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <p className="text-base sm:text-lg text-white/90 font-light mb-2 sm:mb-3">Current Balance</p>
                  <p className="text-4xl sm:text-5xl font-light text-white">${walletBalance.toFixed(2)}</p>
                </div>

                {/* Recent Transactions */}
                <div>
                  <h3 className="text-lg sm:text-xl font-light text-[#1C1C1E] mb-4 sm:mb-5">Recent Transactions</h3>
                  {loading ? (
                    <p className="text-sm sm:text-base text-[#8E8E93] font-light text-center py-8">Loading...</p>
                  ) : transactions.length > 0 ? (
                    <div className="space-y-3 sm:space-y-4">
                      {transactions.slice(0, 5).map((transaction, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-4 sm:p-5 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all duration-200"
                          style={{ animation: `fadeInUp 0.3s ease-out ${0.05 * index}s both` }}
                        >
                          <div className="flex items-center gap-3 sm:gap-4">
                            {(() => {
                              const isCredit = transaction.type === 'cash_in' || 
                                             transaction.type === 'reward_claim' || 
                                             transaction.type === 'booking_payout' || 
                                             transaction.type === 'booking_refund';
                              return (
                                <>
                                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                                    isCredit ? 'bg-[#34C759]/10' : 'bg-red-100'
                                  }`}>
                                    <svg className={`w-5 h-5 sm:w-6 sm:h-6 ${
                                      isCredit ? 'text-[#34C759]' : 'text-red-500'
                                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      {isCredit ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                      ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                      )}
                                    </svg>
                                  </div>
                                  <div>
                                    <p className="text-sm sm:text-base font-medium text-[#1C1C1E] capitalize mb-1">
                                      {transaction.type.replace('_', ' ')}
                                    </p>
                                    <p className="text-xs sm:text-sm text-[#8E8E93] font-light">
                                      {new Date(transaction.date).toLocaleDateString('en-US', { 
                                        year: 'numeric', 
                                        month: 'short', 
                                        day: 'numeric' 
                                      })}
                                    </p>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                          {(() => {
                            const isCredit = transaction.type === 'cash_in' || 
                                           transaction.type === 'reward_claim' || 
                                           transaction.type === 'booking_payout' || 
                                           transaction.type === 'booking_refund';
                            return (
                              <p className={`text-base sm:text-lg font-medium ${
                                isCredit ? 'text-[#34C759]' : 'text-red-500'
                              }`}>
                                {isCredit ? '+' : '-'}${Math.abs(transaction.amount).toFixed(2)}
                              </p>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-8 sm:p-10 text-center">
                      <svg className="w-12 h-12 sm:w-16 sm:h-16 text-[#8E8E93] mx-auto mb-3 sm:mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-sm sm:text-base text-[#8E8E93] font-light">No transactions yet</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reward Success Popup */}
      {showRewardSuccess && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
            onClick={() => setShowRewardSuccess(false)}
            style={{ animation: 'fadeIn 0.3s ease-out' }}
          ></div>
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div 
              className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-slideDownFadeIn"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8 sm:p-10 text-center">
                {/* Success Icon */}
                <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6 rounded-full bg-[#34C759]/10 flex items-center justify-center animate-scaleIn">
                  <svg className="w-12 h-12 sm:w-16 sm:h-16 text-[#34C759]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>

                {/* Success Message */}
                <h3 className="text-2xl sm:text-3xl font-light text-[#1C1C1E] mb-3">
                  {rewardsClaimed > 1 ? `${rewardsClaimed} Rewards Claimed!` : "Reward Claimed!"}
                </h3>
                <p className="text-base sm:text-lg text-[#8E8E93] font-light mb-6">
                  ${rewardAmount.toFixed(2)} has been added to your wallet
                </p>

                {/* Reward Details */}
                <div className="bg-gray-50 rounded-2xl p-5 sm:p-6 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-[#8E8E93] font-light">Amount Added</span>
                    <span className="text-2xl sm:text-3xl font-light text-[#34C759]">
                      +${rewardAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="pt-3 border-t border-gray-200">
                    <p className="text-xs text-[#8E8E93] font-light">
                      Your wallet balance has been updated
                    </p>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  onClick={() => setShowRewardSuccess(false)}
                  className="w-full bg-[#0071E3] text-white rounded-xl px-6 py-4 text-base sm:text-lg font-medium hover:bg-[#0051D0] hover:shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Great!
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default RewardsCenterModal;

