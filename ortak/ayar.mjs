// Ortak ayar yönetimi: ~/.asistan/config.json + ortam değişkenleri.
// Hem beden (Termux) hem beyin (proot veya Termux) bu modülü kullanır;
// iki taraf aynı ASISTAN_HOME dizinini görmelidir (bkz. docs/kurulum.md).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

export const ASISTAN_HOME = process.env.ASISTAN_HOME || path.join(os.homedir(), '.asistan');
export const VERI_DIZINI = path.join(ASISTAN_HOME, 'veri');
export const LOG_DIZINI = path.join(ASISTAN_HOME, 'log');
export const GOREV_DIZINI = path.join(ASISTAN_HOME, 'gorevler');
export const SOHBET_DIZINI = path.join(ASISTAN_HOME, 'sohbet');
export const AYAR_DOSYASI = path.join(ASISTAN_HOME, 'config.json');
export const HAFIZA_DOSYASI = path.join(ASISTAN_HOME, 'hafiza.md');

export const VARSAYILAN_AYAR = {
  kullanici: {
    ad: '',            // Asistanın temsil ettiği kişi
    asistanAdi: 'Cebi',
    dil: 'tr-TR',
    cihaz: 'Xiaomi Redmi Note 8 (Termux)',
  },
  beden: {
    host: '127.0.0.1',
    port: 20130,
    mod: 'otomatik',   // otomatik | termux | mock
    fotografGenislik: 1280, // ffmpeg varsa fotoğraflar bu genişliğe küçültülür (LLM'e gönderim için)
    izinler: {
      kamera: true,
      mikrofon: true,
      konusma: true,   // TTS / hoparlör
      bildirim: true,
      pano: true,
      telefon: false,  // termux-telephony-call
      sms: false,
      konum: false,
      kisiler: false,
      kabuk: false,    // keyfi shell komutu — çok dikkatli aç
    },
  },
  beyin: {
    host: '0.0.0.0',
    port: 20131,
    bedenUrl: 'http://127.0.0.1:20130',
    llm: {
      baseUrl: 'http://127.0.0.1:20128/v1',
      apiKey: '',
      model: '',
      sicaklik: 0.4,
      sttModel: 'whisper-1',
      ttsModel: 'tts-1',
      ttsVoice: 'alloy',
    },
    stt: 'android',    // android | 9router
    tts: 'android',    // android | 9router
    maksArac: 8,       // bir yanıt için en fazla araç turu
    hafizaLimiti: 6000 // sistem mesajına eklenen hafıza karakter sınırı
  },
  arama: {
    varsayilanMod: 'tarayici', // tarayici | hucresel | voip
    aiOlduguSoylensin: true,   // görüşmenin başında "dijital asistan" olduğunu söyle
    maksSure: 15 * 60,         // saniye
  },
};

