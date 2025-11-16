// Vercel Serverless Function for PayPal Payouts
// This file automatically deploys to Vercel when you push to GitHub

export default async function handler(req, res) {
  // Handle CORS preflight requests (OPTIONS)
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Enable CORS for actual requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization');

  // Simple API key check (optional - you can remove if you want)
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  const expectedKey = process.env.PAYOUT_API_KEY || 'voyago-secret-api-key-2024';
  
  if (!apiKey || apiKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized - Invalid API key' });
  }

  try {
    // Import PayPal SDK dynamically (Vercel supports this)
    const payoutsSdk = await import('@paypal/payouts-sdk');
    
    // PayPal Configuration from environment variables
    const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || 'ASEGKmY1EZ2TiV4AJdCqlBsoKQVcKBYBPsloT6k7P1LdpKKrLcV3qQtXMrKySCWPnh7TxU10mW8HUh84';
    const PAYPAL_SECRET = process.env.PAYPAL_SECRET || '';
    const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox';

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

    // Create PayPal Payout Request
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
    console.log('Executing PayPal payout request...');
    console.log('PayPal Client ID:', PAYPAL_CLIENT_ID ? 'Set' : 'Missing');
    console.log('PayPal Secret:', PAYPAL_SECRET ? 'Set' : 'Missing');
    console.log('PayPal Mode:', PAYPAL_MODE);
    console.log('Recipient Email:', recipientEmail);
    console.log('Amount:', amount);
    
    let response;
    try {
      response = await client.execute(request);
      console.log('PayPal response status:', response.statusCode);
      console.log('PayPal response:', JSON.stringify(response.result, null, 2));
    } catch (paypalError) {
      console.error('PayPal API Error:', paypalError);
      console.error('PayPal Error Details:', JSON.stringify(paypalError, null, 2));
      throw paypalError;
    }

    const result = response.result;

    // Check if payout was successful
    if (!result || !result.batch_header) {
      console.error('Invalid PayPal response:', result);
      return res.status(500).json({
        error: 'PayPal payout failed: Invalid response from PayPal',
        details: 'No batch header in response',
        response: result
      });
    }

    const batchId = result.batch_header?.payout_batch_id;
    const batchStatus = result.batch_header?.batch_status;

    console.log('PayPal Payout Success!');
    console.log('Batch ID:', batchId);
    console.log('Batch Status:', batchStatus);

    return res.status(200).json({
      success: true,
      payoutBatchId: batchId,
      batchStatus: batchStatus,
      message: `Payout of ${amount} ${currency} initiated successfully`,
      result: result
    });
  } catch (error) {
    console.error('PayPal Payout Error:', error);
    
    return res.status(500).json({
      error: `PayPal payout failed: ${error.message}`,
      details: error.message,
    });
  }
}
