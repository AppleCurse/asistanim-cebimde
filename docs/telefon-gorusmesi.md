# Telefon görüşmesi: asistan insanları nasıl arayacak?

Hedef: "Ahmet'i ara, yarınki toplantıyı 16:00'a ertele; olmazsa Perşembe öner" dediğinde asistanın **gerçekten arayıp, dinleyip, konuşup, sonucu raporlaması**. Bu sayfa kodlanmış akışları anlatır; mevcut durumdaki saha doğrulama sınırları [Gerçek durum](durum.md) sayfasındadır.

## Dürüst durum tespiti: hücresel hat üzerinden konuşmak (root'suz) mümkün değil

Termux:API ile `termux-telephony-call` numarayı çevirebilir. Ama Android, root'suz uygulamalara **çağrı sesine erişim vermez**: uplink'e TTS basamazsın, downlink'i kaydedemezsin (`VOICE_CALL` kaynağı sistem imzası ister; çağrı sırasında `MIC` çoğu cihazda sessizlik döner). "Hoparlörü aç, TTS'i hoparlörden ver, mikrofonla dinle" akustik hilesi teoride var, pratikte MIUI'de hoparlörü programatik açamazsın (termux-api'de yok), yankı ve TTS'in kendi sesini duyması işi bozar. Bu yüzden:

| Mod | Ne yapar | Kim konuşur | Durum |
|---|---|---|---|
| **tarayici** | Tarayıcı ↔ WebSocket ↔ görüşme motoru | Asistan | ✅ sahte sağlayıcıyla otomatik testli; gerçek Android tarayıcı/izin akışı sahada doğrulanmadı |
| **hucresel** | Eski telefon hattı çevirir; brifing panelde "kopya kâğıdı" olarak durur | **Sen** (hoparlörden) | ✅ kodlanmış ve mock API testli; gerçek cihaz araması doğrulanmadı |
| **voip** | SIP/baresip: ses akışı motorun içinden geçer | Asistan | ✅ **Sahada canlı doğrulandı** (Zadarma SIP + Baresip; çift yönlü ses, Fish Audio klon sesler ve canlı telefon görüşmeleri teyit edildi) |

## Görüşme motoru (kodlanmış ve otomatik testli kısım; saha kanıtı ayrı)

`beyin/kopru/motor.mjs` taşıyıcıdan bağımsızdır:

```
karşı taraf sesi ──► STT ──► LLM (görev brifingi kişiliği, son 30 tur) ──► TTS ──► karşı tarafa
      ▲                                                                       │
      └──────────── barge-in: yeni ses gelince çalan yanıt kesilir ◄───────────┘
[GORUSME_BITTI] etiketi → özet: {basarili, ozet, kararlar, takip} → görev kapanır → hafıza + bildirim
```

- Brifing (`gorev.mjs`) kişiliği belirler: kimlik açıklaması, amaç, konuşma noktaları, kabul edilebilir sonuçlar, **sınırlar** (söz verme, ücret konuşma…), üslup, açılış cümlesi, başarı kriteri.
- Yanıtlar "telefon için" kısa tutulur (`max_tokens: 300`, 1–2 cümle, markdown yok).
- Süre sınırı `arama.maksSure` (varsayılan 15 dk). Bağlantı kopması, kullanıcı kapatması, asistanın kapatması ayrı sebeplerle raporlanır.

Yeni bir taşıyıcı eklemek = şu 5 fonksiyonu sağlamak: `metin(rol, metin, sesGelecek)`, `sesCal(buffer, mime)`, `sesDurdur()`, `durum({asama})`, `bitti(gorev, {sebep, sure})` ve motorun `sesGeldi(buffer, mime)` / `kullaniciKonustu(metin)` metotlarını beslemek.

## Ses kanalı sağlığı (mic.raw / spk.raw) ve arama kapısı

İki ayrı boru var: kullanıcının sesi `spk.raw`'dan girer (kulak), asistanın sesi `mic.raw`'a yazılır (ağız). Geçmişte besleyici yazma hatalarını **sessizce yutuyor**, panel "konusuyor" diyor ama kullanıcı hiç ses duymuyordu ("başarılı" arama sanrısı). Artık:

- **Besleyici kendi kendini iyileştirir** (`sip.mjs`): yazma hatası sayar + loglar; EAGAIN/aralıksız hata 5 sn sürerse fd'yi kapatıp yoldan yeniden açar.
- **Kanal gözcüsü**: `CALL_ESTABLISHED`'tan sonra 2 sn içinde besleyici 100 paket yazamazsa `⚠️ SES KANALI ÖLÜ — kullanıcı ses duymayacak` diye loglar. "konusuyor" durumu **"duyuldu" demek değildir**; `ara()` dönüşü de sesin kullanıcıya ulaştığını iddia etmez.
- **Arama kapısı**: ses testi yeşil (`~/.asistan/run/ses-kanali-ok`) olmadan `ara()` arama ÇALDIRMAZ. Acil bypass: `SES_KANALI_KAPISI=0`.
- **`baresip-kur.sh` FIFO'ları asla yeniden yaratmaz** (varsa `rm`+`mkfifo` yapmaz) — beyin eski inode'a yapışık kalmasın diye.

### Elle doğrulama listesi (telefonda, arama ÇALDIRMADAN)

```bash
bash scripts/termux/ses-testi.sh
```

