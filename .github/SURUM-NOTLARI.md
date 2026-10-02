## Asistanım Cebimde v0.1.0 — kaynak snapshot durumu

**Ne bu?** Çekmecedeki eski Android telefonu (hedef: Xiaomi Redmi Note 8, root yok) kişisel asistana dönüştürmeyi amaçlayan bir prototip/erken alfa. Kamera, mikrofon, Android API, LLM araç döngüsü, görevler, Cebimon, web paneli ve SIP/baresip köprüsü için gerçek kod vardır. Bu kod ve testler, gerçek Redmi Note 8'de veya 7/24 saha kullanımında doğrulama anlamına gelmez.

Tam kılavuz: **[README](https://github.com/AppleCurse/asistanim-cebimde#readme)** · **[Gerçek durum ve doğrulama sınırları](../docs/durum.md)**

### Kurulum (Termux içinde — F-Droid'den Termux + Termux:API + Termux:Boot kurulmalı)

```bash
curl -fsSL https://github.com/AppleCurse/asistanim-cebimde/releases/latest/download/indir-kur.sh | bash -s -- --tls
```

9router varsayılan olarak arka planda başlar; sağlayıcıyı 9router panelinde bağla ve API anahtarını `.env` dosyasına yaz. Sonra `bash scripts/termux/baslat.sh` çalıştır, çıktıda verilen token içermeyen panel adresini aç ve giriş ekranına `cat ~/.asistan/beyin.token` ile alacağın anahtarı gir. Anahtarı URL'ye ekleme. İsteğe bağlı olarak `bash scripts/termux/boot-kur.sh` ile açılışta başlat.

### Kaynakta bulunan yetenekler
- **Beden** (`beden/`): Termux:API üzerinden kamera, mikrofon, TTS, telefon, SMS, bildirim, konum, pano, fener; token korumalı HTTP köprüsü ve mock cihaz. Telefon/SMS/konum/kişiler/kabuk izinleri varsayılan kapalıdır.
- **Beyin** (`beyin/`): LLM istemcisi, tool-calling ajan döngüsü, **17 araç**, hafıza, görev sistemi, Cebimon, PWA panel ve terminal sohbeti.
- **Görüşme**: tarayıcı WebSocket görüşmesi ve SIP/baresip köprüsü için kod/test; dış arama akışında ses kanalı kontrolü ve arama kapısı.
- **Operasyon**: supervisor, Termux:Boot, wake-lock, TLS ve durum/durdur betikleri.
- **Otomatik testler**: `npm ci && npm test` bu checkout'ta **81/81 başarılı** (mock/sahte sağlayıcı ve betik testleri). Bu sonuç gerçek donanım/saha testi değildir; güncel doğrulama ayrıntıları için [`docs/durum.md`](../docs/durum.md).

### Bilinen sınırlar
- **Gerçek Android/Redmi Note 8 kurulumu ve uzun süreli dayanıklılık doğrulanmadı.** Kamera, mikrofon, TTS, MIUI arka plan davranışı ve 24 saat çalışma için elle cihaz testi gerekir.
- **Gerçek SIP/RTP görüşmesi doğrulanmadı.** SIP kodu ve testleri var; gerçek SIP hesabı, baresip, karşı taraf ve çift yönlü telefon sesiyle saha kanıtı yok.
- Sürekli algılama, wake-word, olay/trigger motoru ve scheduler henüz tamamlanmadı; proaktif ajan olarak sunulmaz.
- Panel oturumu POST ile açılır, `HttpOnly` çerezi kullanır; HTTPS'te `Secure` işareti eklenir. İnternete açık üretim dağıtımı için ek güvenlik/saha gözden geçirmesi gerekir.

### Sürüm dosyaları
| Dosya | Ne için |
|---|---|
| `indir-kur.sh` | tek satır kurulum |
| `asistanim-cebimde-v0.1.0.zip` | elle indirip açmak için |
| `asistanim-cebimde-v0.1.0.tar.gz` | aynı içerik |
| `asistanim-cebimde.tar.gz` | `indir-kur.sh`'ın çektiği sabit isimli paket |
