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
  oturum: null, gecmis: [], gunluk: [], sonEvrim: null,
};

const RISK_ESLEME = new Map([
  ['dusuk', 'dusuk'], ['düşük', 'dusuk'], ['low', 'dusuk'],
  ['orta', 'orta'], ['medium', 'orta'], ['moderate', 'orta'],
  ['yuksek', 'yuksek'], ['yüksek', 'yuksek'], ['high', 'yuksek'],
]);

function riskDuzelt(deger, bilinmiyor = 'yuksek') {
  const s = String(deger ?? '').normalize('NFKC').trim().toLowerCase().replace(/\s+risk$/, '');
  return RISK_ESLEME.get(s) || bilinmiyor;
}

function yuksekRiskSozcukleri(metin) {
  const ham = String(metin || '').normalize('NFKC');
  const turkce = ham.toLocaleLowerCase('tr-TR');
  const genel = ham.toLowerCase().replace(/\u0307/g, '');
  const kalip = /elektrik|yüksek volt|gaz kaça|yangın|yanık|kimyasal|ilaç|tıbbi|sağlık müdahale|ciddi yaralanma|ağır yaralanma|aracı kaldır|arabayı kaldır|kriko|fren|airbag|basınçlı|çatı|yüksekte|testere|matkapla kes|electric|high voltage|gas leak|\bfire\b|\bburn\b|chemical|medication|\bmedicine\b|\bmedical\b|health intervention|serious injur|car jack|vehicle lift|\bbrake\b|\broof\b|high altitude|chainsaw|power saw|drill.*cut/;
  return kalip.test(turkce) || kalip.test(genel);
}

function riskEnYuksek(...riskler) {
  const sira = { dusuk: 0, orta: 1, yuksek: 2 };
  return riskler.map((r) => riskDuzelt(r)).sort((a, b) => sira[b] - sira[a])[0] || 'yuksek';
}


