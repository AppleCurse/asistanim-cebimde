// SIP / VOIP TAŞIYICISI — Baresip üzerinden gerçek telefon aramaları.
// Baresip proot Ubuntu içinde çalışır, Termux üzerindeki beyin ctrl_tcp (port 4444)
// ve /tmp/baresip_{in,out}.fifo üzerinden çift yönlü ses ve komutları yönetir.

import net from 'node:net';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { Gorusme } from './motor.mjs';

const ROOTFS_TMP = '/data/data/com.termux/files/usr/var/lib/proot-distro/containers/ubuntu/rootfs/tmp';
const BASE_TMP = fs.existsSync(ROOTFS_TMP) ? ROOTFS_TMP : '/tmp';
const IN_FIFO_YOLU = `${BASE_TMP}/mic.raw`;
const OUT_FIFO_YOLU = `${BASE_TMP}/spk.raw`;

/** DJB Netstring kodlama: <uzunluk>:<veri>, */
export function netstringKodla(nesne) {
  const json = JSON.stringify(nesne);
  const len = Buffer.byteLength(json, 'utf8');
  return `${len}:${json},`;
}

/** Netstring ve JSON akış ayrıştırıcı */
export class NetstringAyristirici {
  constructor(onMesaj) {
    this.onMesaj = onMesaj;
    this.tampon = '';
  }

  besle(chunk) {
    this.tampon += chunk.toString('utf8');
    while (this.tampon.length > 0) {
      // 1. Netstring formatı: <uzunluk>:<json>,
      const ikiNokta = this.tampon.indexOf(':');
      if (ikiNokta !== -1) {
        const lenStr = this.tampon.slice(0, ikiNokta).trim();
        const len = parseInt(lenStr, 10);
        if (!isNaN(len) && len > 0 && len < 100000) {
          if (this.tampon.length >= ikiNokta + 1 + len + 1) {
            const veri = this.tampon.slice(ikiNokta + 1, ikiNokta + 1 + len);
            this.tampon = this.tampon.slice(ikiNokta + 1 + len + 1);
            try {
              this.onMesaj(JSON.parse(veri));
            } catch {}
            continue;
          } else {
            break; // paketin kalan kısmı henüz gelmedi
          }
        }
      }

      // 2. Satır bazlı / düz JSON formatı
      const satirSonu = this.tampon.indexOf('\n');
      if (satirSonu !== -1) {
        const satir = this.tampon.slice(0, satirSonu).trim();
        this.tampon = this.tampon.slice(satirSonu + 1);
        if (satir.startsWith('{') && satir.endsWith('}')) {
          try {
            this.onMesaj(JSON.parse(satir));
          } catch {}
        }
        continue;
      }
      break;
    }
  }
}

/** 8000Hz 16-bit Mono PCM -> 44 byte standart WAV sarmalayici */
export function pcmToWav(pcm, sampleRate = 8000, channels = 1) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** RMS Enerji hesaplama (VAD icin) */
export function hesaplaRMS(pcm) {
  if (pcm.length < 2) return 0;
  let toplam = 0;
  const ornekSayisi = Math.floor(pcm.length / 2);
  for (let i = 0; i < pcm.length; i += 2) {
    const val = pcm.readInt16LE(i);
    toplam += val * val;
  }
  return Math.sqrt(toplam / ornekSayisi);
}

const FFMPEG_KOMUTU = fs.existsSync('/data/data/com.termux/files/usr/bin/ffmpeg')
  ? '/data/data/com.termux/files/usr/bin/ffmpeg'
  : 'ffmpeg';

/** Herhangi bir ses buffer'ini (MP3/WAV) ffmpeg ile 8000Hz 16-bit Mono RAW PCM'e donusturur */
export function pcmyeDonustur(sesBuffer) {
  return new Promise((coz, reddet) => {
    const ff = spawn(FFMPEG_KOMUTU, [
      '-i', 'pipe:0',
      '-f', 's16le',
      '-ar', '8000',
      '-ac', '1',
      'pipe:1'
    ], { stdio: ['pipe', 'pipe', 'ignore'] });

    const parcalar = [];
    ff.stdout.on('data', (d) => parcalar.push(d));
    ff.on('close', (kod) => {
      if (kod === 0) coz(Buffer.concat(parcalar));
      else reddet(new Error(`ffmpeg dönüştürme hatası: kod ${kod}`));
    });
    ff.on('error', reddet);
    ff.stdin.end(sesBuffer);
  });
}