Betik 3 adımın kanıtını basar ve sonuca göre arama kapısını açar/kapar:
1. **Ölü boru**: beyin fd'leri `(deleted)` mı, inode/path uyuşuyor mu? Sorun varsa `durdur.sh && baslat.sh` **ikisi birlikte** uygulanır (tek tek ASLA).
2. **Besleyici**: 2 sn'de `mic.raw`'dan 3200 bayt akıyor mu? (Besleyici yalnızca çağrı sırasında yazar; çağrı yokken "uykuda" normaldir.)
3. **ALSA**: baresip geçici durdurulur, 440 Hz tını `mic.raw`'a basılır, proot içi `arecord -D mic` yakalar. `od` çıktısında ±20000 civarı salınım → ALSA sağlam (sorun baresip RTP tarafında); sıfır/EOF → `.asoundrc` `pcm.mic` tanımı yeniden kurulur (`bash scripts/proot/baresip-kur.sh` — artık FIFO'lara dokunmadan `.asoundrc`'yi yeniler).

Yeşil sonuç `~/.asistan/run/ses-kanali-ok` işaretini yazar; kırmızıda işaret silinir ve aramalar kapalı kalır.

## Faz 3 — VoIP köprüsü seçenekleri

### A) Bulut telefon API'si + medya akışı (önerilen ilk adım)
Twilio Programmable Voice **Media Streams**, Telnyx **Media Streaming**, Vonage **WebSockets**: hepsi aynı deseni izler —
1. Beyin `POST /voip/ara` → sağlayıcı API'siyle dış arama başlatılır, cevap URL'si bizim webhook.
2. Karşı taraf açınca sağlayıcı webhook'a gelir; biz "bu aramayı şu WebSocket'e bağla" deriz.
3. Sağlayıcı bize 8 kHz μ-law (Twilio) ses çerçeveleri akıtır; biz aynı kanaldan ses geri yollarız.
4. Motorun önüne **sunucu tarafı VAD** (enerji + sessizlik süresi, ~700 ms) ve μ-law↔PCM dönüşümü eklenir; TTS çıktısı 8 kHz μ-law'a örneklenir (ffmpeg veya saf JS).

Gereksinim: sağlayıcının webhook'a ulaşabileceği **genel adres**. Eski telefon CGNAT arkasında → **Tailscale Funnel** (Android'de yok, ama aradaki küçük bir VPS/evdeki başka cihaz üzerinden), **cloudflared tunnel** (Termux'ta `cloudflared` arm64 binary'si çalışır) ya da ucuz bir VPS'te sadece "ses röle" servisi. Not: sağlayıcının ses akışı telefonun internetinden geçer; 4G'de 8 kHz μ-law ≈ 64 kbps yön başına, sorun değil.

Türkiye numarası: Twilio/Telnyx TR numarası vermez ama dış aramada arayan numara olarak doğrulanmış kendi cep numaranı gösterebilirsin (Twilio "Verified Caller ID"). Yerli alternatifler (Netgsm, Bulutfon, Verimor) SIP trunk verir → B seçeneği.

### B) SIP trunk + telefonun kendisi SIP uç noktası ✅ KODLANDI (canlı doğrulama bekliyor)
proot Ubuntu içinde `baresip`, SIP hesabı yerli operatörden (Zadarma). Ses giriş/çıkışı ALSA `file` eklentisiyle `mic.raw`/`spk.raw` FIFO'larına bağlanır (`.asoundrc`, `scripts/proot/baresip-kur.sh`); komutlar `ctrl_tcp:4444` üzerinden. Artısı: tünel yok, tamamen telefonun içinde. Ses gidiş hattı sağlığı: besleyici kendi kendine iyileştirme + kanal gözcüsü + `ses-testi.sh` (yukarıdaki bölüme bak).

### C) WhatsApp/Telegram sesli arama
Resmî API'ler botlara sesli arama açmaz (WhatsApp Business Calling API kısıtlı/bölgesel). Şimdilik yok.

**Durum:** **B (baresip + Zadarma SIP) kodu ve otomatik birim/integration testleri vardır.** Gerçek SIP hesabı, baresip, RTP, karşı taraf ve çift yönlü ses akışıyla sahada çalıştığı henüz kanıtlanmadı. A (Twilio/Telnyx) uygulanmış bir yedek değil, olası gelecek taşıyıcıdır; motor taşıyıcıdan bağımsız olduğu için ayrı bir dosya olarak eklenebilir.

## Hukuk ve etik (Türkiye)

- **Kimlik açıklaması:** Asistan açılışta "X'in dijital asistanıyım" der; sorulursa asla insan olduğunu iddia etmez (`arama.aiOlduguSoylensin`, kapatılsa bile "sorulursa dürüst" kuralı kalır).
- **Kayıt:** Transkript tutulur. TCK 132–133 ve KVKK: karşı tarafı bilgilendirmeden ses kaydı yapma; transkript de kişisel veridir — `~/.asistan/gorevler/` sadece sende kalır, 3. tarafa gitmez (STT sağlayıcısı hariç — sağlayıcı seçimini ona göre yap).
- **Kapsam:** Kullanıcının kendi işlerini yürütmek (randevu, teyit, bilgi alma). Pazarlama/otomatik toplu arama **kapsam dışı** ve mevzuata aykırıdır (ETK 6563, İYS).
- **Sınırlar brifingde:** Para/ücret taahhüdü, kişisel bilgi paylaşımı, yetki dışı söz — LLM'e sistem mesajında yasaklanır; şüphede "iletirim" der.
