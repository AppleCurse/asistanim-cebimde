// TARAYICI TAŞIYICISI — "yazılım telefonu": web sayfası (cebindeki telefon) ile WebSocket üzerinden görüşme.
// Görüşme motorunu gerçek bir hat olmadan test etmenin ve asistanla sesli konuşmanın yolu.
//
// Protokol (JSON metin çerçeveleri; ses için önce {tip:'ses',mime} sonra ikili çerçeve):
//   İstemci → Sunucu: {tip:'baslat', gorevId?, mod} | {tip:'metin', metin} | {tip:'ses', mime}+binary | {tip:'bitir'}
//   Sunucu → İstemci: {tip:'hazir', gorev, mod} | {tip:'metin', rol, metin, sesGelecek} | {tip:'ses', mime}+binary
//                     | {tip:'durum', ...} | {tip:'bitti', gorev, sebep, sure} | {tip:'hata', mesaj}

import { WebSocketServer } from 'ws';
import { Gorusme } from './motor.mjs';

export function tarayiciKoprusuKur({ sunucu, yol = '/ws/telefon', yetkiliMi, llm, gorevler, ayar, log }) {
  const wss = new WebSocketServer({ noServer: true });

  sunucu.on('upgrade', (req, soket, bas) => {
    const url = new URL(req.url, 'http://beyin');
    if (url.pathname !== yol) {
      soket.destroy();
      return;
    }
    if (!yetkiliMi(req, url)) {
      soket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      soket.destroy();
      return;
    }
    wss.handleUpgrade(req, soket, bas, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws) => {
    let gorusme = null;
    let beklenenSesMime = null;
    const gonder = (nesne) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(nesne));

    const tasiyici = {
      metin: (rol, metin, sesGelecek) => gonder({ tip: 'metin', rol, metin, sesGelecek }),
      sesCal: (buffer, mime) => {
        gonder({ tip: 'ses', mime });
        if (ws.readyState === ws.OPEN) ws.send(buffer);
      },
      sesDurdur: () => gonder({ tip: 'sesDurdur' }),
      durum: (d) => gonder({ tip: 'durum', ...d }),
      bitti: (gorev, ek) => gonder({ tip: 'bitti', gorev, ...ek }),
    };

    ws.on('message', async (veri, ikiliMi) => {
      try {
        if (ikiliMi) {
          if (!gorusme) return gonder({ tip: 'hata', mesaj: 'önce baslat gönderin' });
          const mime = beklenenSesMime || 'audio/webm';
          beklenenSesMime = null;
          await gorusme.sesGeldi(Buffer.from(veri), mime);
          return;
        }
        const m = JSON.parse(veri.toString('utf8'));
        switch (m.tip) {
          case 'baslat': {
            if (gorusme?.aktif) await gorusme.bitir('yeniden-baslatildi');
            const gorev = m.gorevId ? gorevler.al(m.gorevId) : null;
            if (m.gorevId && !gorev) return gonder({ tip: 'hata', mesaj: `görev bulunamadı: ${m.gorevId}` });
            const mod = m.mod === 'sunucu-ses' ? 'sunucu-ses' : 'tarayici-ses';
            gorusme = new Gorusme({ llm, gorevler, gorev, ayar, tasiyici, log, mod });
            gonder({ tip: 'hazir', gorev, mod });
            log.bilgi(`görüşme başladı (${mod}) ${gorev ? '#' + gorev.id : 'serbest'}`);
            await gorusme.baslat();
            break;
          }
          case 'metin':
            if (!gorusme) return gonder({ tip: 'hata', mesaj: 'önce baslat gönderin' });
            await gorusme.kullaniciKonustu(m.metin);
            break;
          case 'ses':
            beklenenSesMime = m.mime || 'audio/webm';
            break;
          case 'bitir':
            if (gorusme) await gorusme.bitir('kullanici-kapatti');
            break;
          default:
            gonder({ tip: 'hata', mesaj: `bilinmeyen tip: ${m.tip}` });
        }
      } catch (hata) {
        log.hata(`ws: ${hata.message}`);
        gonder({ tip: 'hata', mesaj: hata.message });
      }
    });

    ws.on('close', () => {
      if (gorusme?.aktif) gorusme.bitir('baglanti-koptu').catch(() => {});
    });
  });

  return wss;
}