function nesneMi(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

export function derinBirlestir(hedef, kaynak) {
  const sonuc = { ...hedef };
  for (const [k, v] of Object.entries(kaynak || {})) {
    sonuc[k] = nesneMi(v) && nesneMi(hedef?.[k]) ? derinBirlestir(hedef[k], v) : v;
  }
  return sonuc;
}

export function dizinleriHazirla() {
  for (const d of [ASISTAN_HOME, VERI_DIZINI, LOG_DIZINI, GOREV_DIZINI, SOHBET_DIZINI]) {
    fs.mkdirSync(d, { recursive: true, mode: 0o700 });
  }
}

function ortamUygula(ayar) {
  const e = process.env;
  const a = structuredClone(ayar);
  if (e.KULLANICI_ADI) a.kullanici.ad = e.KULLANICI_ADI;
  if (e.ASISTAN_ADI) a.kullanici.asistanAdi = e.ASISTAN_ADI;
  if (e.CIHAZ_ADI) a.kullanici.cihaz = e.CIHAZ_ADI;

  if (e.BEDEN_HOST) a.beden.host = e.BEDEN_HOST;
  if (e.BEDEN_PORT) a.beden.port = Number(e.BEDEN_PORT);
  if (e.BEDEN_MOD) a.beden.mod = e.BEDEN_MOD;

  if (e.BEYIN_HOST) a.beyin.host = e.BEYIN_HOST;
  if (e.BEYIN_PORT) a.beyin.port = Number(e.BEYIN_PORT);
  if (e.BEDEN_URL) a.beyin.bedenUrl = e.BEDEN_URL;
  if (e.LLM_BASE_URL) a.beyin.llm.baseUrl = e.LLM_BASE_URL;
  if (e.LLM_API_KEY) a.beyin.llm.apiKey = e.LLM_API_KEY;
  if (e.LLM_MODEL) a.beyin.llm.model = e.LLM_MODEL;
  if (e.STT_MODEL) a.beyin.llm.sttModel = e.STT_MODEL;
  if (e.TTS_MODEL) a.beyin.llm.ttsModel = e.TTS_MODEL;
  if (e.TTS_VOICE) a.beyin.llm.ttsVoice = e.TTS_VOICE;
  if (e.STT_SAGLAYICI) a.beyin.stt = e.STT_SAGLAYICI;
  if (e.TTS_SAGLAYICI) a.beyin.tts = e.TTS_SAGLAYICI;
  return a;
}

/** Ayarları yükler; dosya yoksa varsayılanları yazar. */
export function ayarYukle() {
  dizinleriHazirla();
  let dosyadan = {};
  if (fs.existsSync(AYAR_DOSYASI)) {
    try {
      dosyadan = JSON.parse(fs.readFileSync(AYAR_DOSYASI, 'utf8'));
    } catch (hata) {
      console.error(`[ayar] ${AYAR_DOSYASI} okunamadı: ${hata.message} — varsayılanlar kullanılıyor`);
    }
  } else {
    fs.writeFileSync(AYAR_DOSYASI, JSON.stringify(VARSAYILAN_AYAR, null, 2) + '\n', { mode: 0o600 });
  }
  return ortamUygula(derinBirlestir(VARSAYILAN_AYAR, dosyadan));
}

export function ayarKaydet(ayar) {
  dizinleriHazirla();
  fs.writeFileSync(AYAR_DOSYASI, JSON.stringify(ayar, null, 2) + '\n', { mode: 0o600 });
}

/**
 * Bileşenler arası paylaşılan gizli anahtar. Ortam değişkeni (örn. BEDEN_TOKEN)
 * yoksa ~/.asistan/<ad>.token dosyasından okunur; o da yoksa üretilip yazılır.
 */
export function tokenAl(ad) {
  const ortamAdi = `${ad.toUpperCase()}_TOKEN`;
  if (process.env[ortamAdi]) return process.env[ortamAdi];
  dizinleriHazirla();
  const dosya = path.join(ASISTAN_HOME, `${ad}.token`);
  if (fs.existsSync(dosya)) return fs.readFileSync(dosya, 'utf8').trim();
  const token = crypto.randomBytes(24).toString('hex');
  fs.writeFileSync(dosya, token + '\n', { mode: 0o600 });
  return token;
}

export function simdi() {
  return new Date().toISOString();
}

/** Basit zaman damgalı logger; hem konsola hem dosyaya yazar. */
export function logOlustur(bilesen) {
  dizinleriHazirla();
  const dosya = path.join(LOG_DIZINI, `${bilesen}.log`);
  const yaz = (seviye, ...parcalar) => {
    const satir = `${simdi()} [${bilesen}] ${seviye} ${parcalar
      .map((p) => (typeof p === 'string' ? p : JSON.stringify(p)))
      .join(' ')}`;
    (seviye === 'HATA' ? console.error : console.log)(satir);
    try {
      fs.appendFileSync(dosya, satir + '\n');
    } catch {
      /* log dizini yazılamıyorsa sessiz geç */
    }
  };
  return {
    bilgi: (...p) => yaz('BILGI', ...p),
    uyari: (...p) => yaz('UYARI', ...p),
    hata: (...p) => yaz('HATA', ...p),
  };
}
