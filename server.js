// Express server for Render deployment
// PayPal Payout API endpoint

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
// For production, you can restrict to specific domains:
// origin: ['https://your-firebase-domain.web.app', 'https://your-firebase-domain.firebaseapp.com', 'http://localhost:5173']
app.use(cors({
  origin: '*', // Allows all origins - change this to specific domains for production
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization'],
  credentials: false
}));

// Parse JSON bodies
app.use(express.json());

// Handle preflight OPTIONS requests explicitly
app.options('/api/payout', (req, res) => {
  console.log('[CORS] OPTIONS preflight request received');
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization');
  res.header('Access-Control-Max-Age', '86400');
  res.status(200).end();
});

// PayPal Payout endpoint
app.post('/api/payout', async (req, res) => {
  try {
    // Set CORS headers for all responses
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
    res.header('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization');

    // API key check
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    const expectedKey = process.env.PAYOUT_API_KEY || 'voyago-secret-api-key-2024';
    
    if (!apiKey || apiKey !== expectedKey) {
      console.error('[AUTH FAIL] API Key check failed');
      return res.status(401).json({ error: 'Unauthorized - Invalid API key' });
    }
    
    console.log('[AUTH SUCCESS] API Key validated');

    // Import PayPal SDK dynamically
    const payoutsSdkModule = await import('@paypal/payouts-sdk');
    // Handle both default export and named exports
    const payoutsSdk = payoutsSdkModule.default || payoutsSdkModule;
    
    console.log('[PAYPAL] SDK loaded, checking structure...');
    console.log('[PAYPAL] payoutsSdk keys:', Object.keys(payoutsSdk));
    
    // PayPal Configuration from environment variables
    const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || 'ASEGKmY1EZ2TiV4AJdCqlBsoKQVcKBYBPsloT6k7P1LdpKKrLcV3qQtXMrKySCWPnh7TxU10mW8HUh84';
    const PAYPAL_SECRET = process.env.PAYPAL_SECRET || '';
    const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox';

    // Validate PayPal credentials
    if (!PAYPAL_SECRET) {
      console.error('[PAYPAL ERROR] Secret is missing!');
      return res.status(500).json({
        error: 'PayPal Secret is not configured. Please add PAYPAL_SECRET to Render environment variables.',
        details: 'The PayPal Payout API requires both Client ID and Secret to work.'
      });
    }

    // Initialize PayPal Environment
    const environment = PAYPAL_MODE === 'live'
      ? new payoutsSdk.core.LiveEnvironment(PAYPAL_CLIENT_ID, PAYPAL_SECRET)
      : new payoutsSdk.core.SandboxEnvironment(PAYPAL_CLIENT_ID, PAYPAL_SECRET);

    const client = new payoutsSdk.core.PayPalHttpClient(environment);

    const { withdrawalId, recipientEmail, amount, currency = 'USD' } = req.body;

    // Validate input
    if (!withdrawalId || !recipientEmail || !amount) {
      return res.status(400).json({ 
        error: 'Missing required fields: withdrawalId, recipientEmail, amount' 
      });
    }

    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Create PayPal Payout Request - check if payouts exists
    if (!payoutsSdk.payouts || !payoutsSdk.payouts.PayoutsPostRequest) {
      console.error('[PAYPAL ERROR] PayoutsPostRequest not found in SDK');
      console.error('[PAYPAL ERROR] Available keys:', Object.keys(payoutsSdk));
      return res.status(500).json({
        error: 'PayPal SDK structure issue: PayoutsPostRequest not found',
        details: 'The PayPal SDK may not be installed correctly or version mismatch'
      });
    }

    const request = new payoutsSdk.payouts.PayoutsPostRequest();
    request.requestBody({
      sender_batch_header: {
        sender_batch_id: `batch_${withdrawalId}_${Date.now()}`,
        email_subject: 'Voyago Withdrawal Payment',
        email_message: `You have received a withdrawal payment of ${amount} ${currency} from Voyago.`,
      },
      items: [
        {
          recipient_type: 'EMAIL',
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
    console.log('[PAYPAL] Executing payout request...');
    console.log('[PAYPAL] Recipient:', recipientEmail);
    console.log('[PAYPAL] Amount:', amount);
    
    let response;
    try {
      response = await client.execute(request);
      console.log('[PAYPAL SUCCESS] Response status:', response.statusCode);
      console.log('[PAYPAL SUCCESS] Batch ID:', response.result?.batch_header?.payout_batch_id);
    } catch (paypalError) {
      console.error('[PAYPAL ERROR] API call failed:', paypalError.message);
      throw paypalError;
    }

    const result = response.result;

    // Check if payout was successful
    if (!result || !result.batch_header) {
      console.error('[PAYPAL ERROR] Invalid response from PayPal');
      return res.status(500).json({
        error: 'PayPal payout failed: Invalid response from PayPal',
        details: 'No batch header in response',
        response: result
      });
    }

    const batchId = result.batch_header?.payout_batch_id;
    const batchStatus = result.batch_header?.batch_status;

    console.log('[PAYPAL SUCCESS] Payout initiated successfully');
    console.log('[PAYPAL SUCCESS] Batch ID:', batchId);
    console.log('[PAYPAL SUCCESS] Batch Status:', batchStatus);

    return res.status(200).json({
      success: true,
      payoutBatchId: batchId,
      batchStatus: batchStatus,
      message: `Payout of ${amount} ${currency} initiated successfully`,
      result: result
    });
  } catch (error) {
    console.error('[ERROR] PayPal Payout Error:', error.message);
    
    return res.status(500).json({
      error: `PayPal payout failed: ${error.message}`,
      details: error.message,
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'voyago-paypal-payout' });
});

// Start server
app.listen(PORT, () => {
  console.log(`[SERVER] Voyago PayPal Payout API listening on port ${PORT}`);
  console.log(`[SERVER] Environment: ${process.env.PAYPAL_MODE || 'sandbox'}`);
});

