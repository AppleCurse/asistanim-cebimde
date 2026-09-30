// GÖREV: "Şunu ara, şunu konuş" talimatını yapılandırılmış bir görüşme brifingine çevirir,
// görüşme kişiliğini (sistem mesajı) üretir ve sonunda transkriptten sonuç raporu çıkarır.
// Kayıt: ~/.asistan/gorevler/<id>.json

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { GOREV_DIZINI } from '../ortak/ayar.mjs';

export const GOREV_DURUMLARI = ['taslak', 'hazir', 'araniyor', 'tamamlandi', 'basarisiz', 'iptal'];

const BRIFING_ISTEMI = `Sen bir kişisel asistanın görev planlayıcısısın. Kullanıcının talimatını, telefonda yapılacak
bir görüşme için yapılandırılmış brifinge çevir. SADECE aşağıdaki şemada geçerli bir JSON döndür, başka hiçbir şey yazma:
{
  "baslik": "kısa başlık",
  "kisi": { "ad": "aranacak kişi/kurum adı veya null", "numara": "telefon numarası veya null", "iliski": "kullanıcıyla ilişkisi (müşteri, arkadaş, restoran...)" },
  "amac": "görüşmenin tek cümlelik amacı",
  "konusma_noktalari": ["sırayla söylenecek/sorulacak şeyler"],
  "kabul_edilebilir_sonuclar": ["kullanıcı için başarı sayılacak sonuçlar, esneklik payı"],
  "sinirlar": ["asla yapılmayacaklar: söz verme, ücret konuşma, kişisel bilgi paylaşma vb."],
  "ton": "kibar, kısa, samimi/profesyonel...",
  "acilis": "görüşmeyi açan ilk cümle (kullanıcının adı geçsin)",
  "basari_kriteri": "görüşmenin başarılı sayılması için gereken net koşul",
  "eksik_bilgi": ["görevi yapmak için kullanıcıya sorulması gereken şeyler; yoksa boş dizi"]
}`;

export class GorevYoneticisi {
  constructor({ llm, ayar, hafiza, log, dizin = GOREV_DIZINI }) {
    this.llm = llm;
    this.ayar = ayar;
    this.hafiza = hafiza;
    this.log = log;
    this.dizin = dizin;
    fs.mkdirSync(dizin, { recursive: true });
  }

  _yol(id) {
    return path.join(this.dizin, `${path.basename(id)}.json`);
  }

  kaydet(gorev) {
    gorev.guncellendi = new Date().toISOString();
    const yol = this._yol(gorev.id);
    // Atomik yaz: yarım kalmış JSON (güç kesilmesi vb.) görevi bozmasın
    const gecici = `${yol}.tmp`;
    fs.writeFileSync(gecici, JSON.stringify(gorev, null, 2));
    fs.renameSync(gecici, yol);
    return gorev;
  }

  /** Görev kaydını (brifing + transkript + sonuç) kalıcı olarak siler — gizlilik: kullanıcı kayıtları silebilmeli. */
  sil(id) {
    const yol = this._yol(id);
    if (!fs.existsSync(yol)) return false;
    fs.rmSync(yol);
    this.log?.bilgi(`görev kaydı silindi #${id} (transkript dahil)`);
    return true;
  }

  al(id) {
    const y = this._yol(id);
    if (!fs.existsSync(y)) return null;
    return JSON.parse(fs.readFileSync(y, 'utf8'));
  }

  listele() {
    return fs
      .readdirSync(this.dizin)
      .filter((d) => d.endsWith('.json'))
      .map((d) => JSON.parse(fs.readFileSync(path.join(this.dizin, d), 'utf8')))
      .sort((a, b) => (a.olusturuldu < b.olusturuldu ? 1 : -1));
  }

  guncelle(id, yama) {
    const g = this.al(id);
    if (!g) throw new Error(`görev yok: ${id}`);
    if (yama.durum && !GOREV_DURUMLARI.includes(yama.durum)) throw new Error(`geçersiz durum: ${yama.durum}`);
    return this.kaydet({ ...g, ...yama });
  }

