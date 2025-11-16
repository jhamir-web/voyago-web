import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import payoutsSdk from "@paypal/payouts-sdk";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// PayPal Configuration from environment variables
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || "ASEGKmY1EZ2TiV4AJdCqlBsoKQVcKBYBPsloT6k7P1LdpKKrLcV3qQtXMrKySCWPnh7TxU10mW8HUh84";
const PAYPAL_SECRET = process.env.PAYPAL_SECRET || "";
const PAYPAL_MODE = process.env.PAYPAL_MODE || "sandbox"; // "sandbox" or "live"

// Initialize PayPal Environment
const environment = PAYPAL_MODE === "live"
  ? new payoutsSdk.core.LiveEnvironment(PAYPAL_CLIENT_ID, PAYPAL_SECRET)
  : new payoutsSdk.core.SandboxEnvironment(PAYPAL_CLIENT_ID, PAYPAL_SECRET);

const client = new payoutsSdk.core.PayPalHttpClient(environment);

// Simple API key for authentication (you should use a more secure method in production)
const API_KEY = process.env.API_KEY || "your-secret-api-key-change-this";

// Helper function to verify API key
function verifyApiKey(req, res, next) {
  const apiKey = req.headers["x-api-key"] || req.headers["authorization"]?.replace("Bearer ", "");
  
  if (!apiKey || apiKey !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized - Invalid API key" });
  }
  
  next();
}

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "Voyago PayPal Payout Server",
    mode: PAYPAL_MODE
  });
});

// PayPal Payout endpoint
app.post("/api/payout", verifyApiKey, async (req, res) => {
  try {
    const { withdrawalId, recipientEmail, amount, currency = "USD" } = req.body;

    // Validate input
    if (!withdrawalId || !recipientEmail || !amount) {
      return res.status(400).json({ 
        error: "Missing required fields: withdrawalId, recipientEmail, amount" 
      });
    }

    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

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
            value: amountNum.toFixed(2),
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

    return res.status(200).json({
      success: true,
      payoutBatchId: result.batch_header?.payout_batch_id,
      batchStatus: result.batch_header?.batch_status,
      message: `Payout of ${amount} ${currency} initiated successfully`,
      result: result,
    });
  } catch (error) {
    console.error("PayPal Payout Error:", error);
    
    return res.status(500).json({
      error: `PayPal payout failed: ${error.message}`,
      details: error.message,
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Voyago PayPal Payout Server running on port ${PORT}`);
  console.log(`📍 Mode: ${PAYPAL_MODE}`);
  console.log(`🔑 API Key: ${API_KEY.substring(0, 10)}...`);
  console.log(`✅ Ready to process payouts!`);
});
