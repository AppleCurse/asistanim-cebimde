#!/usr/bin/env node
// Geliştirme ortamı (telefon YOK): sahte 9router + sahte beden + gerçek beyin, tek süreçte.
// Kullanım:  node scripts/dev/sahte-ortam.mjs   → http://localhost:20131/?token=dev
// Gerçek bir 9router'a bağlamak için: LLM_BASE_URL=http://127.0.0.1:20128/v1 LLM_API_KEY=... GERCEK_LLM=1 node scripts/dev/sahte-ortam.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.ASISTAN_HOME ||= path.join(os.tmpdir(), 'asistan-dev');
process.env.BEDEN_MOD = 'mock';
process.env.BEYIN_TOKEN ||= 'dev';
process.env.BEDEN_TOKEN ||= 'dev-beden';
process.env.KULLANICI_ADI ||= 'Geliştirici';
fs.mkdirSync(process.env.ASISTAN_HOME, { recursive: true });

const { ayarYukle } = await import('../../ortak/ayar.mjs');
const { bedenBaslat } = await import('../../beden/server.mjs');
const { beyinBaslat } = await import('../../beyin/index.mjs');

const ayar = ayarYukle();
// Geliştirmede tüm izinler açık (sahte cihaz zaten hiçbir şeye dokunmaz)
for (const k of Object.keys(ayar.beden.izinler)) ayar.beden.izinler[k] = true;

if (!process.env.GERCEK_LLM) {
  const { sahte9RouterBaslat } = await import('../../test/yardimci/sahte-9router.mjs');
  const sahte = await sahte9RouterBaslat();
  ayar.beyin.llm.baseUrl = sahte.url;
  ayar.beyin.llm.apiKey = 'sahte';
  console.log(`[dev] sahte 9router → ${sahte.url} (yanıtlar senaryoludur: "pil", "bak", telefon görüşmesi)`);
}

const bedenPort = Number(process.env.BEDEN_PORT || 20130);
bedenBaslat({ ayar, token: process.env.BEDEN_TOKEN, host: '127.0.0.1', port: bedenPort });
ayar.beyin.bedenUrl = `http://127.0.0.1:${bedenPort}`;
beyinBaslat({ ayar, token: process.env.BEYIN_TOKEN, bedenToken: process.env.BEDEN_TOKEN, host: process.env.BEYIN_HOST || '0.0.0.0', port: Number(process.env.BEYIN_PORT || 20131) });
console.log(`[dev] panel → http://localhost:${process.env.BEYIN_PORT || 20131}/?token=${process.env.BEYIN_TOKEN}`);
