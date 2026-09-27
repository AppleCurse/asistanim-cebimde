// Gerçek cihaz: Termux:API komutlarını sarmalar.
// Gereksinim: Termux + Termux:API uygulaması (F-Droid) + `pkg install termux-api ffmpeg`
// Her metot JSON döndürür; termux-* komutlarının çıktısı JSON değilse { ham: "..." } döner.

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

export function komutBul(ad) {
  const yollar = (process.env.PATH || '').split(path.delimiter);
  for (const y of yollar) {
    const tam = path.join(y, ad);
    try {
      fs.accessSync(tam, fs.constants.X_OK);
      return tam;
    } catch {
      /* devam */
    }
  }
  return null;
}

export function termuxMu() {
  return Boolean(komutBul('termux-battery-status'));
}

const uyu = (ms) => new Promise((r) => setTimeout(r, ms));

async function calistir(cmd, args = [], { zamanAsimi = 30_000 } = {}) {
  try {
    const { stdout } = await execFileP(cmd, args, {
      timeout: zamanAsimi,
      maxBuffer: 32 * 1024 * 1024,
      encoding: 'utf8',
    });
    return stdout;
  } catch (hata) {
    const mesaj = (hata.stderr || hata.message || '').toString().trim();
    throw new Error(`${cmd} başarısız: ${mesaj || 'bilinmeyen hata'}`);
  }
}

function jsonCoz(metin) {
  const t = (metin || '').trim();
  if (!t) return {};
  try {
    return JSON.parse(t);
  } catch {
    return { ham: t };
  }
}

export class TermuxCihaz {
  constructor({ veriDizini, fotografGenislik = 1280 }) {
    this.veriDizini = veriDizini;
    this.fotografGenislik = fotografGenislik;
    this.ffmpeg = komutBul('ffmpeg');
    this.zbar = komutBul('zbarimg');
    this.mod = 'termux';
  }

  yetenekler() {
    return {
      mod: this.mod,
      ffmpeg: Boolean(this.ffmpeg),
      qrOkuyucu: Boolean(this.zbar),
      androidStt: Boolean(komutBul('termux-speech-to-text')),
    };
  }

  // --- Enerji / sistem ---
  async pil() {
    return jsonCoz(await calistir('termux-battery-status'));
  }

  async wifi() {
    return jsonCoz(await calistir('termux-wifi-connectioninfo'));
  }

  // --- Göz ---
  async kameraBilgi() {
    return jsonCoz(await calistir('termux-camera-info'));
  }

  async fotografCek({ kamera = 0, dosya }) {
    const ham = dosya.replace(/\.jpg$/i, '') + '.ham.jpg';
    await calistir('termux-camera-photo', ['-c', String(kamera), ham], { zamanAsimi: 45_000 });
    if (this.ffmpeg && this.fotografGenislik > 0) {
      try {
        await calistir(this.ffmpeg, [
          '-y', '-loglevel', 'error', '-i', ham,
          '-vf', `scale='min(${this.fotografGenislik},iw)':-2`,
          '-q:v', '4', dosya,
        ]);
        fs.rmSync(ham, { force: true });
        return { dosya, kucultuldu: true };
      } catch {
        /* küçültme başarısızsa ham dosyayı kullan */
      }
    }
    fs.renameSync(ham, dosya);
    return { dosya, kucultuldu: false };
  }

  async qrOku(dosya) {
    if (!this.zbar) throw new Error('zbarimg yok (pkg install zbar)');
    const cikti = await calistir(this.zbar, ['-q', '--raw', dosya]).catch(() => '');
    const satirlar = cikti.split('\n').map((s) => s.trim()).filter(Boolean);
    return { kodlar: satirlar };
  }

  // --- Kulak ---
  async sesKaydet({ dosya, sure = 5 }) {
    // termux-microphone-record hemen döner, kayıt arka planda -l süresi kadar sürer.
    await calistir('termux-microphone-record', ['-f', dosya, '-l', String(sure), '-e', 'aac']);
    await uyu((sure + 0.8) * 1000);
    await calistir('termux-microphone-record', ['-q']).catch(() => {});
    if (!fs.existsSync(dosya)) throw new Error('kayıt dosyası oluşmadı');
    return { dosya, sure, mime: 'audio/mp4' };
  }

  async sesDonustur(kaynak, hedef) {
    if (!this.ffmpeg) throw new Error('ffmpeg yok (pkg install ffmpeg)');
    await calistir(this.ffmpeg, ['-y', '-loglevel', 'error', '-i', kaynak, hedef]);
    return { dosya: hedef };
  }

  /** Android'in kendi konuşma tanımasını kullanır (ücretsiz, çevrimiçi). Konuşma bitince döner. */
  async konusmayiYaziyaCevir() {
    const cikti = await calistir('termux-speech-to-text', [], { zamanAsimi: 40_000 });
    return { metin: cikti.trim() };
  }

  // --- Ağız ---
  async konus({ metin, dil = 'tr-TR', hiz = 1.0, ton = 1.0 }) {
    const args = ['-l', dil.split('-')[0], '-r', String(hiz), '-p', String(ton)];
    if (dil.includes('-')) args.push('-n', dil.split('-')[1]);
    await calistir('termux-tts-speak', [...args, metin], { zamanAsimi: 120_000 });
    return { soylendi: true };
  }

  async ttsMotorlari() {
    return jsonCoz(await calistir('termux-tts-engines'));
  }

  async sesCal(dosya) {
    return { ham: (await calistir('termux-media-player', ['play', dosya])).trim() };
  }

  async sesDurdur() {
    return { ham: (await calistir('termux-media-player', ['stop'])).trim() };
  }

  // --- El (telefon / SMS) ---
  async ara(numara) {
    await calistir('termux-telephony-call', [numara]);
    return { arandi: numara };
  }

  async telefonBilgi() {
    return jsonCoz(await calistir('termux-telephony-deviceinfo'));
  }

  async aramaKayitlari(limit = 20) {
    return jsonCoz(await calistir('termux-call-log', ['-l', String(limit)]));
  }

  async smsGonder({ numara, metin }) {
    await calistir('termux-sms-send', ['-n', numara, metin]);
    return { gonderildi: numara };
  }

  async smsListe({ limit = 20, tur = 'inbox' } = {}) {
    return jsonCoz(await calistir('termux-sms-list', ['-l', String(limit), '-t', tur]));
  }

  async kisiler() {
    return jsonCoz(await calistir('termux-contact-list'));
  }

  // --- Diğer duyular ---
  async konum(saglayici = 'network') {
    return jsonCoz(await calistir('termux-location', ['-p', saglayici, '-r', 'once'], { zamanAsimi: 60_000 }));
  }

  async bildirim({ baslik, icerik, id }) {
    const args = ['-t', baslik, '-c', icerik];
    if (id) args.push('-i', String(id));
    await calistir('termux-notification', args);
    return { gonderildi: true };
  }

  async titret(ms = 300) {
    await calistir('termux-vibrate', ['-d', String(ms)]);
    return { titredi: ms };
  }

  async panoOku() {
    return { metin: await calistir('termux-clipboard-get') };
  }

  async panoYaz(metin) {
    await calistir('termux-clipboard-set', [metin]);
    return { yazildi: true };
  }

  async fener(acik) {
    await calistir('termux-torch', [acik ? 'on' : 'off']);
    return { fener: acik ? 'acik' : 'kapali' };
  }

  async kabuk(komut) {
    const cikti = await calistir('sh', ['-c', komut], { zamanAsimi: 60_000 });
    return { cikti };
  }
}
