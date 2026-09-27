import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.ASISTAN_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'asistan-test-'));
process.env.BEDEN_MOD = 'mock';

const { bedenBaslat, cihazSec } = await import('../beden/server.mjs');
const { ayarYukle, tokenAl, VARSAYILAN_AYAR } = await import('../ortak/ayar.mjs');

let sunucu;
let url;
let token;
let cihaz;
const sessizLog = { bilgi() {}, uyari() {}, hata() {} };

before(async () => {
  const ayar = ayarYukle();
  ayar.beden.izinler.telefon = false; // varsayılan kapalı, test ediyoruz
  token = tokenAl('beden');
  cihaz = cihazSec(ayar);
  sunucu = bedenBaslat({ ayar, token, cihaz, log: sessizLog, host: '127.0.0.1', port: 0 });
  await new Promise((r) => sunucu.once('listening', r));
  url = `http://127.0.0.1:${sunucu.address().port}`;
});

after(() => {
  sunucu.close();
  fs.rmSync(process.env.ASISTAN_HOME, { recursive: true, force: true });
});

const istek = (yol, { yontem = 'GET', govde, yetkili = true } = {}) =>
  fetch(url + yol, {
    method: yontem,
    headers: { ...(yetkili ? { Authorization: `Bearer ${token}` } : {}), ...(govde ? { 'Content-Type': 'application/json' } : {}) },
    body: govde ? JSON.stringify(govde) : undefined,
  });

test('varsayılan ayarlar güvenli: telefon/sms/kabuk kapalı', () => {
  assert.equal(VARSAYILAN_AYAR.beden.izinler.telefon, false);
  assert.equal(VARSAYILAN_AYAR.beden.izinler.sms, false);
  assert.equal(VARSAYILAN_AYAR.beden.izinler.kabuk, false);
});

test('/saglik token istemez', async () => {
  const y = await fetch(url + '/saglik');
  const v = await y.json();
  assert.equal(y.status, 200);
  assert.equal(v.durum, 'yasiyor');
  assert.equal(v.mod, 'mock');
});

test('token olmadan diğer uçlar 401', async () => {
  const y = await istek('/pil', { yetkili: false });
  assert.equal(y.status, 401);
});

test('pil durumu döner', async () => {
  const y = await istek('/pil');
  const v = await y.json();
  assert.equal(v.tamam, true);
  assert.equal(v.sonuc.percentage, 87);
});

test('kamera fotoğraf çeker ve base64 döner', async () => {
  const y = await istek('/kamera/cek', { yontem: 'POST', govde: { kamera: 1 } });
  const v = await y.json();
  assert.equal(v.tamam, true);
  assert.equal(v.sonuc.mime, 'image/png');
  assert.ok(v.sonuc.base64.length > 10);
  assert.ok(fs.existsSync(v.sonuc.dosya));
  assert.equal(cihaz.olaylar.at(-1).tip, 'fotograf');
  assert.equal(cihaz.olaylar.at(-1).veri.kamera, 1);
});

test('mikrofon kaydı dosya üretir', async () => {
  const y = await istek('/mikrofon/kaydet', { yontem: 'POST', govde: { sure: 2 } });
  const v = await y.json();
  assert.equal(v.tamam, true);
  assert.equal(v.sonuc.mime, 'audio/wav');
  assert.ok(v.sonuc.boyut > 44);
});

test('konuş TTS çağırır', async () => {
  const y = await istek('/konus', { yontem: 'POST', govde: { metin: 'merhaba dünya' } });
  assert.equal((await y.json()).tamam, true);
  assert.deepEqual(cihaz.olaylar.at(-1).veri.metin, 'merhaba dünya');
});

test('izin kapalıysa telefon araması 403', async () => {
  const y = await istek('/telefon/ara', { yontem: 'POST', govde: { numara: '+905551112233' } });
  const v = await y.json();
  assert.equal(y.status, 403);
  assert.match(v.hata, /izni kapalı/);
  assert.ok(!cihaz.olaylar.some((o) => o.tip === 'ara'));
});

test('dosya indirme sadece veri dizininden', async () => {
  const y = await istek('/dosya/..%2F..%2Fetc%2Fpasswd');
  assert.equal(y.status, 404);
});

test('geçersiz JSON 400', async () => {
  const y = await fetch(url + '/konus', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{bozuk' });
  assert.equal(y.status, 400);
});
