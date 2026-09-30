// BEDEN — Termux üzerinde çalışan cihaz köprüsü.
// Telefonun gözünü (kamera), kulağını (mikrofon), ağzını (TTS/hoparlör) ve
// ellerini (telefon, SMS, bildirim) küçük bir HTTP API olarak sunar.
//
// Güvenlik: Android'de localhost'a cihazdaki HER uygulama bağlanabilir.
// Bu yüzden /saglik dışındaki tüm uçlar Bearer token ister ve her yetenek
// ~/.asistan/config.json → beden.izinler ile tek tek açılıp kapanır.

import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { ayarYukle, tokenAl, logOlustur, VERI_DIZINI } from '../ortak/ayar.mjs';
import { TermuxCihaz, termuxMu } from './termux-api.mjs';
import { SahteCihaz } from './mock.mjs';

const BASLANGIC = Date.now();

export function cihazSec(ayar) {
  const mod = ayar.beden.mod;
  const termux = mod === 'termux' || (mod === 'otomatik' && termuxMu());
  if (termux) return new TermuxCihaz({ veriDizini: VERI_DIZINI, fotografGenislik: ayar.beden.fotografGenislik });
  return new SahteCihaz({ veriDizini: VERI_DIZINI });
}

function jsonYanit(res, kod, veri) {
  const govde = JSON.stringify(veri);
  res.writeHead(kod, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(govde) });
  res.end(govde);
}

function govdeOku(req, limit = 1024 * 1024) {
  return new Promise((coz, reddet) => {
    const parcalar = [];
    let boyut = 0;
    req.on('data', (p) => {
      boyut += p.length;
      if (boyut > limit) {
        reddet(Object.assign(new Error('istek gövdesi çok büyük'), { kod: 413 }));
        req.destroy();
        return;
      }
      parcalar.push(p);
    });
    req.on('end', () => {
      if (!parcalar.length) return coz({});
      try {
        coz(JSON.parse(Buffer.concat(parcalar).toString('utf8')));
      } catch {
        reddet(Object.assign(new Error('geçersiz JSON'), { kod: 400 }));
      }
    });
    req.on('error', reddet);
  });
}

function dosyaAdi(onek, uzanti) {
  const zaman = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(VERI_DIZINI, `${onek}-${zaman}.${uzanti}`);
}

class IzinHatasi extends Error {
  constructor(izin) {
    super(`"${izin}" izni kapalı — ~/.asistan/config.json → beden.izinler.${izin}: true yapın`);
    this.kod = 403;
  }
}