export class SipKoprusu {
  constructor({ llm, gorevler, ayar, log, port = 4444, host = '127.0.0.1' }) {
    this.llm = llm;
    this.gorevler = gorevler;
    this.ayar = ayar;
    this.log = log;
    this.port = port;
    this.host = host;
    this.soket = null;
    this.aktifGorusme = null;
    this.calanSesPcm = null;
    this.calanSesKonumu = 0;
    this.sesCalmaDurduruldu = false;
    this.besleyiciZamanlayici = null;
    this.inFifoFd = null;
    this.outFifoFd = null;
    this.outFifoStream = null;
    this.cagriAktif = false;
    this._fifoKilitleriniAc();
  }

  _fifoKilitleriniAc() {
    try {
      if (!this.inFifoFd && fs.existsSync(IN_FIFO_YOLU)) {
        this.inFifoFd = fs.openSync(IN_FIFO_YOLU, fs.constants.O_RDWR | fs.constants.O_NONBLOCK);
      }
    } catch (e) {
      this.log?.uyari?.(`inFifo açılamadı: ${e.message}`);
    }
    try {
      if (!this.outFifoFd && fs.existsSync(OUT_FIFO_YOLU)) {
        this.outFifoFd = fs.openSync(OUT_FIFO_YOLU, fs.constants.O_RDWR);
      }
    } catch (e) {
      this.log?.uyari?.(`outFifo açılamadı: ${e.message}`);
    }
  }

  _baglan() {
    return new Promise((coz, reddet) => {
      const s = net.connect(this.port, this.host, () => {
        this.log.bilgi(`Baresip ctrl_tcp bağlandı (${this.host}:${this.port})`);
        coz(s);
      });
      s.on('error', reddet);
    });
  }

  formatlaNumara(num) {
    let n = String(num || '').replace(/\D+/g, '');
    if (n.startsWith('00')) return n;
    if (n.startsWith('90')) return '00' + n;
    if (n.startsWith('0')) return '0090' + n.slice(1);
    if (n.length === 10) return '0090' + n;
    return '00' + n;
  }

  /** Baresip mikrofon girişine (mic.raw) kesintisiz, duvar saatine kilitli S16LE PCM basan besleyici */
  _sesBesleyiciBaslat() {
    this._fifoKilitleriniAc();
    if (!this.inFifoFd) {
      this.log.uyari(`mic.raw açılamadı: kilit yok`);
      return;
    }

    const sessizPaket = Buffer.alloc(320); // 20ms @ 8000Hz 16-bit mono = 320 byte
    const baslangicZamani = Date.now();
    let gonderilenPaketSayisi = 0;

    if (this.besleyiciZamanlayici) clearInterval(this.besleyiciZamanlayici);
    this.besleyiciZamanlayici = setInterval(() => {
      if (!this.inFifoFd) return;
      const gecenMs = Date.now() - baslangicZamani;
      const olmasiGereken = Math.floor(gecenMs / 20);
      const fark = Math.min(5, Math.max(0, olmasiGereken - gonderilenPaketSayisi));
      if (fark <= 0) return;

      for (let i = 0; i < fark; i++) {
        let paket = sessizPaket;
        if (this.calanSesPcm && !this.sesCalmaDurduruldu) {
          const kalan = this.calanSesPcm.length - this.calanSesKonumu;
          if (kalan > 0) {
            const boy = Math.min(320, kalan);
            paket = this.calanSesPcm.slice(this.calanSesKonumu, this.calanSesKonumu + boy);
            this.calanSesKonumu += boy;
            if (boy < 320) {
              paket = Buffer.concat([paket, Buffer.alloc(320 - boy)]);
            }
          } else {
            this.calanSesPcm = null;
            this.calanSesKonumu = 0;
          }
        }
        try {
          fs.writeSync(this.inFifoFd, paket);
          gonderilenPaketSayisi++;
        } catch {
          break;
        }
      }
    }, 10);
  }

