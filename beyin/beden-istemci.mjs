// Beyin → Beden HTTP istemcisi.

export class BedenHatasi extends Error {
  constructor(mesaj, durum) {
    super(mesaj);
    this.durum = durum;
  }
}

export class BedenIstemci {
  constructor({ url, token, zamanAsimi = 90_000 }) {
    this.url = (url || 'http://127.0.0.1:20130').replace(/\/+$/, '');
    this.token = token;
    this.zamanAsimi = zamanAsimi;
  }

  async _istek(yontem, yol, govde) {
    let yanit;
    try {
      yanit = await fetch(this.url + yol, {
        method: yontem,
        headers: { Authorization: `Bearer ${this.token}`, ...(govde ? { 'Content-Type': 'application/json' } : {}) },
        body: govde ? JSON.stringify(govde) : undefined,
        signal: AbortSignal.timeout(this.zamanAsimi),
      });
    } catch (hata) {
      throw new BedenHatasi(`Bedene ulaşılamadı (${this.url}): ${hata.message}`, 0);
    }
    const veri = await yanit.json().catch(() => ({}));
    if (!yanit.ok || veri.tamam === false) throw new BedenHatasi(veri.hata || `beden ${yanit.status}`, yanit.status);
    return veri.sonuc ?? veri;
  }

  get(yol) {
    return this._istek('GET', yol);
  }

  post(yol, govde = {}) {
    return this._istek('POST', yol, govde);
  }

  async saglik() {
    try {
      const y = await fetch(this.url + '/saglik', { signal: AbortSignal.timeout(3000) });
      return await y.json();
    } catch (hata) {
      return { durum: 'ulasilamiyor', hata: hata.message };
    }
  }

  // Kısayollar
  pil() { return this.get('/pil'); }
  yetenekler() { return this.get('/yetenekler'); }
  fotografCek(kamera = 0) { return this.post('/kamera/cek', { kamera }); }
  qrOku(kamera = 0) { return this.post('/kamera/qr', { kamera }); }
  sesKaydet(sure = 5, format) { return this.post('/mikrofon/kaydet', { sure, format }); }
  dinle() { return this.post('/mikrofon/dinle'); }
  konus(metin, dil) { return this.post('/konus', { metin, dil }); }
  sesCal({ dosya, base64, uzanti }) { return this.post('/ses/cal', { dosya, base64, uzanti }); }
  sesDurdur() { return this.post('/ses/durdur'); }
  ara(numara) { return this.post('/telefon/ara', { numara }); }
  aramaKayitlari(limit = 20) { return this.get(`/telefon/kayitlar?limit=${limit}`); }
  smsGonder(numara, metin) { return this.post('/sms/gonder', { numara, metin }); }
  smsListe(limit = 20) { return this.get(`/sms/liste?limit=${limit}`); }
  kisiler() { return this.get('/kisiler'); }
  konum() { return this.get('/konum'); }
  bildirim(baslik, icerik) { return this.post('/bildirim', { baslik, icerik }); }
  panoOku() { return this.get('/pano'); }
  panoYaz(metin) { return this.post('/pano', { metin }); }
}
