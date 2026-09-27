// Sahte cihaz: Termux dışında (dizüstü, CI, sandbox) geliştirme ve test için.
// TermuxCihaz ile aynı arayüzü sunar, gerçek donanıma dokunmaz.

import fs from 'node:fs';

// 1x1 kırmızı PNG — sahte "fotoğraf"
const SAHTE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function sessizWav(saniye = 1, hz = 16000) {
  const ornek = saniye * hz;
  const veri = Buffer.alloc(ornek * 2);
  const b = Buffer.alloc(44);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + veri.length, 4);
  b.write('WAVE', 8);
  b.write('fmt ', 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(hz, 24);
  b.writeUInt32LE(hz * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(veri.length, 40);
  return Buffer.concat([b, veri]);
}

export class SahteCihaz {
  constructor({ veriDizini } = {}) {
    this.veriDizini = veriDizini;
    this.mod = 'mock';
    this.olaylar = []; // testlerde neyin çağrıldığını doğrulamak için
    this.pano = '';
  }

  _kaydet(tip, veri) {
    this.olaylar.push({ tip, veri, zaman: Date.now() });
  }

  yetenekler() {
    return { mod: 'mock', ffmpeg: false, qrOkuyucu: true, androidStt: true };
  }

  async pil() {
    return { health: 'GOOD', percentage: 87, plugged: 'PLUGGED_AC', status: 'CHARGING', temperature: 31.2 };
  }

  async wifi() {
    return { ssid: 'SahteAg', ip: '192.168.1.42', rssi: -55 };
  }

  async kameraBilgi() {
    return [{ id: '0', facing: 'back' }, { id: '1', facing: 'front' }];
  }

  async fotografCek({ kamera = 0, dosya }) {
    fs.writeFileSync(dosya, SAHTE_PNG);
    this._kaydet('fotograf', { kamera, dosya });
    return { dosya, kucultuldu: false, sahte: true };
  }

  async qrOku(dosya) {
    this._kaydet('qr', { dosya });
    return { kodlar: ['https://ornek.com/sahte-qr'] };
  }

  async sesKaydet({ dosya, sure = 5 }) {
    fs.writeFileSync(dosya.replace(/\.m4a$/, '.wav'), sessizWav(1));
    const wavDosya = dosya.replace(/\.m4a$/, '.wav');
    this._kaydet('kayit', { dosya: wavDosya, sure });
    return { dosya: wavDosya, sure, mime: 'audio/wav', sahte: true };
  }

  async sesDonustur(kaynak, hedef) {
    fs.copyFileSync(kaynak, hedef);
    return { dosya: hedef };
  }

  async konusmayiYaziyaCevir() {
    this._kaydet('stt', {});
    return { metin: 'sahte cihazdan merhaba' };
  }

  async konus({ metin, dil = 'tr-TR' }) {
    this._kaydet('konus', { metin, dil });
    return { soylendi: true, sahte: true };
  }

  async ttsMotorlari() {
    return [{ name: 'com.google.android.tts', default: true }];
  }

  async sesCal(dosya) {
    this._kaydet('sesCal', { dosya });
    return { ham: 'Now Playing: ' + dosya };
  }

  async sesDurdur() {
    return { ham: 'Stopped' };
  }

  async ara(numara) {
    this._kaydet('ara', { numara });
    return { arandi: numara, sahte: true };
  }

  async telefonBilgi() {
    return { network_operator_name: 'SahteCell', sim_state: 'ready', phone_type: 'gsm' };
  }

  async aramaKayitlari(limit = 20) {
    return [{ name: 'Ahmet Yılmaz', phone_number: '+905551112233', type: 'OUTGOING', duration: '01:12', date: '2026-09-27 10:00' }].slice(0, limit);
  }

  async smsGonder({ numara, metin }) {
    this._kaydet('sms', { numara, metin });
    return { gonderildi: numara, sahte: true };
  }

  async smsListe() {
    return [{ number: '+905551112233', body: 'Yarın görüşürüz', received: '2026-09-27 09:30' }];
  }

  async kisiler() {
    return [
      { name: 'Ahmet Yılmaz', number: '+90 555 111 22 33' },
      { name: 'Ayşe Demir', number: '+90 555 444 55 66' },
    ];
  }

  async konum() {
    return { latitude: 41.0082, longitude: 28.9784, accuracy: 25, provider: 'network' };
  }

  async bildirim({ baslik, icerik }) {
    this._kaydet('bildirim', { baslik, icerik });
    return { gonderildi: true, sahte: true };
  }

  async titret(ms = 300) {
    return { titredi: ms };
  }

  async panoOku() {
    return { metin: this.pano };
  }

  async panoYaz(metin) {
    this.pano = metin;
    return { yazildi: true };
  }

  async fener(acik) {
    return { fener: acik ? 'acik' : 'kapali' };
  }

  async kabuk(komut) {
    this._kaydet('kabuk', { komut });
    return { cikti: `(sahte) ${komut}` };
  }
}