  /** Baresip hoparlör çıkışını (spk.raw) dinleyip VAD ve yankı kapısı ile karşı tarafın konuşmasını yakalar */
  _sesDinleyiciBaslat(gorusme, tasiyici) {
    this._fifoKilitleriniAc();
    if (!this.outFifoFd) {
      this.log.uyari(`spk.raw dinleyici başlatılamadı: kilit yok`);
      return;
    }

    let konusmaParcalari = [];
    let sessizlikAdimSayisi = 0;
    let tabanGurultu = 100;
    let sonSttZamani = 0;

    try {
      if (this.outFifoStream) {
        try { this.outFifoStream.destroy(); } catch {}
      }
      this.outFifoStream = fs.createReadStream(null, { fd: this.outFifoFd, autoClose: false, highWaterMark: 320 });
      this.outFifoStream.on('data', (chunk) => {
        // Yalnızca çağrı aktifken karşı tarafın sesini işle (çaldırma/ringback tonunu yok say)
        if (!this.cagriAktif) return;

        const rms = hesaplaRMS(chunk);
        const asistanKonusuyor = Boolean(this.calanSesPcm && !this.sesCalmaDurduruldu);

        // 1. YANKI KAPISI & BARGE-IN:
        if (asistanKonusuyor) {
          konusmaParcalari = [];
          if (rms > 1800) {
            this.log.bilgi(`[Barge-in] Yüksek sesli kesme algılandı (RMS ${Math.round(rms)}), asistan susturuluyor`);
            tasiyici.sesDurdur();
          }
          return;
        }

        // Görüşme motoru yanıt hazırlıyorsa yeni kayıt alma
        if (gorusme.durum === 'dusununuyor') {
          konusmaParcalari = [];
          return;
        }

        // 2. ADAPTİF GÜRÜLTÜ TABANI:
        if (rms < 300) {
          tabanGurultu = tabanGurultu * 0.95 + rms * 0.05;
        }
        const dinamikEsik = Math.max(400, tabanGurultu * 2.5);

        // 3. VAD (Ses Aktivite Algılama):
        if (rms > dinamikEsik) {
          konusmaParcalari.push(chunk);
          sessizlikAdimSayisi = 0;
        } else if (konusmaParcalari.length > 0) {
          konusmaParcalari.push(chunk);
          sessizlikAdimSayisi++;
          // 40 x 20ms = ~800ms sessizlik -> karşı tarafın cümlesi bitti
          if (sessizlikAdimSayisi >= 40) {
            const pcmVeri = Buffer.concat(konusmaParcalari);
            konusmaParcalari = [];
            sessizlikAdimSayisi = 0;
            const simdi = Date.now();
            // En az 0.8 saniye (12800 bayt) ve iki STT isteği arasında en az 1.5s boşluk
            if (pcmVeri.length >= 12800 && simdi - sonSttZamani > 1500) {
              sonSttZamani = simdi;
              const wav = pcmToWav(pcmVeri);
              gorusme.sesGeldi(wav, 'audio/wav').catch((e) => this.log.hata(`STT hatası: ${e.message}`));
            }
          }
        }
      });
      this.outFifoStream.on('error', (e) => this.log.uyari(`spk.raw okuma: ${e.message}`));
    } catch (e) {
      this.log.uyari(`spk.raw dinleyici başlatılamadı: ${e.message}`);
    }
  }

