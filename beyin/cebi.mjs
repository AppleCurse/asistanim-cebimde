// Cebimon'un teknik olmayan, kalıcı kimliği ve bağlam oturumu.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { jsonAyikla } from './llm.mjs';
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
  planla(talimat = '') {
    const t = String(talimat).toLowerCase();
    let ortam = 'genel';
    let risk = 'dusuk';
    let adimlar = [
      { metin: 'Materyalleri ve çalışma alanını hazırla', durum: 'aktif' },
      { metin: 'Gerekli adımları belirle ve sırala', durum: 'bekliyor' },
      { metin: 'Uygulamayı yap ve kontrol et', durum: 'bekliyor' },
      { metin: 'Sonucu kaydet ve işlemi tamamla', durum: 'bekliyor' },
    ];
    if (/araba|araç|otomobil|yağ|motor/.test(t)) {
      ortam = 'otomobil';
      risk = 'orta';
      adimlar = [
        { metin: 'Güvenlik önlemlerini al ve motoru soğumaya bırak', durum: 'aktif' },
        { metin: 'Karter tapasını ve yağ filtresini konumlandır', durum: 'bekliyor' },
        { metin: 'Eski yağı güvenli bir kaba boşalt', durum: 'bekliyor' },
        { metin: 'Yeni yağ filtresini tak ve uygun yağı ekle', durum: 'bekliyor' },
      ];
    } else if (/saç|örgü|örm|tarama|makyaj/.test(t)) {
      ortam = 'kişisel bakım';
      risk = 'dusuk';
      adimlar = [
        { metin: 'Kamerayı saç hizasına al ve iyi ışık sağla', durum: 'aktif' },
        { metin: 'Saçı nazikçe tara ve bölümlere ayır', durum: 'bekliyor' },
        { metin: 'Örgüyü küçük adımlarla başlat', durum: 'bekliyor' },
        { metin: 'Örgünün eşit ve rahat olduğunu kontrol et', durum: 'bekliyor' },
      ];
    } else if (/belge|evrak|imza|doküman|incele/.test(t)) {
      ortam = 'belge';
      risk = 'orta';
      adimlar = [
        { metin: 'Belgeyi düz bir zemine koy ve kamerayı hizala', durum: 'aktif' },
        { metin: 'Metin ve önemli alanları tara', durum: 'bekliyor' },
        { metin: 'Kritik bilgileri doğrula ve not al', durum: 'bekliyor' },
        { metin: 'İnceleme özetini hazırla', durum: 'bekliyor' },
      ];
    } else if (/tamir|onar|bozuk|düzelt/.test(t)) {
      ortam = 'tamir';
      risk = 'orta';
      adimlar = [
        { metin: 'Sorunu kamerada doğrula; cihazı sökme', durum: 'aktif' },
        { metin: 'Güvenlik koşullarını ve güç durumunu kontrol et', durum: 'bekliyor' },
        { metin: 'Güvenli kontrolleri küçük adımlarla uygula', durum: 'bekliyor' },
        { metin: 'Sonucu ve çevre güvenliğini doğrula', durum: 'bekliyor' },
      ];
    }
    if (/elektrik|gaz kaça|yangın|kimyasal|ilaç|kriko|fren|airbag|yüksek volt/i.test(t)) risk = 'yuksek';
    const ot = this.oturumBaslat({ ortam, amac: talimat, risk });
    ot.adimlar = adimlar.map((a, i) => ({ id: `adim-${i + 1}`, ...a, incelemeler: [] }));
    this.kaydet();
    return ot;
  }
  async adimDegerlendir({ llm, gorsel, ses, mime = 'audio/webm' } = {}) {
    const oturum = this.veri.oturum;
    if (!oturum) throw Object.assign(new Error('aktif Cebimon oturumu yok'), { kod: 409 });
    if (oturum.bekleyenOnay) throw Object.assign(new Error('adım kullanıcı onayı bekliyor'), { kod: 409 });
    if (!gorsel?.match(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/)) throw Object.assign(new Error('kamera görüntüsü gerekli'), { kod: 400 });
    if (!ses || typeof ses !== 'string' || ses.length > 10_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(ses)) throw Object.assign(new Error('geçerli mikrofon kaydı gerekli'), { kod: 400 });
    if (!['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg'].includes(mime)) throw Object.assign(new Error('desteklenmeyen ses biçimi'), { kod: 400 });
    const sesBuffer = Buffer.from(ses, 'base64');
    if (!sesBuffer.length || sesBuffer.length > 7_000_000) throw Object.assign(new Error('ses kaydı geçersiz veya çok büyük'), { kod: 400 });
    const adim = oturum.adimlar.find((a) => a.durum === 'aktif');
    if (!adim) throw Object.assign(new Error('aktif görev adımı bulunamadı'), { kod: 409 });

    const duyulan = await llm.yaziyaCevir(sesBuffer, { mime, dil: 'tr' });
    const istem = [
      { role: 'system', content: `Sen kanıta dayalı ve güvenlik odaklı bir görev adımı doğrulayıcısısın. Kullanıcı görüntüsü ve söylediği cümle ile yalnızca aktif adımın gerçekleştiğini açıkça görüp duyabiliyorsan tamamlandı de. Niyet, yalnızca sözlü iddia veya yetersiz görüntü kanıt değildir. Tehlike fark edersen güvenli=false yap, adımı tamamlatma ve durmasını söyle. Sadece JSON döndür: {"tamamlandi":true|false,"guvenli":true|false,"guven":0.0,"gozlem":"kanıt","geri_bildirim":"kısa Türkçe yanıt","sonraki_adim":"talimat"}` },
      { role: 'user', content: [
        { type: 'text', text: `Görev: ${oturum.amac}\nOrtam: ${oturum.ortam}; risk: ${oturum.risk}\nAktif adım: ${adim.metin}\nKullanıcının söylediği: ${String(duyulan || '(anlaşılmadı)').slice(0, 2000)}` },
        { type: 'image_url', image_url: { url: gorsel } },
      ] },
    ];
    let sonuc;
    try {
      const { mesaj } = await llm.sohbet(istem, { maksToken: 450, sicaklik: 0.1 });
      sonuc = jsonAyikla(mesaj.content);
      if (!sonuc || typeof sonuc !== 'object' || Array.isArray(sonuc)) throw new Error('LLM sonucu nesne değil');
    } catch (hata) {
      throw Object.assign(new Error(`adım değerlendirilemedi: ${hata.message}`), { kod: 502 });
    }
    const guven = Math.max(0, Math.min(1, Number(sonuc.guven) || 0));
    const tamamlandi = Boolean(sonuc.tamamlandi && sonuc.guvenli !== false && guven >= 0.72);
    const inceleme = {
      zaman: new Date().toISOString(), duyulan: String(duyulan || '').slice(0, 2000),
      gozlem: String(sonuc.gozlem || '').slice(0, 1000),
      geriBildirim: String(sonuc.geri_bildirim || '').slice(0, 1000), guven,
      guvenli: sonuc.guvenli !== false, tamamlandi,
    };
    adim.incelemeler ||= [];
    adim.incelemeler.push(inceleme);
    let onayGerekli = false;
    if (tamamlandi && ['yuksek', 'yüksek'].includes(String(oturum.risk).toLocaleLowerCase('tr-TR'))) {
      adim.durum = 'onay_bekliyor';
      oturum.bekleyenOnay = true;
      onayGerekli = true;
    } else if (tamamlandi) {
      adim.durum = 'tamamlandi';
      const sonraki = oturum.adimlar[oturum.adimlar.indexOf(adim) + 1];
      if (sonraki) sonraki.durum = 'aktif';
      else oturum.tamamlandi = true;
    }
    this.veri.mod = onayGerekli ? 'supheli' : oturum.tamamlandi ? 'nobette' : 'hazir';
    this.kaydet();
    return { oturum, inceleme, adimTamamlandi: tamamlandi && !onayGerekli, onayGerekli, duyulan };
  }

  adimOnayla(onay) {
    const oturum = this.veri.oturum;
    if (!oturum?.bekleyenOnay) throw Object.assign(new Error('onay bekleyen adım yok'), { kod: 409 });
    const adim = oturum.adimlar.find((a) => a.durum === 'onay_bekliyor');
    if (!adim) throw Object.assign(new Error('onay bekleyen adım yok'), { kod: 409 });
    oturum.bekleyenOnay = false;
    adim.durum = onay ? 'tamamlandi' : 'aktif';
    if (onay) {
      const sonraki = oturum.adimlar[oturum.adimlar.indexOf(adim) + 1];
      if (sonraki) sonraki.durum = 'aktif';
      else oturum.tamamlandi = true;
    }
    this.veri.mod = 'hazir';
    return this.kaydet();
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
