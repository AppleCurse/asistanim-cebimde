// GÖRÜŞME MOTORU — taşıyıcıdan bağımsız sesli konuşma döngüsü:
//   ses/metin geldi → (STT) → LLM (görev brifingiyle) → (TTS) → taşıyıcıya gönder
// Taşıyıcı (tasiyici) arayüzü:
//   metin(rol, metin, sesGelecek)   transkript satırı
//   sesCal(buffer, mime)            sunucu tarafı TTS çıktısı
//   sesDurdur()                     barge-in: çalan sesi kes
//   durum(nesne)                    "düşünüyor", "konuşuyor" vb.
//   bitti(gorev, sebep)             görüşme kapandı
// Aynı motor ileride Twilio/SIP taşıyıcılarıyla da kullanılacak (docs/telefon-gorusmesi.md).

const BITIS_ETIKETI = '[GORUSME_BITTI]';

/** Whisper tarzı STT halüsinasyonları: sessiz/bozuk ses parçalarında uydurulan kalıplar.
 *  Bu listeden biri geçen transkript "anlaşılan söz" sayılmaz, atılır (halüsinasyon filtresi). */
export const HALUSINASYON_KALIPLARI = [
  /altyaz/i,                                     // "altyazı", "altyazılar hazırlanmıştır"
  /\bsubtitles?\b/i,
  /izlediğiniz için/i,                            // "videoyu izlediğiniz için teşekkürler"
  /videoyu izlediğiniz/i,
  /kanalıma hoş geldiniz/i,
  /abone ol(mayı|manızı) unut/i,                  // "abone olmayı unutmayın"
  /beğen(mey|i)p (ve )?abone/i,
  /\b(like and subscribe|please subscribe|subscribe to (my )?channel)\b/i,
  /\bthanks for (watching|listening)\b/i,
  /\b(subtitles|captions) (by|provided|brought to you)/i,
  /(amara\.org|rev\.com|sonicbids)/i,
  /\[(müzik|şarkı|music|alkış|gülüşme|gülüşmeler|ses efekti|nefes)\]/i,   // [Müzik], [Applause]
  /\((müzik|şarkı|music|alkış|gülüşme|gülüşmeler|ses efekti|nefes|sessizlik)\)/i,
  /^[♪♫♬\s]+$/,                                  // sadece nota
  /♪/,
  /https?:\/\/|www\./i,
  /şarkı sözleri/i,
];

/** STT çıktısı halüsinasyon mu? (filtre: true → at) */
export function halusinasyonMu(metin) {
  const temiz = String(metin || '').normalize('NFKC').trim().toLocaleLowerCase('tr-TR');
  if (temiz.length < 2) return true;
  return HALUSINASYON_KALIPLARI.some((kalip) => kalip.test(temiz));
}

export class Gorusme {
  constructor({ llm, gorevler, gorev = null, ayar, tasiyici, log, mod = 'tarayici-ses' }) {
    this.llm = llm;
    this.gorevler = gorevler;
    this.gorev = gorev;
    this.ayar = ayar;
    this.tasiyici = tasiyici;
    this.log = log;
    this.mod = mod; // tarayici-ses: metin gider, istemci seslendirir | sunucu-ses: 9router STT/TTS
    this.mesajlar = [];
    this.transkript = [];
    this.aktif = false;
    this.kapandi = false; // bitir() bir kez kapanışı yapsın; hiç başlamayan çağrı da görevi kapatmalı
    this.nesil = 0;
    this.durum = null; // dusunuyor | dinliyor | konusuyor | bekliyor | kapaniyor | hata
    this.kuyruk = Promise.resolve();
    this.baslangic = null;
    this.zamanlayici = null;
  }

  _sistemMesaji() {
    if (this.gorev) return this.gorevler.aramaSistemMesaji(this.gorev);
    const a = this.ayar;
    return `Sen ${a.kullanici.asistanAdi} adlı kişisel asistansın; ${a.kullanici.ad || 'kullanıcın'} ile SESLİ sohbet ediyorsun.
Yanıtların sesli okunacak: kısa (1-2 cümle), doğal, Türkçe; madde işareti, emoji veya markdown kullanma.
Kullanıcı vedalaşırsa kısa bir veda yaz ve en sona ${BITIS_ETIKETI} ekle.`;
  }

  _kaydet(rol, metin) {
    const satir = { rol, metin, zaman: new Date().toISOString() };
    this.transkript.push(satir);
    if (this.gorev) {
      this.gorev.transkript = this.transkript;
      try {
        this.gorevler.guncelle(this.gorev.id, { transkript: this.transkript });
      } catch (hata) {
        this.log?.uyari(`transkript kaydedilemedi: ${hata.message}`);
      }
    }
  }

  /** Durumu hem gorusme.durum'da tut hem taşıyıcıya bildir (taşımalar `gorusme.durum` okur). */
  _durumVer(asama, ek = {}) {
    this.durum = asama;
    this.tasiyici.durum?.({ asama, ...ek });
  }

