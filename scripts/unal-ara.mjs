// Ünal Bey'e (05342009044) kalın sesli otoriter brifing araması
import fs from 'node:fs';
import path from 'node:path';
import { ASISTAN_HOME } from '../ortak/ayar.mjs';

const homeDizini = process.env.ASISTAN_HOME || (fs.existsSync('/data/data/com.termux/files/home/.asistan') ? '/data/data/com.termux/files/home/.asistan' : ASISTAN_HOME);
const GOREV_DIZINI = path.join(homeDizini, 'gorevler');
const id = 'unal-brifing-' + Date.now().toString(36);

const gorev = {
  id,
  olusturuldu: new Date().toISOString(),
  kaynak: 'panel',
  talimat: "Ünal Bey'i (05342009044) ara. Salim Bey'in kurduğu sistem hakkında kalın, kendinden emin ve otoriter bir tonla brifing ver.",
  durum: 'hazir',
  mod: 'voip',
  transkript: [],
  sonuc: null,
  baslik: "Ünal Bey'e Otoriter Sistem Brifingi",
  amac: "Salim Bey'in sisteminin yetkilerini, bağımsız arama ve analiz becerilerini kalın ve etkileyici bir tonla aktarmak.",
  ton: "Otoriter, derin, ağırbaşlı, kendinden emin ve net",
  acilis: "Merhaba Ünal. Ben Salim Bey'in sizin için tasarladığı özel yetenekli, kalın sesli, pek merhametli ve yufka yürekli olmayan yapay zekâ asistanıyım. Salim Bey'in kurduğu ve eski bir telefonu 7 gün 24 saat yaşayan kesintisiz bir komuta merkezine dönüştüren bu sistem hakkında size brifing vermek için aradım. Bu sistem; bağımsız telefon aramaları gerçekleştirebilir, SMS trafiğini yönetebilir, kamerasıyla ortamı ve belgeleri analiz edip adımları doğrulayabilir ve tüm işlemleri yerel güvenlik sınırları içinde kesintisiz icra eder. Sormak istediğiniz bir detay var mı?",
  konusma_noktalari: [
    "Neden var olduğu: Eski bir Android telefonu 7/24 yaşayan kişisel asistana ve komuta merkezine dönüştürmek.",
    "Beceriler: Sesli VoIP/GSM arama, SMS yönetimi, kamera ile görme ve ortam analizi, Cebimon görev planlama ve doğrulama.",
    "Yetkiler ve sınırlar: Kritik işlemler kullanıcı onayından geçer, yerel ve güvenli altyapı.",
    "Muhatabın sorusu varsa kısa ve net yanıtla, yoksa görüşmeyi tamamla."
  ],
  sinirlar: [
    "1 dakikayı kesinlikle aşma.",
    "Abartılı vaatlerde bulunma, sistemin gerçek yetkilerini aktar.",
    "Mali veya hukuki taahhüt verme."
  ],
  kisi: {
    ad: "Ünal Bey",
    numara: "05342009044",
    iliski: "muhatap / iş ortağı"
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
    body: JSON.stringify({ numara: '05342009044' }),
  });
  const veri = await yanit.json();
  console.log('[ARAMA BAŞLATILDI]', JSON.stringify(veri, null, 2));
} catch (e) {
  console.error('[ARAMA HATA]', e.message);
}
