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

async function zadarmaGet(method, params = {}) {
  params.format = 'json';
  const sortedKeys = Object.keys(params).sort();
  let paramsStr = '';
  for (const k of sortedKeys) {
    paramsStr += `${k}=${params[k]}&`;
  }
  if (paramsStr.endsWith('&')) paramsStr = paramsStr.slice(0, -1);

  const authHeader = `${KEY}:${buildZadarmaSignature(method, params, SECRET)}`;
  const url = `https://api.zadarma.com${method}?${paramsStr}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Authorization': authHeader }
  });
  const text = await res.text();
  console.log(`[GET ${method}]`, res.status, text);
  return text;
}

const now = new Date();
const start = new Date(now.getTime() - 24 * 3600 * 1000).toISOString().slice(0, 10) + ' 00:00:00';
const end = new Date(now.getTime() + 24 * 3600 * 1000).toISOString().slice(0, 10) + ' 23:59:59';

await zadarmaGet('/v1/statistics/', { start, end });
