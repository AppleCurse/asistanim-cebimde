// Kalıcı hafıza: ~/.asistan/hafiza.md — sade, insan tarafından da düzenlenebilir.

import fs from 'node:fs';
import { HAFIZA_DOSYASI } from '../ortak/ayar.mjs';

export class Hafiza {
  constructor(dosya = HAFIZA_DOSYASI) {
    this.dosya = dosya;
  }

  hatirla(metin, etiket = 'not') {
    const satir = `- [${new Date().toISOString().slice(0, 16).replace('T', ' ')}] (${etiket}) ${String(metin).replace(/\s+/g, ' ').trim()}\n`;
    fs.appendFileSync(this.dosya, satir);
    return satir.trim();
  }

  oku(limit = 6000) {
    if (!fs.existsSync(this.dosya)) return '';
    const icerik = fs.readFileSync(this.dosya, 'utf8');
    return icerik.length > limit ? '…\n' + icerik.slice(-limit) : icerik;
  }

  ara(sorgu, limit = 20) {
    const s = sorgu.toLocaleLowerCase('tr');
    return this.oku(200_000)
      .split('\n')
      .filter((satir) => satir.toLocaleLowerCase('tr').includes(s))
      .slice(-limit);
  }
}
