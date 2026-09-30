// Kara kutu: kişisel veriyi değil, operasyon ölçümlerini JSONL olarak saklar.
import fs from 'node:fs';
import path from 'node:path';
import { LOG_DIZINI, dizinleriHazirla, simdi } from './ayar.mjs';

export class Telemetri {
  constructor({ dosya = path.join(LOG_DIZINI, 'kara-kutu.jsonl') } = {}) {
    dizinleriHazirla();
    this.dosya = dosya;
  }

  yaz(olay, veri = {}) {
    const satir = { zaman: simdi(), olay, ...veri };
    try { fs.appendFileSync(this.dosya, JSON.stringify(satir) + '\n', { mode: 0o600 }); } catch { /* gözlem sistemi ana akışı durdurmaz */ }
    return satir;
  }

  oku({ baslangic = 0, limit = 1000 } = {}) {
    if (!fs.existsSync(this.dosya)) return [];
    return fs.readFileSync(this.dosya, 'utf8').split('\n').filter(Boolean).slice(baslangic, baslangic + limit).map((s) => {
      try { return JSON.parse(s); } catch { return null; }
    }).filter(Boolean);
  }

  rapor({ gun = 7 } = {}) {
    const esik = Date.now() - gun * 86400000;
    const olaylar = this.oku().filter((o) => Date.parse(o.zaman) >= esik);
    const toplam = olaylar.reduce((a, o) => a + Number(o.token || 0), 0);
    const maliyet = olaylar.reduce((a, o) => a + Number(o.maliyetTL || 0), 0);
    return {
      baslangic: new Date(esik).toISOString(), bitis: simdi(), gun,
      olay: olaylar.length, token: toplam, maliyetTL: Number(maliyet.toFixed(4)),
      llm: olaylar.filter((o) => o.olay === 'llm').length,
      ses: olaylar.filter((o) => ['stt', 'tts'].includes(o.olay)).length,
      pil: olaylar.filter((o) => o.olay === 'pil').length,
    };
  }
}

export function maliyetTL({ prompt = 0, completion = 0, promptUSD = 0, completionUSD = 0 } = {}) {
  return (prompt * promptUSD + completion * completionUSD) * 35;
}
