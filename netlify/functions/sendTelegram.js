// netlify/functions/sendTelegram.js
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    return { statusCode: 500, body: 'Missing TELEGRAM_TOKEN or TELEGRAM_CHAT_ID env vars' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  // Format message
  let text = '*New Order / Submission*\\n\\n';
  for (const k of Object.keys(payload)) {
    const v = String(payload[k] || '');
    text += `*${escapeMarkdown(k)}:* ${escapeMarkdown(v)}\\n`;
  }

  // Send to Telegram
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'Markdown' })
  });

  if (!resp.ok) {
    const err = await resp.text();
    return { statusCode: 500, body: 'Telegram error: ' + err };
  }

  return { statusCode: 200, body: 'ok' };
};

function escapeMarkdown(s) {
  return s.replace(/([_*\\[\\]`])/g, '\\\\$1');
}
