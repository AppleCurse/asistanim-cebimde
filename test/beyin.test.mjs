import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';

process.env.ASISTAN_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'asistan-test-'));
process.env.BEDEN_MOD = 'mock';
process.env.KULLANICI_ADI = 'Test Kullanıcı';

const { sahte9RouterBaslat } = await import('./yardimci/sahte-9router.mjs');
const { bedenBaslat, cihazSec } = await import('../beden/server.mjs');
const { beyinBaslat } = await import('../beyin/index.mjs');
const { ayarYukle, tokenAl } = await import('../ortak/ayar.mjs');
const { jsonAyikla } = await import('../beyin/llm.mjs');

const sessizLog = { bilgi() {}, uyari() {}, hata() {} };
let sahte;
let beden;
let beyin;
let beyinUrl;
let token;
let cihaz;

before(async () => {
  sahte = await sahte9RouterBaslat();
  const ayar = ayarYukle();
  ayar.beden.izinler.telefon = true;
  cihaz = cihazSec(ayar);
  beden = bedenBaslat({ ayar, token: tokenAl('beden'), cihaz, log: sessizLog, host: '127.0.0.1', port: 0 });
  await new Promise((r) => beden.once('listening', r));
  ayar.beyin.bedenUrl = `http://127.0.0.1:${beden.address().port}`;
  ayar.beyin.llm.baseUrl = sahte.url;
  ayar.beyin.llm.apiKey = 'sahte';
  beyin = beyinBaslat({ ayar, log: sessizLog, host: '127.0.0.1', port: 0 });
  await new Promise((r) => beyin.sunucu.once('listening', r));
  beyinUrl = `http://127.0.0.1:${beyin.sunucu.address().port}`;
  token = beyin.token;
});

after(() => {
  beyin.sunucu.close();
  beden.close();
  sahte.sunucu.close();
  fs.rmSync(process.env.ASISTAN_HOME, { recursive: true, force: true });
});

const api = async (yol, govde, ekBaslik = {}) => {
  const y = await fetch(beyinUrl + '/api' + yol, {
    method: govde ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(govde ? { 'Content-Type': 'application/json' } : {}), ...ekBaslik },
    body: govde ? JSON.stringify(govde) : undefined,
  });
  return { durum: y.status, veri: await y.json() };
};

