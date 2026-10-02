import crypto from 'node:crypto';

const KEY = 'f450e1ee1dc050d967cb';
const SECRET = '929649bd0dc98f2bc2c2';

function buildZadarmaSignature(method, params, secret) {
  const sortedKeys = Object.keys(params).sort();
  let paramsStr = '';
  for (const k of sortedKeys) {
    paramsStr += `${k}=${params[k]}&`;
  }
  if (paramsStr.endsWith('&')) paramsStr = paramsStr.slice(0, -1);

  const md5Hex = crypto.createHash('md5').update(paramsStr).digest('hex');
  const dataToSign = `${method}${paramsStr}${md5Hex}`;
  const hmacSha1Hex = crypto.createHmac('sha1', secret).update(dataToSign).digest('hex');
  return Buffer.from(hmacSha1Hex).toString('base64');
}

async function zadarmaPost(method, params = {}) {
  params.format = 'json';
  const sortedKeys = Object.keys(params).sort();
  let paramsStr = '';
  for (const k of sortedKeys) {
    paramsStr += `${k}=${params[k]}&`;
  }
  if (paramsStr.endsWith('&')) paramsStr = paramsStr.slice(0, -1);

  const authHeader = `${KEY}:${buildZadarmaSignature(method, params, SECRET)}`;
  const bodyData = new URLSearchParams(params).toString();
  const res = await fetch(`https://api.zadarma.com${method}`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: bodyData
  });
  const text = await res.text();
  console.log(`[POST ${method}]`, res.status, text);
  return text;
}

// Zadarma verify SMS
await zadarmaPost('/v1/verify/', { to: '+905407254626', channel: 'sms' });
