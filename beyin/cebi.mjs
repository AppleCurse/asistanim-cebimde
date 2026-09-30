// Cebimon'un teknik olmayan, kalıcı kimliği ve bağlam oturumu.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ASISTAN_HOME } from '../ortak/ayar.mjs';

const VARSAYILAN = {
  ad: 'Cebimon', sinif: 'kivilcim', seviye: 1,
  mod: 'hazir', guven: { genel: 50, gorusme: 50, cihaz: 50, mahremiyet: 80 },
  yetenekler: ['sohbet', 'pil', 'kamera'], oneriler: ['sesli_yardim'],
  oturum: null, gunluk: [], sonEvrim: null,
};

export class Cebimon {
  constructor({ dosya = path.join(ASISTAN_HOME, 'cebimon.json') } = {}) {
    this.dosya = dosya;
    fs.mkdirSync(path.dirname(dosya), { recursive: true });
    this.veri = this._oku();
  }
  _oku() {
    try { return { ...VARSAYILAN, ...JSON.parse(fs.readFileSync(this.dosya, 'utf8')) }; }
    catch { return structuredClone(VARSAYILAN); }
  }
  kaydet() { fs.writeFileSync(this.dosya, JSON.stringify(this.veri, null, 2), { mode: 0o600 }); return this.veri; }
  durum({ pil, beden, maliyet } = {}) {
    return {
      ...this.veri,
      cihaz: { pil: pil?.percentage ?? null, sicaklik: pil?.temperature ?? null, beden: beden?.durum || 'bilinmiyor' },
      bugun: { olay: maliyet?.olay || 0, token: maliyet?.token || 0, maliyetTL: maliyet?.maliyetTL || 0, notlar: this.veri.gunluk.slice(-5) },
    };
  }
  olay(metin, tip = 'bilgi') {
    this.veri.gunluk.push({ id: crypto.randomUUID(), zaman: new Date().toISOString(), tip, metin });
    this.veri.gunluk = this.veri.gunluk.slice(-100);
    this.kaydet();
  }
  oturumBaslat({ ortam = 'belirsiz', amac = '', risk = 'dusuk' } = {}) {
    this.veri.oturum = { id: `ot-${Date.now().toString(36)}`, baslangic: new Date().toISOString(), ortam, amac, risk, adimlar: [], guven: 0.5 };
    this.veri.mod = 'dusunuyor'; this.kaydet(); return this.veri.oturum;
  }
  adim(metin, durum = 'bekliyor') {
    if (!this.veri.oturum) this.oturumBaslat();
    const mevcut = this.veri.oturum.adimlar.find((a) => a.metin === metin);
    if (mevcut) mevcut.durum = durum;
    else this.veri.oturum.adimlar.push({ metin, durum });
    this.kaydet(); return this.veri.oturum;
  }
  oturumBitir({ basarili = true, ozet = '' } = {}) {
    if (!this.veri.oturum) return null;
    const biten = this.veri.oturum; biten.bitis = new Date().toISOString(); biten.basarili = basarili; biten.ozet = ozet;
    this.olay(ozet || `${biten.ortam} oturumu ${basarili ? 'tamamlandı' : 'yarım kaldı'}`, basarili ? 'basari' : 'uyari');
    this.veri.oturum = null; this.veri.mod = 'nobette';
    if (basarili) this.veri.guven.genel = Math.min(100, this.veri.guven.genel + 1);
    this.kaydet(); return biten;
  }
}
