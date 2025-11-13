// Points utility functions
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

// Point values for different actions
export const POINTS_PER_BOOKING = 110;
export const POINTS_PER_REVIEW = 50;
export const POINTS_FOR_REWARD = 300;
export const REWARD_AMOUNT = 50; // $50

/**
 * Award points to a user for a specific action
 * @param {string} userId - User ID
 * @param {number} points - Points to award
 * @param {string} action - Action type (e.g., 'booking', 'review')
 * @param {string} actionId - ID of the action (bookingId, reviewId, etc.)
 */
export const awardPoints = async (userId, points, action, actionId = null) => {
  try {
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.error("User document does not exist");
      return { success: false, error: "User not found" };
    }

    const currentPoints = userDoc.data().points || 0;
    const pointsHistory = userDoc.data().pointsHistory || [];
    
    // Add to points history
    const historyEntry = {
      points: points,
      action: action,
      actionId: actionId,
      date: new Date().toISOString(),
      type: "earned"
    };
    await updateDoc(userRef, {
      points: currentPoints + points,
      pointsHistory: [historyEntry, ...pointsHistory].slice(0, 50) // Keep last 50 entries
    });

    return { success: true, newPoints: currentPoints + points };
  } catch (error) {
    console.error("Error awarding points:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Claim reward when user reaches the threshold
 * @param {string} userId - User ID
 */
export const claimReward = async (userId) => {
  try {
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return { success: false, error: "User not found" };
    }

    const currentPoints = userDoc.data().points || 0;
    const walletBalance = userDoc.data().walletBalance || 0;
    const transactions = userDoc.data().transactions || [];
    const pointsHistory = userDoc.data().pointsHistory || [];

    if (currentPoints < POINTS_FOR_REWARD) {
      return { 
        success: false, 
        error: `You need ${POINTS_FOR_REWARD - currentPoints} more points to claim this reward.` 
      };
    }

    // Calculate how many rewards can be claimed
    const rewardsToClaim = Math.floor(currentPoints / POINTS_FOR_REWARD);
    const pointsToDeduct = rewardsToClaim * POINTS_FOR_REWARD;
    const rewardAmount = rewardsToClaim * REWARD_AMOUNT;
    const remainingPoints = currentPoints - pointsToDeduct;

    // Add transaction for reward claim
    const transaction = {
      type: "reward_claim",
      amount: rewardAmount,
      pointsUsed: pointsToDeduct,
      date: new Date().toISOString(),
      status: "completed"
    };

    // Add to points history
    const historyEntry = {
      points: -pointsToDeduct,
      action: "reward_claim",
      rewardAmount: rewardAmount,
      date: new Date().toISOString(),
      type: "redeemed"
    };

    await updateDoc(userRef, {
      points: remainingPoints,
      walletBalance: walletBalance + rewardAmount,
      transactions: [transaction, ...transactions].slice(0, 10),
      pointsHistory: [historyEntry, ...pointsHistory].slice(0, 50)
    });

    return { 
      success: true, 
      rewardsClaimed: rewardsToClaim,
      rewardAmount: rewardAmount,
      remainingPoints: remainingPoints
    };
  } catch (error) {
    console.error("Error claiming reward:", error);
    return { success: false, error: error.message };
  }
};

