// Ağır/telefon işlerini seri çalıştırır. Meşgulse en fazla üç deneme yapar.
export class GorevKuyrugu {
  constructor({ tekrar = 3, bekleme = 250, log } = {}) {
    this.tekrar = Math.max(1, tekrar);
    this.bekleme = bekleme;
    this.log = log;
    this.sira = [];
    this.calisti = false;
  }

  ekle(is, { ad = 'görev' } = {}) {
    return new Promise((resolve, reject) => {
      this.sira.push({ is, ad, resolve, reject });
      this._calistir();
    });
  }

  async _calistir() {
    if (this.calisti) return;
    this.calisti = true;
    while (this.sira.length) {
      const item = this.sira.shift();
      let hata;
      for (let deneme = 1; deneme <= this.tekrar; deneme++) {
        try { item.resolve(await item.is({ deneme, toplam: this.tekrar })); hata = null; break; }
        catch (e) {
          hata = e;
          this.log?.uyari(`${item.ad}: deneme ${deneme}/${this.tekrar} başarısız: ${e.message}`);
          if (deneme < this.tekrar) await new Promise((r) => setTimeout(r, this.bekleme * deneme));
        }
      }
      if (hata) item.reject(hata);
    }
    this.calisti = false;
  }

  get uzunluk() { return this.sira.length; }
}
