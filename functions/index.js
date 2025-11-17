const functions = require("firebase-functions");
const admin = require("firebase-admin");
const payoutsSdk = require("@paypal/payouts-sdk");
const cors = require("cors")({ origin: true });

admin.initializeApp();

// PayPal Configuration - Use environment variables or config
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || functions.config().paypal?.client_id || "ASEGKmY1EZ2TiV4AJdCqlBsoKQVcKBYBPsloT6k7P1LdpKKrLcV3qQtXMrKySCWPnh7TxU10mW8HUh84";
const PAYPAL_SECRET = process.env.PAYPAL_SECRET || functions.config().paypal?.secret || "";
const PAYPAL_MODE = process.env.PAYPAL_MODE || functions.config().paypal?.mode || "sandbox"; // "sandbox" or "live"

// Initialize PayPal Environment
const environment = PAYPAL_MODE === "live"
  ? new payoutsSdk.core.LiveEnvironment(PAYPAL_CLIENT_ID, PAYPAL_SECRET)
  : new payoutsSdk.core.SandboxEnvironment(PAYPAL_CLIENT_ID, PAYPAL_SECRET);

const client = new payoutsSdk.core.PayPalHttpClient(environment);

// Cloud Function to process PayPal payout with CORS support
exports.processPayPalPayout = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  return cors(req, res, async () => {
    // Only allow POST requests
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Verify admin authentication using token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized - No token provided" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      return res.status(401).json({ error: "Unauthorized - Invalid token" });
    }

    // Check if user is admin
    const userDoc = await admin.firestore().collection("users").doc(decodedToken.uid).get();
    if (!userDoc.exists || !userDoc.data().isAdmin) {
      return res.status(403).json({ error: "Forbidden - Admin access required" });
    }

    const { withdrawalId, recipientEmail, amount, currency = "USD" } = req.body;

    if (!withdrawalId || !recipientEmail || !amount) {
      return res.status(400).json({ error: "Missing required fields: withdrawalId, recipientEmail, amount" });
    }

    try {
      // Create PayPal Payout Request
      const request = new payoutsSdk.payouts.PayoutsPostRequest();
      request.requestBody({
        sender_batch_header: {
          sender_batch_id: `batch_${withdrawalId}_${Date.now()}`,
          email_subject: "Voyago Withdrawal Payment",
          email_message: `You have received a withdrawal payment of ${amount} ${currency} from Voyago.`,
        },
        items: [
          {
            recipient_type: "EMAIL",
            amount: {
              value: amount.toString(),
              currency: currency,
            },
            receiver: recipientEmail,
            note: `Withdrawal payment for withdrawal request ${withdrawalId}`,
            sender_item_id: withdrawalId,
          },
        ],
      });

      // Execute PayPal Payout
      const response = await client.execute(request);
      const result = response.result;

      // Update Firestore with payout status
      const withdrawalRef = admin.firestore().collection("withdrawalRequests").doc(withdrawalId);
      await withdrawalRef.update({
        payoutBatchId: result.batch_header?.payout_batch_id,
        payoutStatus: result.batch_header?.batch_status,
        payoutFee: result.batch_header?.fees?.value || "0",
        payoutCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
        payoutResult: result,
      });

      // Update transaction in host's user document
      const withdrawalDoc = await withdrawalRef.get();
      if (withdrawalDoc.exists) {
        const withdrawal = withdrawalDoc.data();
        const hostRef = admin.firestore().collection("users").doc(withdrawal.hostId);
        const hostDoc = await hostRef.get();
        
        if (hostDoc.exists) {
          const transactions = hostDoc.data().transactions || [];
          const updatedTransactions = transactions.map(t => {
            if (t.withdrawalRequestId === withdrawalId && t.type === "withdrawal_request") {
              return {
                ...t,
                status: "completed",
                payoutBatchId: result.batch_header?.payout_batch_id,
                description: `Withdrawal completed: $${amount} sent to ${recipientEmail} via PayPal Payout (Batch: ${result.batch_header?.payout_batch_id})`,
              };
            }
            return t;
          });

          await hostRef.update({
            transactions: updatedTransactions,
          });
        }
      }

      return res.status(200).json({
        success: true,
        payoutBatchId: result.batch_header?.payout_batch_id,
        batchStatus: result.batch_header?.batch_status,
        message: `Payout of ${amount} ${currency} initiated successfully`,
      });
    } catch (error) {
      console.error("PayPal Payout Error:", error);
      
      // Update Firestore with error
      const withdrawalRef = admin.firestore().collection("withdrawalRequests").doc(withdrawalId);
      await withdrawalRef.update({
        payoutError: error.message,
        payoutStatus: "FAILED",
        payoutFailedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(500).json({
        error: `PayPal payout failed: ${error.message}`,
        details: error.message
      });
    }
  });
});