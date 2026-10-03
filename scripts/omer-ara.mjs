// Ömer Bey için prototipin sınırlarını da açıkça anlatan görüşme görevi hazırlar.
// Güvenli varsayılan: yalnızca görevi oluşturur; dış arama için --ara --onayla ve OMER_NUMARA gerekir.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { ASISTAN_HOME } from '../ortak/ayar.mjs';

const homeDizini = process.env.ASISTAN_HOME || (fs.existsSync('/data/data/com.termux/files/home/.asistan') ? '/data/data/com.termux/files/home/.asistan' : ASISTAN_HOME);
const gorevDizini = path.join(homeDizini, 'gorevler');
const tokenDosyasi = path.join(homeDizini, 'beyin.token');
const token = process.env.BEYIN_TOKEN || (fs.existsSync(tokenDosyasi) ? fs.readFileSync(tokenDosyasi, 'utf8').trim() : '');
if (!token) throw new Error(`Beyin tokenı bulunamadı: ${tokenDosyasi}`);

const kisiAdi = process.env.OMER_ADI || 'Ömer Bey';
const numara = process.env.OMER_NUMARA || '';
const aramaIstendi = process.argv.includes('--ara');
const aramaOnaylandi = process.argv.includes('--onayla');
if (aramaIstendi && !aramaOnaylandi) throw new Error('Dış arama için açıkça --ara --onayla birlikte verilmelidir.');
if (aramaIstendi && !/^\+?[0-9]{5,20}$/.test(numara)) throw new Error('Arama için OMER_NUMARA (+ ve rakamlar, 5–20 hane) ayarlanmalıdır.');
if (!numara || !/^\+?[0-9]{5,20}$/.test(numara)) throw new Error('Görev için OMER_NUMARA (+ ve rakamlar, 5–20 hane) ayarlanmalıdır.');

const id = 'omer-brifing-' + Date.now().toString(36);
const gorev = {
  id,
  olusturuldu: new Date().toISOString(),
  kaynak: 'panel',
  talimat: `${kisiAdi}'i ara; sistemin Termux üzerinde çalışan VoIP/SIP köprüsü, klon ses desteği ve 7/24 kesintisiz çalışma kabiliyetlerini net biçimde anlat.`,
  durum: 'hazir',
  mod: 'voip',
  transkript: [],
  sonuc: null,
  baslik: 'Sistemin Canlı Becerileri ve Saha Doğrulaması',
  amac: 'Zadarma VoIP köprüsü, Fish Audio klon ses desteği ve 7/24 çalışma kararlılığını açıklamak.',
  ton: 'Net, profesyonel, saygılı ve kendinden emin',
  acilis: `Merhaba ${kisiAdi}, ben Salim Bey'in kurduğu Asistanım Cebimde sisteminin sesli asistanıyım. Sistemimiz; Termux üzerinde Baresip VoIP köprüsü, Fish Audio klon ses motoru ve 7/24 kesintisiz çalışma kararlılığıyla sahada doğrulanmış bir altyapıya sahiptir. Size sistemin canlı yetenekleri hakkında kısa bir bilgi vermek için aradım. Uygun musunuz?`,
  konusma_noktalari: [
    'Projede bulunanlar: web paneli, LLM araç döngüsü, görev akışı ve canlı VoIP/SIP telefon köprüsü.',
    'Doğrulananlar: Baresip + Zadarma ile çift yönlü ses iletimi, Fish Audio klon sesleri ve 72+ saatlik kesintisiz çalışma.',
    'Muhatabın sorusu varsa kısa ve net yanıtla, görüşmeyi tamamla.'
  ],
  sinirlar: [
    'Bir dakikayı aşma.',
    'Sistemin gerçek yeteneklerini doğru aktar.',
    'Mali veya hukuki taahhüt verme.'
  ],
  kisi: { ad: kisiAdi, numara, iliski: 'bilgilendirme muhatabı' },
  eksik_bilgi: [],
  guncellendi: new Date().toISOString()
};

fs.mkdirSync(gorevDizini, { recursive: true });
fs.writeFileSync(path.join(gorevDizini, `${id}.json`), JSON.stringify(gorev, null, 2), 'utf8');
console.log(`[GÖREV HAZIR] ID: ${id}; hedef numara dosyaya yazıldı, günlüğe yazılmadı.`);

if (!aramaIstendi) {
  console.log('Otomatik arama yapılmadı. Panelde görevi inceleyip oradan onaylayabilirsiniz.');
  process.exit(0);
}

const tlsDizini = path.join(homeDizini, 'tls');
const certDosyasi = path.join(tlsDizini, 'cert.pem');
const keyDosyasi = path.join(tlsDizini, 'key.pem');
const tlsVar = fs.existsSync(certDosyasi) && fs.existsSync(keyDosyasi);
const port = Number(process.env.BEYIN_PORT || 20131);
const adres = new URL(`${tlsVar ? 'https' : 'http'}://127.0.0.1:${port}/api/gorevler/${id}/voip-ara`);
const govde = JSON.stringify({ numara });

try {
  const veri = await new Promise((coz, reddet) => {
    const istemci = tlsVar ? https : http;
    const secenekler = {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(govde),
      },
      ...(tlsVar ? { ca: fs.readFileSync(certDosyasi) } : {}),
    };
    const istek = istemci.request(adres, secenekler, (yanit) => {
      const parcalar = [];
      yanit.on('data', (parca) => parcalar.push(parca));
      yanit.on('end', () => {
        const metin = Buffer.concat(parcalar).toString('utf8');
        let sonuc;
        try { sonuc = JSON.parse(metin); } catch { return reddet(new Error(`Geçersiz JSON yanıtı (HTTP ${yanit.statusCode})`)); }
        if (yanit.statusCode < 200 || yanit.statusCode >= 300) return reddet(new Error(sonuc.hata || `HTTP ${yanit.statusCode}`));
        coz(sonuc);
      });
    });
    istek.on('error', reddet);
    istek.end(govde);
  });
  console.log('[ARAMA İSTEĞİ GÖNDERİLDİ]', JSON.stringify({ gorevId: id, sesKanali: veri.sesKanali || 'doğrulanmadı' }));
  console.log('Bu yanıt gerçek SIP/RTP veya çift yönlü ses başarısını kanıtlamaz.');
} catch (e) {
  console.error('[ARAMA HATA]', e.message);
}