  async ara({ gorev, numara }) {
    const hedefNumara = this.formatlaNumara(numara || gorev?.kisi?.numara);
    if (!hedefNumara) throw new Error('Geçersiz telefon numarası');

    this.log.bilgi(`VoIP dış arama başlatılıyor: ${hedefNumara} (Görev #${gorev?.id || 'serbest'})`);

    const soket = await this._baglan();
    this.soket = soket;

    const komutGonder = (k) => {
      if (this.soket && !this.soket.destroyed) {
        this.soket.write(netstringKodla(k));
      }
    };

    const tasiyici = {
      metin: (rol, metin, sesGelecek) => {
        this.log.bilgi(`[${rol}]: ${metin}`);
      },
      sesCal: async (buffer) => {
        try {
          this.log.bilgi('TTS sesi dönüştürülüyor ve çalma kuyruğuna alınıyor...');
          const pcm = await pcmyeDonustur(buffer);
          this.calanSesPcm = pcm;
          this.calanSesKonumu = 0;
          this.sesCalmaDurduruldu = false;
        } catch (e) {
          this.log.hata(`TTS çalma hatası: ${e.message}`);
        }
      },
      sesDurdur: () => {
        this.log.bilgi('Barge-in: Asistan sesi kesildi');
        this.sesCalmaDurduruldu = true;
        this.calanSesPcm = null;
        this.calanSesKonumu = 0;
      },
      durum: (d) => {
        this.log.bilgi(`Arama durumu: ${JSON.stringify(d)}`);
      },
      bitti: (g, ek) => {
        this.log.bilgi(`Arama tamamlandı: ${ek.sebep} (süre: ${ek.sure}s)`);
        komutGonder({ command: 'hangup' });
        this._temizle();
      }
    };

    const gorusme = new Gorusme({
      llm: this.llm,
      gorevler: this.gorevler,
      gorev,
      ayar: this.ayar,
      tasiyici,
      log: this.log,
      mod: 'sunucu-ses'
    });
    this.aktifGorusme = gorusme;

    let baslatildi = false;
    const gorusmeyiBaslat = (sebep) => {
      if (baslatildi) return;
      baslatildi = true;
      this.cagriAktif = true;
      this.log.bilgi(`📞 ÇAĞRI AKTİF (${sebep})! Aspasia söze başlıyor.`);
      gorusme.baslat().catch((e) => this.log.hata(`Görüşme başlatma: ${e.message}`));
    };

    // FIFO'ları Baresip açılışı için hemen hazır tut (besleyici sessiz paket basarak saati besler)
    this._sesBesleyiciBaslat();
    this._sesDinleyiciBaslat(gorusme, tasiyici);

    // Baresip olaylarını dinle (Yalnızca çağrı açılınca söze başla)
    const ayristirici = new NetstringAyristirici((msg) => {
      this.log.bilgi(`[Baresip Olay] ${JSON.stringify(msg)}`);
      const tip = msg.type || msg.event;
      if (tip === 'CALL_ESTABLISHED' || tip === 'CALL_ANSWERED') {
        gorusmeyiBaslat(`SIP ${tip}`);
      } else if (tip === 'CALL_CLOSED') {
        this.log.bilgi('📴 ÇAĞRI SONLANDI (Karşı taraf veya santral kapattı).');
        gorusme.bitir('karsi-kapatti').catch(() => {});
      }
    });

    soket.on('data', (d) => {
      this.log.bilgi(`[Baresip Ham Çıktı] (${d.length} bayt): ${d.toString('utf8').trim()}`);
      ayristirici.besle(d);
    });
    soket.on('close', () => this._temizle());

    // Aramayı çevir
    komutGonder({ command: 'dial', params: hedefNumara });
    return { basarili: true, numara: hedefNumara };
  }

  _temizle() {
    this.cagriAktif = false;
    if (this.besleyiciZamanlayici) {
      clearInterval(this.besleyiciZamanlayici);
      this.besleyiciZamanlayici = null;
    }
    if (this.outFifoStream) {
      try { this.outFifoStream.destroy(); } catch {}
      this.outFifoStream = null;
    }
    if (this.soket) {
      try { this.soket.destroy(); } catch {}
      this.soket = null;
    }
    this.calanSesPcm = null;
    this.sesCalmaDurduruldu = true;
    this.aktifGorusme = null;
  }
}