test('jsonAyikla çitli ve açıklamalı JSON’u çözer', () => {
  assert.deepEqual(jsonAyikla('İşte:\n```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(jsonAyikla('{"b":[1,2]}'), { b: [1, 2] });
  assert.throws(() => jsonAyikla('json yok'));
});

test('token olmadan panel API 401, sayfa giriş ekranına düşer', async () => {
  const y = await fetch(beyinUrl + '/api/durum');
  assert.equal(y.status, 401);
  const s = await fetch(beyinUrl + '/');
  assert.equal(s.status, 200);
  assert.match(await s.text(), /Giriş/);
});

test('?token= ile giriş çerez bırakır', async () => {
  const y = await fetch(`${beyinUrl}/?token=${token}`, { redirect: 'manual' });
  assert.equal(y.status, 200);
  assert.match(y.headers.get('set-cookie') || '', /asistan_token=/);
});

test('/api/durum bedeni ve modeli raporlar', async () => {
  const { durum, veri } = await api('/durum');
  assert.equal(durum, 200);
  assert.equal(veri.beden.durum, 'yasiyor');
  assert.equal(veri.beden.mod, 'mock');
  assert.equal(veri.kullanici, 'Test Kullanıcı');
});

test('model otomatik seçilir (tercihen sonnet)', async () => {
  const { veri } = await api('/modeller');
  assert.deepEqual(veri.modeller, ['sahte/model-1', 'sahte/sonnet']);
  assert.equal(beyin.llm.model, 'sahte/sonnet');
});

test('sohbet: araç çağrısı → beden → yanıt', async () => {
  const { durum, veri } = await api('/sohbet', { oturum: 't1', metin: 'pil kaç?' });
  assert.equal(durum, 200);
  assert.equal(veri.adimlar.length, 1);
  assert.equal(veri.adimlar[0].arac, 'pil_durumu');
  assert.match(veri.adimlar[0].sonuc, /"percentage":87/);
  assert.match(veri.metin, /Araç sonucu/);
  // sistem mesajı kullanıcı adını ve hafızayı içeriyor mu
  const sonIstek = sahte.istekler.at(-1);
  assert.match(sonIstek.messages[0].content, /Test Kullanıcı/);
  assert.match(sonIstek.messages[0].content, /KALICI HAFIZA/);
});

test('sohbet: bak aracı görüntüyü sonraki mesaja ekler', async () => {
  const { veri } = await api('/sohbet', { oturum: 't2', metin: 'etrafa bak' });
  assert.equal(veri.adimlar[0].arac, 'bak');
  const sonIstek = sahte.istekler.at(-1);
  const resimli = sonIstek.messages.find((m) => Array.isArray(m.content) && m.content.some((p) => p.type === 'image_url'));
  assert.ok(resimli, 'image_url içeren mesaj bekleniyordu');
  assert.match(resimli.content[1].image_url.url, /^data:image\/png;base64,/);
  // tool mesajı assistant tool_calls'tan hemen sonra gelmeli
  const idx = sonIstek.messages.findIndex((m) => m.tool_calls);
  assert.equal(sonIstek.messages[idx + 1].role, 'tool');
});

test('görev: talimattan brifing üretilir ve kaydedilir', async () => {
  const { durum, veri: g } = await api('/gorevler', { talimat: "Ahmet'i ara, yarınki toplantıyı 16:00'a ertele" });
  assert.equal(durum, 200);
  assert.equal(g.durum, 'hazir');
  assert.equal(g.kisi.numara, '+905551112233');
  assert.equal(g.konusma_noktalari.length, 3);
  const { veri: liste } = await api('/gorevler');
  assert.ok(liste.gorevler.some((x) => x.id === g.id));
  const sistem = beyin.gorevler.aramaSistemMesaji(g);
  assert.match(sistem, /TELEFONDA konuşuyorsun/);
  assert.match(sistem, /dijital asistan olduğunu açıkça söyle/);
  assert.match(sistem, /\[GORUSME_BITTI\]/);
});

test('görev: hücresel arama bedeni çevirir ve brifing döner', async () => {
  const { veri: g } = await api('/gorevler', { talimat: 'Ahmet’i ara', numara: '+905559998877' });
  assert.equal(g.kisi.numara, '+905559998877', 'verilen numara brifingdekini ezmeli');
  const { durum, veri } = await api(`/gorevler/${g.id}/hucresel-ara`, {});
  assert.equal(durum, 200);
  assert.equal(veri.arandi, '+905559998877');
  assert.ok(veri.brifing.acilis);
  assert.equal(cihaz.olaylar.filter((o) => o.tip === 'ara').length, 1);
  assert.equal(beyin.gorevler.al(g.id).durum, 'araniyor');
  const { veri: kapali } = await api(`/gorevler/${g.id}/sonuc`, { basarili: true, ozet: 'Elle girildi' });
  assert.equal(kapali.durum, 'tamamlandi');
  assert.match(beyin.hafiza.oku(), /Elle girildi/);
});

test('telefon köprüsü: WebSocket üzerinden tam görüşme ve özet', async () => {
  const { veri: g } = await api('/gorevler', { talimat: 'Ahmet’i ara, toplantıyı ertele' });
  const wsUrl = beyinUrl.replace('http', 'ws') + `/ws/telefon?token=${token}`;
  const ws = new WebSocket(wsUrl);
  const gelen = [];
  const bekle = (tip, zamanAsimi = 5000) =>
    new Promise((coz, reddet) => {
      const mevcut = gelen.find((m) => m.tip === tip && !m._tuketildi);
      if (mevcut) {
        mevcut._tuketildi = true;
        return coz(mevcut);
      }
      const t = setTimeout(() => reddet(new Error(`'${tip}' beklenirken zaman aşımı; gelenler: ${gelen.map((m) => m.tip).join(',')}`)), zamanAsimi);
      const dinle = (m) => {
        if (m.tip === tip && !m._tuketildi) {
          m._tuketildi = true;
          clearTimeout(t);
          bekleyenler.delete(dinle);
          coz(m);
        }
      };
      bekleyenler.add(dinle);
    });
  const bekleyenler = new Set();
  ws.on('message', (veri, ikili) => {
    if (ikili) return;
    const m = JSON.parse(veri.toString());
    gelen.push(m);
    for (const d of [...bekleyenler]) d(m);
  });
  await new Promise((r) => ws.once('open', r));

  ws.send(JSON.stringify({ tip: 'baslat', gorevId: g.id, mod: 'tarayici-ses' }));
  const hazir = await bekle('hazir');
  assert.equal(hazir.gorev.id, g.id);
  const acilis = await bekle('metin');
  assert.equal(acilis.rol, 'asistan');
  assert.match(acilis.metin, /dijital asistanı/);
  assert.equal(acilis.sesGelecek, false, 'tarayıcı sesi modunda sunucu ses göndermez');

  ws.send(JSON.stringify({ tip: 'metin', metin: 'Olur, ertelenebilir.' }));
  const yanki = await bekle('metin'); // karşı taraf satırı
  assert.equal(yanki.rol, 'karsi');
  const cevap = await bekle('metin');
  assert.equal(cevap.rol, 'asistan');
  assert.match(cevap.metin, /on altı/);

  ws.send(JSON.stringify({ tip: 'metin', metin: 'Tamam, hoşça kal' }));
  await bekle('metin'); // karsi
  const veda = await bekle('metin');
  assert.ok(!veda.metin.includes('[GORUSME_BITTI]'), 'bitiş etiketi kullanıcıya sızmamalı');
  const bitti = await bekle('bitti');
  assert.equal(bitti.sebep, 'asistan-kapatti');
  assert.equal(bitti.gorev.durum, 'tamamlandi');
  assert.equal(bitti.gorev.sonuc.basarili, true);
  assert.equal(bitti.gorev.transkript.length, 5);
  ws.close();
});

test('telefon köprüsü: sunucu sesi modunda ses gelir ve STT çalışır', async () => {
  const ws = new WebSocket(beyinUrl.replace('http', 'ws') + `/ws/telefon?token=${token}`);
  const metinler = [];
  let ikiliSayisi = 0;
  ws.on('message', (veri, ikili) => {
    if (ikili) ikiliSayisi++;
    else metinler.push(JSON.parse(veri.toString()));
  });
  await new Promise((r) => ws.once('open', r));
  ws.send(JSON.stringify({ tip: 'baslat', mod: 'sunucu-ses' }));
  await new Promise((r) => setTimeout(r, 400));
  assert.ok(metinler.some((m) => m.tip === 'hazir'));
  assert.ok(metinler.some((m) => m.tip === 'ses' && m.mime === 'audio/mpeg'));
  assert.ok(ikiliSayisi >= 1, 'mp3 ikili çerçevesi bekleniyordu');

  ws.send(JSON.stringify({ tip: 'ses', mime: 'audio/webm' }));
  ws.send(Buffer.from('sahte-webm-verisi'));
  await new Promise((r) => setTimeout(r, 400));
  assert.ok(metinler.some((m) => m.tip === 'metin' && m.rol === 'karsi' && m.metin === 'sahte transkript'));
  ws.send(JSON.stringify({ tip: 'bitir' }));
  await new Promise((r) => setTimeout(r, 200));
  assert.ok(metinler.some((m) => m.tip === 'bitti' && m.sebep === 'kullanici-kapatti'));
  ws.close();
});

test('telefon köprüsü: yetkisiz WebSocket reddedilir', async () => {
  const ws = new WebSocket(beyinUrl.replace('http', 'ws') + '/ws/telefon');
  const hata = await new Promise((r) => {
    ws.once('error', r);
    ws.once('unexpected-response', (_req, res) => r(new Error(String(res.statusCode))));
  });
  assert.match(String(hata.message), /401/);
});

test('görev: kayıt silme — transkript dahil dosya yok olur', async () => {
  const { veri: g } = await api('/gorevler', { talimat: 'Silinmek üzere test görevi' });
  const sil = await api(`/gorevler/${g.id}/sil`, {});
  assert.equal(sil.durum, 200);
  assert.equal(sil.veri.silindi, g.id);
  const yok = await api(`/gorevler/${g.id}`);
  assert.equal(yok.durum, 404, 'silinen görev bir daha okunamamalı');
});

test('voip-ara: ses testi yeşil değilken arama ÇALDIRILMAZ (423)', async () => {
  const { veri: g } = await api('/gorevler', { talimat: 'Kapı testi araması', numara: '05550000000' });
  const { durum, veri } = await api(`/gorevler/${g.id}/voip-ara`, {});
  assert.equal(durum, 423);
  assert.match(veri.hata, /ses testi/);
  // Görev araniyor'a geçmemeli
  const { veri: taze } = await api(`/gorevler/${g.id}`);
  assert.notEqual(taze.durum, 'araniyor', 'kapı kapalıyken görev araniyor olmamalı');
});