  /** Serbest talimattan brifing üretir. */
  async olustur(talimat, { kaynak = 'panel', numara } = {}) {
    const kullanici = this.ayar.kullanici.ad || 'kullanıcı';
    const mesajlar = [
      { role: 'system', content: BRIFING_ISTEMI },
      { role: 'user', content: `Kullanıcının adı: ${kullanici}\nBugün: ${new Date().toLocaleString('tr-TR')}\n${numara ? `Numara: ${numara}\n` : ''}Talimat: ${talimat}` },
    ];
    let brifing;
    try {
      brifing = await this.llm.jsonSohbet(mesajlar);
    } catch (hata) {
      this.log?.uyari(`brifing üretilemedi, ham talimat kullanılacak: ${hata.message}`);
      brifing = { baslik: talimat.slice(0, 60), amac: talimat, konusma_noktalari: [talimat], kisi: { ad: null, numara: numara || null }, eksik_bilgi: [] };
    }
    if (numara && brifing.kisi) brifing.kisi.numara = numara;

    const gorev = {
      id: `${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
      olusturuldu: new Date().toISOString(),
      kaynak,
      talimat,
      durum: brifing.eksik_bilgi?.length ? 'taslak' : 'hazir',
      mod: this.ayar.arama.varsayilanMod,
      transkript: [],
      sonuc: null,
      ...brifing,
    };
    this.kaydet(gorev);
    this.log?.bilgi(`görev oluşturuldu #${gorev.id}: ${gorev.baslik}`);
    return gorev;
  }

  /** Görüşme sırasında asistanın kişiliği ve kuralları. */
  aramaSistemMesaji(gorev) {
    const a = this.ayar;
    const kullanici = a.kullanici.ad || 'kullanıcım';
    const liste = (d) => (Array.isArray(d) && d.length ? d.map((x) => `- ${x}`).join('\n') : '- (yok)');
    return `Sen ${a.kullanici.asistanAdi} adlı dijital asistansın ve şu anda ${kullanici} adına TELEFONDA konuşuyorsun.
Karşındaki kişi: ${gorev.kisi?.ad || 'bilinmiyor'} (${gorev.kisi?.iliski || 'ilişki belirsiz'}).
${a.arama.aiOlduguSoylensin ? 'Görüşmenin başında dijital asistan olduğunu açıkça söyle; sorulursa asla insan olduğunu iddia etme.' : 'Sorulursa dijital asistan olduğunu dürüstçe söyle.'}

GÖREVİN: ${gorev.amac}

KONUŞMA NOKTALARI (sırayla, doğal biçimde):
${liste(gorev.konusma_noktalari)}

KABUL EDİLEBİLİR SONUÇLAR:
${liste(gorev.kabul_edilebilir_sonuclar)}

SINIRLAR (asla aşma):
${liste(gorev.sinirlar)}
- ${kullanici} adına yetkin dışında söz verme; emin olmadığın konuda "bunu ${kullanici}'a ileteceğim" de.
- Kişisel/finansal bilgi paylaşma.

BAŞARI KRİTERİ: ${gorev.basari_kriteri || 'amaç net biçimde iletildi ve yanıt alındı'}

ÜSLUP: ${gorev.ton || 'kibar, kısa, doğal'}. Bu bir telefon görüşmesi: cümlelerin KISA olsun (en fazla 2 cümle), sesli okunacak şekilde yaz,
madde işareti/emoji/markdown KULLANMA. Karşı tarafı dinle, teyit et, sonra ilerle. Amaç tamamlanınca veya karşı taraf kapatmak isteyince
kibarca özetleyip vedalaş ve yanıtının EN SONUNA tek satırda [GORUSME_BITTI] yaz.`;
  }

  /** Transkriptten sonuç raporu üretir ve görevi kapatır. */
  async ozetle(gorev, { sebep = 'normal' } = {}) {
    const transkript = (gorev.transkript || []).map((t) => `${t.rol === 'asistan' ? 'ASİSTAN' : 'KARŞI TARAF'}: ${t.metin}`).join('\n');
    const mesajlar = [
      {
        role: 'system',
        content: `Bir telefon görüşmesinin transkriptini değerlendir. SADECE şu JSON'u döndür:
{"basarili": true/false, "ozet": "2-3 cümle: ne konuşuldu, ne sonuç çıktı", "kararlar": ["alınan somut kararlar"], "takip": ["kullanıcının yapması gerekenler"], "not": "dikkat çeken şey veya null"}`,
      },
      { role: 'user', content: `Görev amacı: ${gorev.amac}\nBaşarı kriteri: ${gorev.basari_kriteri}\nBitiş sebebi: ${sebep}\n\nTRANSKRİPT:\n${transkript || '(boş)'}` },
    ];
    let sonuc;
    try {
      sonuc = await this.llm.jsonSohbet(mesajlar);
    } catch (hata) {
      sonuc = { basarili: false, ozet: `Özet üretilemedi: ${hata.message}`, kararlar: [], takip: [], not: null };
    }
    sonuc.bitis = new Date().toISOString();
    sonuc.sebep = sebep;
    const durum = transkript ? (sonuc.basarili ? 'tamamlandi' : 'basarisiz') : 'iptal';
    const g = this.guncelle(gorev.id, { sonuc, durum });
    this.hafiza?.hatirla(`Görüşme #${g.id} (${g.kisi?.ad || '?'}): ${sonuc.ozet}`, 'sonuc');
    return g;
  }
}
