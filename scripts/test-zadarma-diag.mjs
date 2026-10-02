import crypto from 'node:crypto';

const KEY = 'f450e1ee1dc050d967cb';
const SECRET = '929649bd0dc98f2bc2c2';

function sign(method, params, secret) {
  const sortedKeys = Object.keys(params).sort();
  let paramsStr = sortedKeys.map(k => `${k}=${params[k]}`).join('&');
  const md5Hex = crypto.createHash('md5').update(paramsStr).digest('hex');
  const dataToSign = `${method}${paramsStr}${md5Hex}`;
  return Buffer.from(crypto.createHmac('sha1', secret).update(dataToSign).digest('hex')).toString('base64');
}

async function api(method, params = {}) {
  params.format = 'json';
  const sortedKeys = Object.keys(params).sort();
  let paramsStr = sortedKeys.map(k => `${k}=${params[k]}`).join('&');
  const auth = `${KEY}:${sign(method, params, SECRET)}`;
  const res = await fetch(`https://api.zadarma.com${method}?${paramsStr}`, { headers: { Authorization: auth } });
  console.log(method, res.status, await res.text());
}

console.log('--- PBX Internal Details ---');
await api('/v1/pbx/internal/', { return_password: 'true' });
await api('/v1/pbx/internal/100/');
await api('/v1/pbx/internal/101/');
