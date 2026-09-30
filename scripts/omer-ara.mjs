// Ömer Bey'e sistem becerileri ve yetkileri brifingi veren otomatik arama başlatıcı
import fs from 'node:fs';
import path from 'node:path';
import { ASISTAN_HOME } from '../ortak/ayar.mjs';

const GOREV_DIZINI = path.join(ASISTAN_HOME, 'gorevler');
const id = 'omer-brifing-' + Date.now().toString(36);

const gorev = {
  id,
  olusturuldu: new Date().toISOString(),
  kaynak: 'panel',
  talimat: "Ömer Bey'i (05373351866) ara. Sistemin becerileri, yetkileri, neden var olduğu hakkında 1 dakikayı geçmeyen net bir brifing ver.",
  durum: 'hazir',
  mod: 'voip',
  transkript: [],
  sonuc: null,
  baslik: "Ömer Bey'e Sistem Becerileri ve Yetkileri Brifingi",
  amac: "Sistemin neden var olduğunu, yetkilerini, becerilerini ve sınırlarını 1 dakikayı aşmadan eksiksiz aktarmak.",
  ton: "Net, profesyonel, saygılı, kendinden emin ve abartısız",
  acilis: "Merhaba Ömer Bey! Ben Gümüş'ün yapay zekâ asistanı Aspasia. Sistemimizin yetkileri ve becerileri hakkında size 1 dakikayı geçmeyen kısa bir brifing vermek için aradım. Bu sistem, eski bir Android telefonu 7 gün 24 saat yaşayan kesintisiz bir kişisel asistana dönüştürüyor. Becerilerim arasında; şu an yaptığımız gibi bağımsız sesli telefon aramaları gerçekleştirmek, SMS yönetimi, kamera ile ortam ve belge analizi yaparak Cebimon üzerinden uygulamalı adımları doğrulamak ve planlama yapmak yer alıyor. Güvenlik ilkemiz gereği tüm kritik yetkiler kullanıcı onayına bağlıdır, abartılı vaatlerde bulunulmaz ve sınırların dışına çıkılmaz. Sistemle ilgili sormak istediğiniz bir detay var mı?",
  konusma_noktalari: [
    "Neden var olduğu: Eski bir Android telefonu 7/24 yaşayan kişisel asistana dönüştürmek.",
    "Beceriler: Sesli VoIP/GSM arama, SMS okuma/gönderme, kamera ile görme ve ortam analizi, Cebimon görev planlama ve doğrulama.",
    "Yetkiler ve sınırlar: Kritik işlemler kullanıcı onayından geçer, abartılı vaat yok, yerel ve güvenli altyapı.",
    "Muhatabın sorusu varsa kısa ve net yanıtla, yoksa teşekkür edip görüşmeyi tamamla."
  ],
  sinirlar: [
    "1 dakikayı kesinlikle aşma.",
    "Abartılı vaatlerde bulunma, sadece sistemin gerçek yetkilerini ve sınırlarını aktar.",
    "Mali veya hukuki taahhüt verme."
  ],
  kisi: {
    ad: "Ömer Bey",
    numara: "05373351866",
    iliski: "muhatap / ortak"
  },
  eksik_bilgi: [],
  guncellendi: new Date().toISOString()
};

fs.mkdirSync(GOREV_DIZINI, { recursive: true });
fs.writeFileSync(path.join(GOREV_DIZINI, `${id}.json`), JSON.stringify(gorev, null, 2), 'utf8');
console.log(`[GÖREV OLUŞTURULDU] ID: ${id}`);

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const token = 'b4305bb83725b8c00284cb9f409fbe8dea02c68820f3b2dc';

try {
  const yanit = await fetch(`https://127.0.0.1:20131/api/gorevler/${id}/voip-ara?token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ numara: '05373351866' }),
  });
  const veri = await yanit.json();
  console.log('[ARAMA BAŞLATILDI]', JSON.stringify(veri, null, 2));
} catch (e) {
  console.error('[ARAMA HATA]', e.message);
}
