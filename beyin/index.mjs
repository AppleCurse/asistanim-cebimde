// BEYİN — ajan + web paneli + telefon köprüsü sunucusu.
// Cebindeki telefondan http://<eski-telefon-ip>:20131/?token=... ile açılır.

import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ayarYukle, tokenAl, logOlustur, ASISTAN_HOME } from '../ortak/ayar.mjs';
import { LLMIstemci } from './llm.mjs';
import { BedenIstemci } from './beden-istemci.mjs';
import { Hafiza } from './hafiza.mjs';
import { GorevYoneticisi } from './gorev.mjs';
import { Asistan } from './asistan.mjs';
import { tarayiciKoprusuKur } from './kopru/tarayici.mjs';

const WEB_DIZINI = path.join(path.dirname(fileURLToPath(import.meta.url)), 'web');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const BASLANGIC = Date.now();

function jsonYanit(res, kod, veri) {
  const govde = JSON.stringify(veri);
  res.writeHead(kod, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(govde) });
  res.end(govde);
}

function govdeOku(req, limit = 12 * 1024 * 1024) {
  return new Promise((coz, reddet) => {
    const parcalar = [];
    let boyut = 0;
    req.on('data', (p) => {
      boyut += p.length;
      if (boyut > limit) {
        reddet(Object.assign(new Error('istek çok büyük'), { kod: 413 }));
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

function cerezler(req) {
  return Object.fromEntries(
    (req.headers.cookie || '')
      .split(';')
      .map((p) => p.trim().split('=').map(decodeURIComponent))
      .filter((p) => p[0]),
  );
}

function agAdresleri() {
  const liste = [];
  for (const [ad, arayuzler] of Object.entries(os.networkInterfaces())) {
    for (const a of arayuzler || []) if (a.family === 'IPv4' && !a.internal) liste.push({ arayuz: ad, ip: a.address });
  }
  return liste;
}

export function beyinBaslat({ ayar = ayarYukle(), token = tokenAl('beyin'), bedenToken = tokenAl('beden'), log = logOlustur('beyin'), host, port } = {}) {
  const llm = new LLMIstemci({ ...ayar.beyin.llm });
  const beden = new BedenIstemci({ url: ayar.beyin.bedenUrl, token: bedenToken });
  const hafiza = new Hafiza();
  const gorevler = new GorevYoneticisi({ llm, ayar, hafiza, log });
  const asistan = new Asistan({ llm, beden, ayar, hafiza, gorevler, log });

  const yetkiliMi = (req, url) => {
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    return bearer === token || url.searchParams.get('token') === token || cerezler(req).asistan_token === token;
  };

  async function api(req, res, url) {
    const yol = url.pathname.replace(/^\/api/, '');
    const govde = req.method === 'POST' ? await govdeOku(req) : {};
    const M = req.method;

    if (M === 'GET' && yol === '/durum') {
      const bedenDurum = await beden.saglik();
      let yetenekler = null;
      if (bedenDurum.durum === 'yasiyor') yetenekler = await beden.yetenekler().catch(() => null);
      return {
        asistan: ayar.kullanici.asistanAdi,
        kullanici: ayar.kullanici.ad,
        calismaSuresi: Math.round((Date.now() - BASLANGIC) / 1000),
        beden: { ...bedenDurum, yetenekler },
        llm: { baseUrl: llm.baseUrl, model: llm.model || '(otomatik)', stt: ayar.beyin.stt, tts: ayar.beyin.tts },
        arama: ayar.arama,
        ag: agAdresleri(),
        bellek: { rssMB: Math.round(process.memoryUsage().rss / 1048576), bosMB: Math.round(os.freemem() / 1048576) },
      };
    }
    if (M === 'GET' && yol === '/modeller') return { modeller: await llm.modeller(), secili: llm.model };

    if (M === 'POST' && yol === '/sohbet') {
      if (!govde.metin?.trim() && !govde.resimler?.length) throw Object.assign(new Error('metin gerekli'), { kod: 400 });
      const oturum = String(govde.oturum || 'panel');
      return asistan.yanitla(oturum, String(govde.metin || '(görsel gönderildi)'), { resimler: govde.resimler || [] });
    }
    if (M === 'POST' && yol === '/sohbet/sifirla') {
      asistan.sifirla(String(govde.oturum || 'panel'));
      return { tamam: true };
    }
    if (M === 'GET' && yol === '/hafiza') return { icerik: hafiza.oku(50_000) };
    if (M === 'POST' && yol === '/hafiza') return { satir: hafiza.hatirla(String(govde.metin || ''), govde.etiket || 'not') };

    if (M === 'POST' && yol === '/bak') {
      const s = await beden.fotografCek(Number(govde.kamera ?? 0));
      return { ad: s.ad, mime: s.mime, base64: s.base64 };
    }
    if (M === 'POST' && yol === '/soyle') {
      if (ayar.beyin.tts === '9router') {
        const ses = await llm.seslendir(String(govde.metin || ''));
        await beden.sesCal({ base64: ses.toString('base64'), uzanti: 'mp3' });
      } else await beden.konus(String(govde.metin || ''), ayar.kullanici.dil);
      return { tamam: true };
    }
    if (M === 'POST' && yol === '/pil') return beden.pil();

    if (M === 'GET' && yol === '/gorevler') return { gorevler: gorevler.listele() };
    if (M === 'POST' && yol === '/gorevler') {
      if (!govde.talimat?.trim()) throw Object.assign(new Error('talimat gerekli'), { kod: 400 });
      return gorevler.olustur(String(govde.talimat), { kaynak: 'panel', numara: govde.numara });
    }
    const gorevEs = yol.match(/^\/gorevler\/([^/]+)(?:\/([^/]+))?$/);
    if (gorevEs) {
      const [, id, eylem] = gorevEs;
      const g = gorevler.al(id);
      if (!g) throw Object.assign(new Error('görev yok'), { kod: 404 });
      if (M === 'GET' && !eylem) return g;
      if (M === 'POST' && !eylem) {
        const izinli = ['durum', 'kisi', 'mod', 'konusma_noktalari', 'sinirlar', 'acilis', 'amac', 'baslik', 'ton'];
        const yama = Object.fromEntries(Object.entries(govde).filter(([k]) => izinli.includes(k)));
        return gorevler.guncelle(id, yama);
      }
      if (M === 'POST' && eylem === 'hucresel-ara') {
        const numara = govde.numara || g.kisi?.numara;
        if (!numara) throw Object.assign(new Error('numara yok'), { kod: 400 });
        const s = await beden.ara(numara);
        gorevler.guncelle(id, { durum: 'araniyor', mod: 'hucresel', kisi: { ...g.kisi, numara } });
        return { ...s, brifing: { acilis: g.acilis, konusma_noktalari: g.konusma_noktalari, sinirlar: g.sinirlar } };
      }
      if (M === 'POST' && eylem === 'sonuc') {
        const sonuc = { basarili: Boolean(govde.basarili), ozet: String(govde.ozet || ''), kararlar: govde.kararlar || [], takip: govde.takip || [], bitis: new Date().toISOString(), sebep: 'elle-girildi' };
        hafiza.hatirla(`Görüşme #${id} (${g.kisi?.ad || '?'}): ${sonuc.ozet}`, 'sonuc');
        return gorevler.guncelle(id, { sonuc, durum: sonuc.basarili ? 'tamamlandi' : 'basarisiz' });
      }
    }
    throw Object.assign(new Error('rota yok'), { kod: 404 });
  }

  function statik(res, dosyaAdi, ekBasliklar = {}) {
    const tam = path.join(WEB_DIZINI, path.normalize(dosyaAdi).replace(/^(\.\.[/\\])+/, ''));
    if (!tam.startsWith(WEB_DIZINI) || !fs.existsSync(tam) || fs.statSync(tam).isDirectory()) return jsonYanit(res, 404, { hata: 'yok' });
    res.writeHead(200, { 'Content-Type': MIME[path.extname(tam)] || 'application/octet-stream', 'Cache-Control': 'no-cache', ...ekBasliklar });
    fs.createReadStream(tam).pipe(res);
  }

  // ~/.asistan/tls/{cert,key}.pem varsa HTTPS: tarayıcıda mikrofon/konuşma tanıma için güvenli bağlam gerekir.
  const tlsDizini = path.join(ASISTAN_HOME, 'tls');
  const tls = ['cert.pem', 'key.pem'].every((d) => fs.existsSync(path.join(tlsDizini, d)))
    ? { cert: fs.readFileSync(path.join(tlsDizini, 'cert.pem')), key: fs.readFileSync(path.join(tlsDizini, 'key.pem')) }
    : null;

  const istekIsleyici = async (req, res) => {
    const url = new URL(req.url, 'http://beyin');
    try {
      if (url.pathname === '/saglik') return jsonYanit(res, 200, { durum: 'yasiyor', calismaSuresi: Math.round((Date.now() - BASLANGIC) / 1000) });

      const yetkili = yetkiliMi(req, url);
      const sayfa = { '/': 'index.html', '/telefon': 'telefon.html', '/giris': 'giris.html' }[url.pathname];
      if (sayfa) {
        if (!yetkili) return statik(res, 'giris.html');
        const ek = url.searchParams.get('token') === token ? { 'Set-Cookie': `asistan_token=${encodeURIComponent(token)}; Path=/; Max-Age=31536000; SameSite=Lax` } : {};
        return statik(res, sayfa, ek);
      }
      if (url.pathname.startsWith('/statik/')) return statik(res, url.pathname.slice('/statik/'.length));
      if (url.pathname === '/sw.js' || url.pathname === '/manifest.webmanifest') return statik(res, url.pathname.slice(1)); // PWA: kök kapsam

      if (url.pathname.startsWith('/api/')) {
        if (!yetkili) return jsonYanit(res, 401, { hata: 'yetkisiz — ?token=... veya Authorization: Bearer' });
        const sonuc = await api(req, res, url);
        return jsonYanit(res, 200, sonuc);
      }
      jsonYanit(res, 404, { hata: 'yok' });
    } catch (hata) {
      const kod = hata.kod || 500;
      if (kod >= 500) log.hata(`${req.method} ${url.pathname}: ${hata.message}`);
      jsonYanit(res, kod, { hata: hata.message });
    }
  };
  const sunucu = tls ? https.createServer(tls, istekIsleyici) : http.createServer(istekIsleyici);
  const sema = tls ? 'https' : 'http';

  tarayiciKoprusuKur({ sunucu, yetkiliMi, llm, gorevler, ayar, log });

  const dinleHost = host ?? ayar.beyin.host;
  const dinlePort = port ?? ayar.beyin.port;
  sunucu.listen(dinlePort, dinleHost, async () => {
    const p = sunucu.address().port;
    log.bilgi(`Beyin ayakta → ${sema}://${dinleHost}:${p}${tls ? ' (TLS: ~/.asistan/tls)' : ''}`);
    for (const a of agAdresleri()) log.bilgi(`  Panel: ${sema}://${a.ip}:${p}/?token=${token}  (${a.arayuz})`);
    const bd = await beden.saglik();
    log.bilgi(`Beden: ${bd.durum}${bd.mod ? ' (' + bd.mod + ')' : ''}`);
    try {
      log.bilgi(`LLM modeli: ${await llm.modelSagla()} @ ${llm.baseUrl}`);
    } catch (hata) {
      log.uyari(`LLM hazır değil: ${hata.message} — 9router çalışıyor mu? LLM_API_KEY doğru mu?`);
    }
  });

  return { sunucu, asistan, gorevler, llm, beden, hafiza, token };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  beyinBaslat();
}
