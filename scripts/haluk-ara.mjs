// Haluk Bilginer sesiyle Salim Bey'e (05324687613) arama
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { ASISTAN_HOME } from '../ortak/ayar.mjs';

const homeDizini = process.env.ASISTAN_HOME || (fs.existsSync('/data/data/com.termux/files/home/.asistan') ? '/data/data/com.termux/files/home/.asistan' : ASISTAN_HOME);
const GOREV_DIZINI = path.join(homeDizini, 'gorevler');
const id = 'haluk-arama-' + Date.now().toString(36);
const numara = '05324687613';

const gorev = {
  id,
  olusturuldu: new Date().toISOString(),
  kaynak: 'panel',
  talimat: "Salim Bey'i (05324687613) ara. Haluk Bilginer sesi ve üslubuyla açılış yap. Kiminle görüşmek istediğini sor, mevcut ses seçeneklerini say ve kimi bağlamanı istediğini öğren.",
  durum: 'hazir',
  mod: 'voip',
  transkript: [],
  sonuc: null,
  baslik: "Haluk Bilginer Sesli Test Araması",
  amac: "Salim Bey'e Haluk Bilginer olarak kiminle görüşmek istediğini sormak ve seçenekleri (Recep Tayyip Erdoğan, Sedat Peker vb.) sunmak.",
  ton: "Haluk Bilginer gibi tok, karizmatik, tiyatral, kendinden emin, nüktedan ve samimi",
  acilis: "Merhaba, ben Haluk Bilginer. Kiminle görüşmek istediğini söyle, sana onun araması için yardımcı olacağım. İster Recep Tayyip Erdoğan olsun, ister Sedat Peker, kimi istersen seni onunla konuşturabilirim. Kimi bağlayayım?",
  konusma_noktalari: [
    "Kiminle görüşmek istediğini sor.",
    "Recep Tayyip Erdoğan, Sedat Peker veya kimi isterse onun sesini bağlayabileceğini söyle.",
    "Muhatabın vereceği cevaba göre rolü sürdür ve arama talebini onaylayıp yanıt ver."
  ],
  sinirlar: [
    "Görüşmeyi çok uzatma, net ve keyifli bir diyalog kur.",
    "Haluk Bilginer üslubunu ve samimi karizmasını koru."
  ],
  kisi: {
    ad: "Salim Bey",
    numara,
    iliski: "kullanıcı / patron"
  },
  eksik_bilgi: [],
  guncellendi: new Date().toISOString()
};

fs.mkdirSync(GOREV_DIZINI, { recursive: true });
fs.writeFileSync(path.join(GOREV_DIZINI, `${id}.json`), JSON.stringify(gorev, null, 2), 'utf8');
console.log(`[GÖREV OLUŞTURULDU] ID: ${id}`);

const tokenDosyasi = path.join(homeDizini, 'beyin.token');
const token = fs.existsSync(tokenDosyasi) ? fs.readFileSync(tokenDosyasi, 'utf8').trim() : '';

const tlsDizini = path.join(homeDizini, 'tls');
const certDosyasi = path.join(tlsDizini, 'cert.pem');
const tlsVar = fs.existsSync(certDosyasi);
const port = Number(process.env.BEYIN_PORT || 20131);
const url = `${tlsVar ? 'https' : 'http'}://127.0.0.1:${port}/api/gorevler/${id}/voip-ara`;

const govde = JSON.stringify({ numara });

const secenekler = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Content-Length': Buffer.byteLength(govde),
  },
  ...(tlsVar ? { ca: fs.readFileSync(certDosyasi), rejectUnauthorized: false } : {}),
};

const istemci = tlsVar ? https : http;
const req = istemci.request(url, secenekler, (res) => {
  let veri = '';
  res.on('data', chunk => veri += chunk);
  res.on('end', () => {
    console.log(`[ARAMA CEVAP] HTTP ${res.statusCode}:`, veri);
  });
});

req.on('error', (err) => {
  console.error('[ARAMA HATA]', err.message);
});

req.write(govde);
req.end();
