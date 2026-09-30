// Asistanın kullanabildiği araçlar (OpenAI function-calling biçimi).
// Her araç: { tanim, calistir(args, ctx) → { metin, resim? } }
// ctx: { beden, llm, hafiza, gorevler, ayar, log }

function arac(name, description, properties = {}, required = [], calistir) {
  return {
    tanim: { type: 'function', function: { name, description, parameters: { type: 'object', properties, required } } },
    calistir,
  };
}

const kisa = (v, n = 4000) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v, null, 0);
  return s.length > n ? s.slice(0, n) + '…(kırpıldı)' : s;
};

export const ARACLAR = [
  arac('saat', 'Şu anki tarih ve saati verir.', {}, [], async () => ({
    metin: new Date().toLocaleString('tr-TR', { dateStyle: 'full', timeStyle: 'short' }),
  })),

  arac('pil_durumu', 'Telefonun pil yüzdesi, şarj durumu ve sıcaklığı.', {}, [], async (_a, { beden }) => ({
    metin: kisa(await beden.pil()),
  })),

  arac(
    'bak',
    'Telefonun kamerasıyla fotoğraf çeker ve görüntüyü sana gösterir. Ortamı görmek, bir şeyi tanımak, yazı okumak için kullan.',
    { kamera: { type: 'integer', description: '0 = arka kamera (varsayılan), 1 = ön kamera' } },
    [],
    async ({ kamera = 0 }, { beden }) => {
      const s = await beden.fotografCek(kamera);
      return { metin: `Fotoğraf çekildi (${s.ad}, ${Math.round(s.boyut / 1024)} KB). Görüntü bir sonraki mesajda.`, resim: s.base64 ? `data:${s.mime};base64,${s.base64}` : null };
    },
  ),

  arac('qr_oku', 'Kamerayla bir QR/barkod okur ve içeriğini döndürür.', { kamera: { type: 'integer' } }, [], async ({ kamera = 0 }, { beden }) => {
    const s = await beden.qrOku(kamera);
    return { metin: s.kodlar?.length ? `Okunan kodlar: ${s.kodlar.join(' | ')}` : 'Kod bulunamadı.' };
  }),

  arac(
    'dinle',
    'Mikrofonu açıp ortamdaki konuşmayı yazıya çevirir. Kullanıcı yanındaysa sesli soru sormak veya ortamı dinlemek için.',
    { sure: { type: 'integer', description: 'Kayıt süresi saniye (9router STT modunda), 1-60' } },
    [],
    async ({ sure = 6 }, ctx) => {
      const { beden, llm, ayar } = ctx;
      if (ayar.beyin.stt === 'android') {
        const s = await beden.dinle();
        return { metin: s.metin ? `Duyulan: "${s.metin}"` : 'Bir şey duyulmadı.' };
      }
      const k = await beden.sesKaydet(sure);
      const metin = await llm.yaziyaCevir(Buffer.from(k.base64, 'base64'), { mime: k.mime, dil: 'tr' });
      return { metin: metin ? `Duyulan: "${metin}"` : 'Bir şey duyulmadı.' };
    },
  ),

  arac(
    'soyle',
    'Metni telefonun hoparlöründen sesli söyler. Kullanıcı telefonun yanındaysa veya ortamdaki birine seslenmek gerekiyorsa kullan.',
    { metin: { type: 'string' } },
    ['metin'],
    async ({ metin }, ctx) => {
      const { beden, llm, ayar } = ctx;
      if (ayar.beyin.tts !== 'android') {
        try {
          const ses = await llm.seslendir(metin);
          await beden.sesCal({ base64: ses.toString('base64'), uzanti: 'mp3' });
        } catch {
          await beden.konus(metin, ayar.kullanici.dil);
        }
      } else {
        await beden.konus(metin, ayar.kullanici.dil);
      }
      return { metin: 'Söylendi.' };
    },
  ),

  arac('kisi_bul', 'Rehberde isme göre kişi arar, numarasını döndürür.', { ad: { type: 'string' } }, ['ad'], async ({ ad }, { beden }) => {
    const liste = await beden.kisiler();
    const s = ad.toLocaleLowerCase('tr');
    const es = (Array.isArray(liste) ? liste : []).filter((k) => (k.name || '').toLocaleLowerCase('tr').includes(s)).slice(0, 10);
    return { metin: es.length ? kisa(es) : `"${ad}" rehberde bulunamadı.` };
  }),

  arac(
    'telefon_ara',
    'Telefonun hücresel hattından bir numarayı çevirir. DİKKAT: Bu modda sen görüşmeyi duyamaz/konuşamazsın; sadece hattı açarsın. Konuşmalı görev için gorev_olustur kullan.',
    { numara: { type: 'string', description: 'Uluslararası biçim tercih edilir: +90555...' } },
    ['numara'],
    async ({ numara }, { beden }) => ({ metin: kisa(await beden.ara(numara)) }),
  ),

  arac('sms_gonder', 'SMS gönderir.', { numara: { type: 'string' }, metin: { type: 'string' } }, ['numara', 'metin'], async ({ numara, metin }, { beden }) => ({
    metin: kisa(await beden.smsGonder(numara, metin)),
  })),

  arac('sms_oku', 'Gelen kutusundaki son SMS\'leri listeler.', { limit: { type: 'integer' } }, [], async ({ limit = 10 }, { beden }) => ({
    metin: kisa(await beden.smsListe(limit)),
  })),

  arac('arama_kayitlari', 'Son arama kayıtlarını listeler.', { limit: { type: 'integer' } }, [], async ({ limit = 10 }, { beden }) => ({
    metin: kisa(await beden.aramaKayitlari(limit)),
  })),

  arac('konum', 'Telefonun yaklaşık konumunu verir.', {}, [], async (_a, { beden }) => ({ metin: kisa(await beden.konum()) })),

  arac('bildirim_gonder', 'Telefon ekranına bildirim düşürür.', { baslik: { type: 'string' }, icerik: { type: 'string' } }, ['icerik'], async ({ baslik = 'Asistan', icerik }, { beden }) => ({
    metin: kisa(await beden.bildirim(baslik, icerik)),
  })),

  arac(
    'hatirla',
    'Kalıcı hafızaya kısa bir not yazar (kullanıcı tercihleri, önemli bilgiler, kişiler, sonuçlar). Gelecek sohbetlerde de hatırlanır.',
    { metin: { type: 'string' }, etiket: { type: 'string', description: 'not | kisi | tercih | sonuc' } },
    ['metin'],
    async ({ metin, etiket = 'not' }, { hafiza }) => ({ metin: `Kaydedildi: ${hafiza.hatirla(metin, etiket)}` }),
  ),

  arac('hafiza_ara', 'Kalıcı hafızada kelimeyle arama yapar.', { sorgu: { type: 'string' } }, ['sorgu'], async ({ sorgu }, { hafiza }) => {
    const s = hafiza.ara(sorgu);
    return { metin: s.length ? s.join('\n') : 'Hafızada eşleşme yok.' };
  }),

  arac(
    'cebi_planla',
    'Kullanıcı bir işi bizzat yaparken adım adım yardım istediğinde (ör. arabanın yağını değiştirme, saç örme, belge inceleme, tamir) Cebimonun kalıcı oturumuna bağlam/risk ve görev tahtası oluştur. Telefon araması görevinde kullanma.',
    { talimat: { type: 'string', description: 'Yapılacak işin kullanıcının kendi cümlesiyle tarifi' } },
    ['talimat'],
    async ({ talimat }, { cebimon }) => {
      if (!cebimon) throw new Error('Cebimon oturumu kullanılamıyor');
      const oturum = cebimon.planla(talimat);
      return { metin: `Cebimon görev tahtasını oluşturdu: ${oturum.ortam} ortamı, ${oturum.risk} risk. İlk adım: ${oturum.adimlar[0]?.metin}. Kamera ve mikrofonla adımları doğrulayabiliriz.` };
    },
  ),

  arac(
    'cebi_planla',
    'Kullanıcı kendi yapacağı uygulamalı bir iş için adım adım yardım istediğinde (ör. araba, kişisel bakım, iş belgesi veya tamir) Cebimonun kalıcı görev tahtasına bağlam ve risk içeren adımlar oluştur. Telefon görüşmesi isteklerinde kullanma.',
    { talimat: { type: 'string', description: 'Yapılacak işi kullanıcının kendi cümlesiyle anlat' } },
    ['talimat'],
    async ({ talimat }, { cebimon }) => {
      if (!cebimon) throw new Error('Cebimon oturumu kullanılamıyor');
      const oturum = cebimon.planla(talimat);
      return { metin: `Cebimon görev tahtasını oluşturdu: ${oturum.ortam} ortamı, ${oturum.risk} risk. İlk adım: ${oturum.adimlar[0]?.metin}. Kamera ve mikrofonla adımları doğrulayabiliriz.` };
    },
  ),

  arac(
    'gorev_olustur',
    'Kullanıcı adına bir telefon görüşmesi görevi planlar: kimin aranacağı, amaç, konuşma noktaları ve sınırlar çıkarılır; görev panelde onaya düşer. Kullanıcı "X\'i ara ve ... konuş" dediğinde bunu kullan.',
    { talimat: { type: 'string', description: 'Kullanıcının tam talimatı, isim/numara ve bağlam dahil' } },
    ['talimat'],
    async ({ talimat }, { gorevler }) => {
      const g = await gorevler.olustur(talimat, { kaynak: 'sohbet' });
      return { metin: `Görev oluşturuldu #${g.id}: "${g.baslik}". Aranacak: ${g.kisi?.ad || '?'} (${g.kisi?.numara || 'numara yok'}). Durum: ${g.durum}. Kullanıcı paneldeki "Görüşmeyi başlat" ile onaylayınca arama yapılır.` };
    },
  ),
];

export const ARAC_TANIMLARI = ARACLAR.map((a) => a.tanim);

export function aracBul(ad) {
  return ARACLAR.find((a) => a.tanim.function.name === ad);
}
