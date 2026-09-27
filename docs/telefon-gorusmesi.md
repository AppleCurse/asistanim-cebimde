# Telefon görüşmesi: asistan insanları nasıl arayacak?

Hedef: "Ahmet'i ara, yarınki toplantıyı 16:00'a ertele; olmazsa Perşembe öner" dediğinde asistanın **gerçekten arayıp, dinleyip, konuşup, sonucu raporlaması**.

## Dürüst durum tespiti: hücresel hat üzerinden konuşmak (root'suz) mümkün değil

Termux:API ile `termux-telephony-call` numarayı çevirebilir. Ama Android, root'suz uygulamalara **çağrı sesine erişim vermez**: uplink'e TTS basamazsın, downlink'i kaydedemezsin (`VOICE_CALL` kaynağı sistem imzası ister; çağrı sırasında `MIC` çoğu cihazda sessizlik döner). "Hoparlörü aç, TTS'i hoparlörden ver, mikrofonla dinle" akustik hilesi teoride var, pratikte MIUI'de hoparlörü programatik açamazsın (termux-api'de yok), yankı ve TTS'in kendi sesini duyması işi bozar. Bu yüzden:

| Mod | Ne yapar | Kim konuşur | Durum |
|---|---|---|---|
| **tarayici** | Cebindeki telefonun tarayıcısı ↔ WebSocket ↔ görüşme motoru | Asistan | ✅ çalışıyor — geliştirme, test ve asistanla sesli sohbet |
| **hucresel** | Eski telefon hattı çevirir; brifing panelde "kopya kâğıdı" olarak durur | **Sen** (hoparlörden) | ✅ çalışıyor — asistan hazırlar, çevirir, sonucu senden alır ve hafızaya yazar |
| **voip** | Bulut telefon API'si / SIP: ses akışı motorun içinden geçer | Asistan | ⏳ Faz 3 — gerçek hedef |

## Görüşme motoru (bugün hazır olan kısım)

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

## Faz 3 — VoIP köprüsü seçenekleri

### A) Bulut telefon API'si + medya akışı (önerilen ilk adım)
Twilio Programmable Voice **Media Streams**, Telnyx **Media Streaming**, Vonage **WebSockets**: hepsi aynı deseni izler —
1. Beyin `POST /voip/ara` → sağlayıcı API'siyle dış arama başlatılır, cevap URL'si bizim webhook.
2. Karşı taraf açınca sağlayıcı webhook'a gelir; biz "bu aramayı şu WebSocket'e bağla" deriz.
3. Sağlayıcı bize 8 kHz μ-law (Twilio) ses çerçeveleri akıtır; biz aynı kanaldan ses geri yollarız.
4. Motorun önüne **sunucu tarafı VAD** (enerji + sessizlik süresi, ~700 ms) ve μ-law↔PCM dönüşümü eklenir; TTS çıktısı 8 kHz μ-law'a örneklenir (ffmpeg veya saf JS).

Gereksinim: sağlayıcının webhook'a ulaşabileceği **genel adres**. Eski telefon CGNAT arkasında → **Tailscale Funnel** (Android'de yok, ama aradaki küçük bir VPS/evdeki başka cihaz üzerinden), **cloudflared tunnel** (Termux'ta `cloudflared` arm64 binary'si çalışır) ya da ucuz bir VPS'te sadece "ses röle" servisi. Not: sağlayıcının ses akışı telefonun internetinden geçer; 4G'de 8 kHz μ-law ≈ 64 kbps yön başına, sorun değil.

Türkiye numarası: Twilio/Telnyx TR numarası vermez ama dış aramada arayan numara olarak doğrulanmış kendi cep numaranı gösterebilirsin (Twilio "Verified Caller ID"). Yerli alternatifler (Netgsm, Bulutfon, Verimor) SIP trunk verir → B seçeneği.

### B) SIP trunk + telefonun kendisi SIP uç noktası
proot Ubuntu içinde `baresip` (`apt install baresip`) veya `pjsua`; SIP hesabı yerli operatörden. Ses giriş/çıkışını dosya/pipe modülleriyle motora bağlarız (`aufile`, `sndfile`, ya da pjsua2 Python ile özel medya portu). Artısı: tünel yok, tamamen telefonun içinde. Eksisi: gerçek zamanlı çift yönlü ses borulaması daha çok mühendislik ister, NAT/RTP ayarları.

### C) WhatsApp/Telegram sesli arama
Resmî API'ler botlara sesli arama açmaz (WhatsApp Business Calling API kısıtlı/bölgesel). Şimdilik yok.

**Karar:** Faz 3'te A ile başla (Twilio Media Streams adaptörü + cloudflared), motor zaten hazır. B'yi maliyet/lokal numara isteği doğarsa ekle.

## Hukuk ve etik (Türkiye)

- **Kimlik açıklaması:** Asistan açılışta "X'in dijital asistanıyım" der; sorulursa asla insan olduğunu iddia etmez (`arama.aiOlduguSoylensin`, kapatılsa bile "sorulursa dürüst" kuralı kalır).
- **Kayıt:** Transkript tutulur. TCK 132–133 ve KVKK: karşı tarafı bilgilendirmeden ses kaydı yapma; transkript de kişisel veridir — `~/.asistan/gorevler/` sadece sende kalır, 3. tarafa gitmez (STT sağlayıcısı hariç — sağlayıcı seçimini ona göre yap).
- **Kapsam:** Kullanıcının kendi işlerini yürütmek (randevu, teyit, bilgi alma). Pazarlama/otomatik toplu arama **kapsam dışı** ve mevzuata aykırıdır (ETK 6563, İYS).
- **Sınırlar brifingde:** Para/ücret taahhüdü, kişisel bilgi paylaşımı, yetki dışı söz — LLM'e sistem mesajında yasaklanır; şüphede "iletirim" der.
