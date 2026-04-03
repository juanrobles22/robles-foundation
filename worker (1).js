// ============================================================
//  Robles Foundation — Cloudflare Worker (Google Gemini)
//  Deploy at: https://workers.cloudflare.com (free)
//  Set secret: GEMINI_API_KEY in Worker Settings → Variables
//  Get free key: https://aistudio.google.com/app/apikey
// ============================================================

const ALLOWED_ORIGIN = '*'; // Lock to your GitHub Pages URL for extra security
                             // e.g. 'https://yourusername.github.io'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export default {
  async fetch(request, env) {

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const url = new URL(request.url);
    if (url.pathname !== '/generate') {
      return new Response('Not found', { status: 404 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const { prompt } = body;
    if (!prompt || typeof prompt !== 'string' || prompt.length < 20) {
      return json({ error: 'Missing or invalid prompt' }, 400);
    }

    if (prompt.length > 5000) {
      return json({ error: 'Prompt too long' }, 400);
    }

    // Call Gemini
    let geminiRes;
    try {
      geminiRes = await fetch(`${GEMINI_URL}?key=${env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 1,
            maxOutputTokens: 8192,
          },
        }),
      });
    } catch (err) {
      return json({ error: 'Failed to reach Gemini API' }, 502);
    }

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return json({ error: 'Gemini API error', detail: errText }, geminiRes.status);
    }

    const data = await geminiRes.json();

    // Extract the generated text
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) {
      return json({ error: 'No content returned from Gemini' }, 500);
    }

    return json({ result: text }, 200);
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    },
  });
}
