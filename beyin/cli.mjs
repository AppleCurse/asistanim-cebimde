#!/usr/bin/env node
// Terminalden asistanla sohbet (Termux'ta doğrudan denemek için).
//   npm run sohbet            → etkileşimli sohbet
//   npm run modeller          → 9router'daki modelleri listele
//   node beyin/cli.mjs "pil kaç?"  → tek soru

import readline from 'node:readline';
import { ayarYukle, tokenAl, logOlustur } from '../ortak/ayar.mjs';
import { LLMIstemci } from './llm.mjs';
import { BedenIstemci } from './beden-istemci.mjs';
import { Hafiza } from './hafiza.mjs';
import { GorevYoneticisi } from './gorev.mjs';
import { Asistan } from './asistan.mjs';

const ayar = ayarYukle();
const log = logOlustur('cli');
const llm = new LLMIstemci({ ...ayar.beyin.llm });

if (process.argv.includes('--modeller')) {
  try {
    const liste = await llm.modeller();
    console.log(liste.length ? liste.join('\n') : '(model yok — 9router paneline sağlayıcı bağlayın)');
  } catch (hata) {
    console.error(hata.message);
    process.exit(1);
  }
  process.exit(0);
}

const beden = new BedenIstemci({ url: ayar.beyin.bedenUrl, token: tokenAl('beden') });
const hafiza = new Hafiza();
const gorevler = new GorevYoneticisi({ llm, ayar, hafiza, log });
const asistan = new Asistan({ llm, beden, ayar, hafiza, gorevler, log });

async function sor(metin) {
  const { metin: yanit, adimlar } = await asistan.yanitla('cli', metin, { onAdim: (a) => console.log(`  ⚙ ${a.arac}(${JSON.stringify(a.args)})`) });
  for (const a of adimlar) console.log(`  ↳ ${a.arac}: ${String(a.sonuc).slice(0, 160)}`);
  console.log(`\n${ayar.kullanici.asistanAdi}: ${yanit}\n`);
}

const tekSoru = process.argv.slice(2).filter((a) => !a.startsWith('--')).join(' ');
if (tekSoru) {
  await sor(tekSoru).catch((h) => {
    console.error('Hata:', h.message);
    process.exit(1);
  });
  process.exit(0);
}

const bd = await beden.saglik();
console.log(`Beden: ${bd.durum}${bd.mod ? ' (' + bd.mod + ')' : ''} | LLM: ${llm.baseUrl}`);
console.log(`${ayar.kullanici.asistanAdi} hazır. Çıkmak için /cik, sohbeti sıfırlamak için /sifirla\n`);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'sen> ' });
rl.prompt();
rl.on('line', async (satir) => {
  const m = satir.trim();
  if (!m) return rl.prompt();
  if (m === '/cik') return rl.close();
  if (m === '/sifirla') {
    asistan.sifirla('cli');
    console.log('sohbet sıfırlandı');
    return rl.prompt();
  }
  try {
    await sor(m);
  } catch (hata) {
    console.error('Hata:', hata.message);
  }
  rl.prompt();
});
rl.on('close', () => process.exit(0));
