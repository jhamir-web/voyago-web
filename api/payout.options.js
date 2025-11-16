// Separate handler for OPTIONS requests - Vercel will route OPTIONS to this file
// This ensures OPTIONS bypasses any auth checks

export default async function handler(req, res) {
  console.log('[CORS-OPTIONS] Handling OPTIONS preflight request');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  return res.status(200).end();
}