export class Cebimon {
  constructor({ dosya = path.join(ASISTAN_HOME, 'cebimon.json'), ad } = {}) {
    this.dosya = dosya;
    fs.mkdirSync(path.dirname(dosya), { recursive: true, mode: 0o700 });
    this.veri = this._oku();
    if (ad && this.veri.ad !== ad) { this.veri.ad = ad; this.kaydet(); }
  }
  _oku() {
    if (!fs.existsSync(this.dosya)) return structuredClone(VARSAYILAN);
    try {
      const kayit = JSON.parse(fs.readFileSync(this.dosya, 'utf8'));
      return { ...structuredClone(VARSAYILAN), ...kayit, guven: { ...VARSAYILAN.guven, ...(kayit.guven || {}) }, gecmis: Array.isArray(kayit.gecmis) ? kayit.gecmis : [] };
    } catch (hata) {
      // Bozuk dosyanın üstüne varsayılanları yazıp geçmişi yok etme; kurtarma kopyasını koru.
      const yedek = `${this.dosya}.bozuk-${Date.now()}`;
      try { fs.renameSync(this.dosya, yedek); } catch {}
      return { ...structuredClone(VARSAYILAN), kurtarmaDosyasi: yedek, kurtarmaHatasi: hata.message };
    }
  }
  kaydet() {
    const gecici = `${this.dosya}.${process.pid}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(gecici, JSON.stringify(this.veri, null, 2), { mode: 0o600 });
    fs.renameSync(gecici, this.dosya);
    try { fs.chmodSync(this.dosya, 0o600); } catch {}
    return this.veri;
  }
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
  oturumBaslat({ ortam = 'belirsiz', amac = '', risk } = {}) {
    if (this.veri.oturum) {
      this.veri.gecmis ||= [];
      this.veri.gecmis.push({ ...structuredClone(this.veri.oturum), bitis: new Date().toISOString(), basarili: false, ozet: 'Yeni oturum başlatıldığı için arşivlendi.' });
      this.veri.gecmis = this.veri.gecmis.slice(-50);
    }
    const normalRisk = risk === undefined ? 'orta' : riskDuzelt(risk);
    const riskSeviyesi = yuksekRiskSozcukleri(amac) ? 'yuksek' : normalRisk;
    this.veri.oturum = { id: `ot-${Date.now().toString(36)}`, baslangic: new Date().toISOString(), ortam: String(ortam).slice(0, 80), amac: String(amac).slice(0, 3000), risk: riskSeviyesi, adimlar: [], guven: 0.5 };
    this.veri.mod = 'dusunuyor'; this.kaydet(); return this.veri.oturum;
  }
  planla(talimat = '') {
    talimat = String(talimat || '').slice(0, 3000);
    const t = talimat.toLowerCase();
    let ortam = 'genel';
    let risk = 'orta';
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
    if (yuksekRiskSozcukleri(t)) risk = 'yuksek';
    const ot = this.oturumBaslat({ ortam, amac: talimat, risk });
    ot.adimlar = adimlar.map((a, i) => ({ id: `adim-${i + 1}`, ...a, incelemeler: [] }));
    this.kaydet();
    return ot;
  }
  async planlaAkilli(talimat = '', llm) {
    talimat = String(talimat || '').slice(0, 3000);
    const oturum = this.planla(talimat); // LLM kullanılamazsa güvenli yerel şablon yedeği
    if (!llm?.jsonSohbet) return oturum;
    try {
      const plan = await llm.jsonSohbet([
        { role: 'system', content: `Sen güvenlik odaklı Türkçe bir iş planlayıcısısın. Talimatı 3-6 küçük ve gözlenebilir adıma çevir. Ortam ve riski bağlama göre çıkar. Bilinmeyen teknik ayrıntıyı uydurma. Elektrik, gaz, kimyasal, ilaç/sağlık, araç kaldırma, fren, yüksekte çalışma veya ciddi yaralanma ihtimalinde riski yuksek seç ve güvenli duruş/uzman desteğini belirt. Dış işlem yapma. Sadece JSON döndür: {"baslik":"kısa başlık","ortam":"kısa ortam","risk":"dusuk|orta|yuksek","adimlar":[{"metin":"kısa adım","aciklama":"ne yapılacak","guvenlik":"uyarı veya boş metin"}]}` },
        { role: 'user', content: String(talimat).slice(0, 3000) },
      ]);
      if (!Array.isArray(plan.adimlar) || plan.adimlar.length < 3 || plan.adimlar.length > 8) throw new Error('plan 3-8 geçerli adım içermeli');
      const risk = yuksekRiskSozcukleri(talimat) || yuksekRiskSozcukleri(plan.adimlar.map((a) => `${a.metin || ''} ${a.aciklama || ''} ${a.guvenlik || ''}`).join(' '))
        ? 'yuksek' : riskEnYuksek(oturum.risk, riskDuzelt(plan.risk, oturum.risk));
      oturum.baslik = String(plan.baslik || talimat).slice(0, 120);
      oturum.ortam = String(plan.ortam || oturum.ortam).slice(0, 80);
      oturum.risk = risk;
      oturum.planKaynak = 'llm';
      oturum.adimlar = plan.adimlar.map((a, i) => ({
        id: `adim-${i + 1}`, metin: String(a.metin || a.baslik || `Adım ${i + 1}`).slice(0, 240),
        aciklama: String(a.aciklama || '').slice(0, 1000), guvenlik: String(a.guvenlik || '').slice(0, 500),
        durum: i === 0 ? 'aktif' : 'bekliyor', incelemeler: [],
      }));
      this.kaydet();
    } catch (hata) {
      oturum.planKaynak = 'sablon';
      oturum.planUyarisi = `LLM planı kullanılamadı: ${hata.message}`.slice(0, 300);
      if (yuksekRiskSozcukleri(talimat)) oturum.risk = 'yuksek';
      this.kaydet();
    }
    return oturum;
  }

  async adimDegerlendir({ llm, gorsel, ses, mime = 'audio/webm' } = {}) {
    const oturum = this.veri.oturum;
    if (!oturum) throw Object.assign(new Error('aktif Cebimon oturumu yok'), { kod: 409 });
    if (oturum.bekleyenOnay) throw Object.assign(new Error('adım kullanıcı onayı bekliyor'), { kod: 409 });
    if (typeof gorsel !== 'string' || gorsel.length > 2_000_000 || !gorsel.match(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/)) throw Object.assign(new Error('geçerli kamera görüntüsü gerekli veya görüntü çok büyük'), { kod: 400 });
    mime = String(mime).split(';', 1)[0].toLowerCase();
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
    const guven = typeof sonuc.guven === 'number' && Number.isFinite(sonuc.guven) ? Math.max(0, Math.min(1, sonuc.guven)) : 0;
    const tamamlandi = sonuc.tamamlandi === true && sonuc.guvenli === true && guven >= 0.72;
    const inceleme = {
      zaman: new Date().toISOString(), duyulan: String(duyulan || '').slice(0, 2000),
      gozlem: String(sonuc.gozlem || '').slice(0, 1000),
      geriBildirim: String(sonuc.geri_bildirim || '').slice(0, 1000), guven,
      guvenli: sonuc.guvenli === true, tamamlandi,
    };
    adim.incelemeler ||= [];
    adim.incelemeler.push(inceleme);
    let onayGerekli = false;
    if (tamamlandi && riskDuzelt(oturum.risk) === 'yuksek') {
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
    metin = String(metin || '').trim().slice(0, 240);
    if (!metin) throw Object.assign(new Error('adım metni gerekli'), { kod: 400 });
    // Doğrulama/onay durumlarını yalnızca kanıt akışı değiştirebilir; genel API ile tamamlandı işaretlenemez.
    if (!['aktif', 'bekliyor'].includes(durum)) throw Object.assign(new Error('geçersiz adım durumu'), { kod: 400 });
    if (!this.veri.oturum) this.oturumBaslat();
    const mevcut = this.veri.oturum.adimlar.find((a) => a.metin === metin);
    if (mevcut) mevcut.durum = durum;
    else this.veri.oturum.adimlar.push({ metin, durum });
    this.kaydet(); return this.veri.oturum;
  }
  oturumBitir({ basarili = true, ozet = '' } = {}) {
    if (!this.veri.oturum) return null;
    const biten = { ...structuredClone(this.veri.oturum), bitis: new Date().toISOString(), basarili, ozet };
    this.veri.gecmis ||= []; this.veri.gecmis.push(biten); this.veri.gecmis = this.veri.gecmis.slice(-50);
    this.olay(ozet || `${biten.ortam} oturumu ${basarili ? 'tamamlandı' : 'yarım kaldı'}`, basarili ? 'basari' : 'uyari');
    this.veri.oturum = null; this.veri.mod = 'nobette';
    if (basarili) this.veri.guven.genel = Math.min(100, this.veri.guven.genel + 1);
    this.kaydet(); return biten;
  }
  temizle() {
    const ad = this.veri.ad;
    this.veri = structuredClone(VARSAYILAN);
    if (ad) this.veri.ad = ad;
    this.kaydet();
    // Kişisel veri silme isteği, bozuk dosya kurtarma kopyalarını ve yarım yazımları da kapsar.
    const temel = path.basename(this.dosya);
    for (const adDosya of fs.readdirSync(path.dirname(this.dosya))) {
      if (adDosya.startsWith(`${temel}.bozuk-`) || (adDosya.startsWith(`${temel}.`) && adDosya.endsWith('.tmp'))) {
        try { fs.unlinkSync(path.join(path.dirname(this.dosya), adDosya)); } catch (hata) { if (hata.code !== 'ENOENT') throw hata; }
      }
    }
    return this.veri;
  }
}