/** Rota tablosu: [yöntem, yol, gereken izin, işleyici] */
function rotalar(cihaz, ayar) {
  const izinKontrol = (izin) => {
    if (izin && !ayar.beden.izinler[izin]) throw new IzinHatasi(izin);
  };
  const tanimla = (yontem, yol, izin, isleyici) => ({
    yontem,
    yol,
    async calistir(govde, url) {
      izinKontrol(izin);
      return isleyici(govde, url);
    },
  });

  return [
    tanimla('GET', '/pil', null, () => cihaz.pil()),
    tanimla('GET', '/wifi', null, () => cihaz.wifi()),
    tanimla('GET', '/yetenekler', null, () => ({ ...cihaz.yetenekler(), izinler: ayar.beden.izinler })),

    // Göz
    tanimla('GET', '/kamera/bilgi', 'kamera', () => cihaz.kameraBilgi()),
    tanimla('POST', '/kamera/cek', 'kamera', async (g) => {
      const dosya = dosyaAdi('foto', 'jpg');
      const sonuc = await cihaz.fotografCek({ kamera: Number(g.kamera ?? 0), dosya });
      const veri = fs.readFileSync(sonuc.dosya);
      const mime = veri[0] === 0x89 ? 'image/png' : 'image/jpeg';
      return { ...sonuc, ad: path.basename(sonuc.dosya), mime, boyut: veri.length, base64: g.base64 === false ? undefined : veri.toString('base64') };
    }),
    tanimla('POST', '/kamera/qr', 'kamera', async (g) => {
      const dosya = g.dosya ? path.join(VERI_DIZINI, path.basename(g.dosya)) : dosyaAdi('qr', 'jpg');
      if (!g.dosya) await cihaz.fotografCek({ kamera: Number(g.kamera ?? 0), dosya });
      return cihaz.qrOku(dosya);
    }),

    // Kulak
    tanimla('POST', '/mikrofon/kaydet', 'mikrofon', async (g) => {
      const sure = Math.min(Math.max(Number(g.sure ?? 5), 1), 60);
      const sonuc = await cihaz.sesKaydet({ dosya: dosyaAdi('ses', 'm4a'), sure });
      let dosya = sonuc.dosya;
      let mime = sonuc.mime;
      if (g.format === 'wav' && !dosya.endsWith('.wav')) {
        const hedef = dosya.replace(/\.[^.]+$/, '.wav');
        await cihaz.sesDonustur(dosya, hedef);
        dosya = hedef;
        mime = 'audio/wav';
      }
      const veri = fs.readFileSync(dosya);
      return { dosya, ad: path.basename(dosya), mime, sure, boyut: veri.length, base64: g.base64 === false ? undefined : veri.toString('base64') };
    }),
    tanimla('POST', '/mikrofon/dinle', 'mikrofon', () => cihaz.konusmayiYaziyaCevir()),

    // Ağız
    tanimla('POST', '/konus', 'konusma', (g) => {
      if (!g.metin) throw Object.assign(new Error('metin gerekli'), { kod: 400 });
      return cihaz.konus({ metin: String(g.metin).slice(0, 4000), dil: g.dil || ayar.kullanici.dil, hiz: g.hiz, ton: g.ton });
    }),
    tanimla('GET', '/konus/motorlar', 'konusma', () => cihaz.ttsMotorlari()),
    tanimla('POST', '/ses/cal', 'konusma', async (g) => {
      let dosya = g.dosya;
      if (g.base64) {
        dosya = dosyaAdi('cal', g.uzanti || 'mp3');
        fs.writeFileSync(dosya, Buffer.from(g.base64, 'base64'));
      }
      if (!dosya) throw Object.assign(new Error('dosya veya base64 gerekli'), { kod: 400 });
      return cihaz.sesCal(path.isAbsolute(dosya) ? dosya : path.join(VERI_DIZINI, path.basename(dosya)));
    }),
    tanimla('POST', '/ses/durdur', 'konusma', () => cihaz.sesDurdur()),

    // El
    tanimla('POST', '/telefon/ara', 'telefon', (g) => {
      const numara = String(g.numara || '').replace(/[^\d+*#]/g, '');
      if (!numara) throw Object.assign(new Error('geçerli numara gerekli'), { kod: 400 });
      return cihaz.ara(numara);
    }),
    tanimla('GET', '/telefon/bilgi', 'telefon', () => cihaz.telefonBilgi()),
    tanimla('GET', '/telefon/kayitlar', 'telefon', (_g, url) => cihaz.aramaKayitlari(Number(url.searchParams.get('limit') || 20))),
    tanimla('POST', '/sms/gonder', 'sms', (g) => {
      if (!g.numara || !g.metin) throw Object.assign(new Error('numara ve metin gerekli'), { kod: 400 });
      return cihaz.smsGonder({ numara: String(g.numara), metin: String(g.metin) });
    }),
    tanimla('GET', '/sms/liste', 'sms', (_g, url) => cihaz.smsListe({ limit: Number(url.searchParams.get('limit') || 20), tur: url.searchParams.get('tur') || 'inbox' })),
    tanimla('GET', '/kisiler', 'kisiler', () => cihaz.kisiler()),

    // Diğer
    tanimla('GET', '/konum', 'konum', (_g, url) => cihaz.konum(url.searchParams.get('saglayici') || 'network')),
    tanimla('POST', '/bildirim', 'bildirim', (g) => cihaz.bildirim({ baslik: String(g.baslik || 'Asistan'), icerik: String(g.icerik || ''), id: g.id })),
    tanimla('POST', '/titret', 'bildirim', (g) => cihaz.titret(Number(g.ms || 300))),
    tanimla('GET', '/pano', 'pano', () => cihaz.panoOku()),
    tanimla('POST', '/pano', 'pano', (g) => cihaz.panoYaz(String(g.metin || ''))),
    tanimla('POST', '/fener', 'kamera', (g) => cihaz.fener(Boolean(g.acik))),
    tanimla('POST', '/kabuk', 'kabuk', (g) => cihaz.kabuk(String(g.komut || ''))),
  ];
}

export function bedenBaslat({ ayar = ayarYukle(), token = tokenAl('beden'), cihaz = cihazSec(ayar), log = logOlustur('beden'), host, port } = {}) {
  const tablo = rotalar(cihaz, ayar);
  const beklenenTokenHash = crypto.createHash('sha256').update(String(token)).digest();

  const sunucu = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://beden');
    try {
      if (req.method === 'GET' && url.pathname === '/saglik') {
        return jsonYanit(res, 200, { durum: 'yasiyor', mod: cihaz.mod, calismaSuresi: Math.round((Date.now() - BASLANGIC) / 1000), surum: '0.1.0' });
      }

      const yetki = req.headers.authorization || '';
      const gelenTokenHash = crypto.createHash('sha256').update(yetki.startsWith('Bearer ') ? yetki.slice(7) : '').digest();
      if (!crypto.timingSafeEqual(gelenTokenHash, beklenenTokenHash) || !yetki.startsWith('Bearer ')) return jsonYanit(res, 401, { hata: 'yetkisiz' });

      if (req.method === 'GET' && url.pathname.startsWith('/dosya/')) {
        const ad = path.basename(decodeURIComponent(url.pathname.slice('/dosya/'.length)));
        const tam = path.join(VERI_DIZINI, ad);
        if (!fs.existsSync(tam)) return jsonYanit(res, 404, { hata: 'dosya yok' });
        res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${ad}"` });
        return fs.createReadStream(tam).pipe(res);
      }

      const rota = tablo.find((r) => r.yontem === req.method && r.yol === url.pathname);
      if (!rota) return jsonYanit(res, 404, { hata: 'rota yok' });

      const govde = req.method === 'POST' ? await govdeOku(req) : {};
      const sonuc = await rota.calistir(govde, url);
      jsonYanit(res, 200, { tamam: true, sonuc });
    } catch (hata) {
      const kod = hata.kod || 500;
      if (kod >= 500) log.hata(`${req.method} ${url.pathname}: ${hata.message}`);
      jsonYanit(res, kod, { tamam: false, hata: hata.message });
    }
  });

  const dinleHost = host ?? ayar.beden.host;
  const dinlePort = port ?? ayar.beden.port;
  sunucu.listen(dinlePort, dinleHost, () => {
    const adres = sunucu.address();
    log.bilgi(`Beden ayakta → http://${dinleHost}:${adres.port} (cihaz: ${cihaz.mod})`);
    if (cihaz.mod === 'mock') log.uyari('Sahte cihaz modu: Termux:API bulunamadı, tüm donanım çağrıları taklit ediliyor.');
    const kapali = Object.entries(ayar.beden.izinler).filter(([, v]) => !v).map(([k]) => k);
    if (kapali.length) log.bilgi(`Kapalı izinler: ${kapali.join(', ')} (config.json → beden.izinler)`);
  });
  return sunucu;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  bedenBaslat();
}
