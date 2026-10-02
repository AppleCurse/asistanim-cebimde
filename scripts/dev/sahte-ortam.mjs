#!/usr/bin/env node
// Geliştirme ortamı (telefon YOK): sahte 9router + sahte beden + gerçek beyin, tek süreçte.
// Kullanım:  node scripts/dev/sahte-ortam.mjs   → http://localhost:20131/ (anahtar yolu yazdırılır; rastgele üretilir)
// Gerçek 9router için: GERCEK_LLM=1 LLM_BASE_URL=http://127.0.0.1:20128/v1 LLM_API_KEY=... node scripts/dev/sahte-ortam.mjs
// Doğrudan uzak sağlayıcı için LLM_BASE_URL'i sağlayıcıya ayarla ve ENABLE_9ROUTER=0 ekle.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.ASISTAN_HOME ||= path.join(os.tmpdir(), 'asistan-dev');
process.env.BEDEN_MOD = 'mock';
process.env.KULLANICI_ADI ||= 'Geliştirici';
fs.mkdirSync(process.env.ASISTAN_HOME, { recursive: true });

const { ayarYukle, tokenAl } = await import('../../ortak/ayar.mjs');
const { bedenBaslat } = await import('../../beden/server.mjs');
const { beyinBaslat } = await import('../../beyin/index.mjs');

const ayar = ayarYukle();
// Geliştirmede tüm izinler açık (sahte cihaz zaten hiçbir şeye dokunmaz)
for (const k of Object.keys(ayar.beden.izinler)) ayar.beden.izinler[k] = true;

if (!process.env.GERCEK_LLM) {
  // Geliştirme sahte servisi rastgele yerel portta dinler; bu gerçek provider modu değildir.
  process.env.ENABLE_9ROUTER = '0';
  const { sahte9RouterBaslat } = await import('../../test/yardimci/sahte-9router.mjs');
  const sahte = await sahte9RouterBaslat();
  ayar.beyin.llm.baseUrl = sahte.url;
  ayar.beyin.llm.apiKey = 'sahte';
  console.log(`[dev] sahte 9router → ${sahte.url} (yanıtlar senaryoludur: "pil", "bak", telefon görüşmesi)`);
}

const bedenPort = Number(process.env.BEDEN_PORT || 20130);
const bedenToken = tokenAl('beden');
const beyinToken = tokenAl('beyin');
bedenBaslat({ ayar, token: bedenToken, host: '127.0.0.1', port: bedenPort });
ayar.beyin.bedenUrl = `http://127.0.0.1:${bedenPort}`;
beyinBaslat({ ayar, token: beyinToken, bedenToken, host: process.env.BEYIN_HOST || '127.0.0.1', port: Number(process.env.BEYIN_PORT || 20131) });
console.log(`[dev] panel → http://localhost:${process.env.BEYIN_PORT || 20131}/`);
console.log(`[dev] giriş anahtarı kaynağı → ${process.env.BEYIN_TOKEN ? 'BEYIN_TOKEN ortam değişkeni' : path.join(process.env.ASISTAN_HOME, 'beyin.token')}`);