  async baslat() {
    if (this.aktif || this.kapandi) return;
    this.aktif = true;
    this.baslangic = Date.now();
    if (this.gorev) this.gorevler.guncelle(this.gorev.id, { durum: 'araniyor', mod: this.mod });
    const sure = (this.ayar.arama?.maksSure || 900) * 1000;
    this.zamanlayici = setTimeout(() => this.bitir('sure-doldu'), sure);

    const asistanAdi = this.ayar?.kullanici?.asistanAdi || 'Aspasia';
    const sahip = this.ayar?.kullanici?.ad ? `${this.ayar.kullanici.ad}'ın asistanı` : 'asistanınız';
    const acilis = this.gorev?.acilis || `Merhaba! Ben ${sahip} ${asistanAdi}, nasılsınız?`;
    this.mesajlar.push({ role: 'assistant', content: acilis });
    await this._soyle(acilis);
  }

  /** Karşı taraf metin olarak konuştu (tarayıcı STT'si veya sunucu STT sonrası). */
  kullaniciKonustu(metin) {
    const temiz = (metin || '').trim();
    if (!temiz || !this.aktif) return Promise.resolve();
    this.nesil++; // devam eden bir yanıt varsa eskisin
    this.tasiyici.sesDurdur?.();
    return this._sira(() => this._yanitUret(temiz));
  }

  /** Karşı taraftan ham ses geldi → STT → kullaniciKonustu */
  async sesGeldi(buffer, mime = 'audio/webm') {
    if (!this.aktif) {
      this.aktif = true;
      this.baslangic = this.baslangic || Date.now();
    }
    this._durumVer('dinliyor');
    let metin = '';
    try {
      metin = await this.llm.yaziyaCevir(buffer, { mime, dil: 'tr' });
    } catch (hata) {
      this.log?.uyari(`STT hatası: ${hata.message}`);
      this._durumVer('hata', { mesaj: `Ses yazıya çevrilemedi: ${hata.message}` });
      return;
    }
    if (!metin || halusinasyonMu(metin)) {
      this.log?.uyari(`STT halüsinasyonu filtrelendi (metin içeriği günlüğe yazılmadı; uzunluk: ${String(metin).length}).`);
      this._durumVer('bekliyor', { mesaj: 'Anlaşılır bir şey duyulmadı' });
      return;
    }
    await this.kullaniciKonustu(metin);
  }

  _sira(is) {
    this.kuyruk = this.kuyruk.then(is).catch((hata) => this.log?.hata(`görüşme adımı: ${hata.message}`));
    return this.kuyruk;
  }

  async _yanitUret(kullaniciMetni, { transkripteYazma = false } = {}) {
    if (!this.aktif) return;
    const benimNesil = this.nesil;
    if (!transkripteYazma) {
      this._kaydet('karsi', kullaniciMetni);
      this.tasiyici.metin?.('karsi', kullaniciMetni, false);
    }
    this.mesajlar.push({ role: 'user', content: kullaniciMetni });
    this._durumVer('dusunuyor');

    let icerik;
    try {
      const { mesaj } = await this.llm.sohbet([{ role: 'system', content: this._sistemMesaji() }, ...this.mesajlar.slice(-30)], { sicaklik: 0.5, maksToken: 300 });
      icerik = (mesaj.content || '').trim();
    } catch (hata) {
      this.log?.hata(`görüşme LLM hatası: ${hata.message}`);
      this.tasiyici.durum?.({ asama: 'hata', mesaj: hata.message });
      icerik = 'Bağlantımda kısa bir sorun oldu, tekrar eder misiniz?';
    }
    if (benimNesil !== this.nesil || !this.aktif) return; // kullanıcı araya girdi, bu yanıt bayat

    const bitiyor = icerik.includes(BITIS_ETIKETI);
    const temiz = icerik.replaceAll(BITIS_ETIKETI, '').trim();
    this.mesajlar.push({ role: 'assistant', content: icerik });
    if (temiz) await this._soyle(temiz);
    if (bitiyor) await this.bitir('asistan-kapatti');
  }

  async _soyle(metin) {
    this._kaydet('asistan', metin);
    const sunucuSesi = this.mod === 'sunucu-ses';
    this.tasiyici.metin?.('asistan', metin, sunucuSesi);
    if (!sunucuSesi) return;
    this._durumVer('konusuyor');
    try {
      const ses = await this.llm.seslendir(metin);
      await this.tasiyici.sesCal?.(ses, 'audio/mpeg');
    } catch (hata) {
      this.log?.uyari(`TTS hatası, metin olarak düşüldü: ${hata.message}`);
      this.tasiyici.metin?.('sistem', `(TTS yok: ${hata.message}) — istemci seslendirsin`, false);
      this.tasiyici.metin?.('asistan', metin, false);
    }
  }

  async bitir(sebep = 'kullanici-kapatti') {
    // DİKKAT: `aktif` kontrolü burada YOK — çağrı hiç başlamadıysa da (aranan açmadı,
    // meşgul, hat düşmedi) kapanış yapılmalı; yoksa görev 'araniyor'da sonsuza kadar takılır.
    if (this.kapandi) return this.gorev;
    this.kapandi = true;
    this.aktif = false;
    clearTimeout(this.zamanlayici);
    this._durumVer('kapaniyor', { sebep });
    let sonucGorev = this.gorev;
    if (this.gorev) {
      try {
        sonucGorev = await this.gorevler.ozetle({ ...this.gorev, transkript: this.transkript }, { sebep });
      } catch (hata) {
        this.log?.hata(`özet hatası: ${hata.message}`);
      }
    }
    const sure = Math.round((Date.now() - (this.baslangic || Date.now())) / 1000);
    this.tasiyici.bitti?.(sonucGorev, { sebep, sure, transkript: this.transkript });
    return sonucGorev;
  }
}
