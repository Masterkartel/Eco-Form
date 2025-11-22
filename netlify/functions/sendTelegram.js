// netlify/functions/sendTelegram.js

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    return { statusCode: 500, body: 'Missing TELEGRAM_TOKEN or TELEGRAM_CHAT_ID' };
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  // Build message
  let text = '*New Order / Submission*\\n\\n';
  for (const key of Object.keys(payload)) {
    text += `*${escapeMarkdown(key)}:* ${escapeMarkdown(String(payload[key] || ''))}\\n`;
  }

  // Use global fetch (no node-fetch needed)
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  const telegramResponse = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: "Markdown"
    })
  });

  if (!telegramResponse.ok) {
    const errorText = await telegramResponse.text();
    return { statusCode: 500, body: 'Telegram error: ' + errorText };
  }

  return { statusCode: 200, body: 'ok' };
};

function escapeMarkdown(str) {
  return str.replace(/([_*\\[\\]`])/g, "\\$1");
}
