# Donanım notları — Xiaomi Redmi Note 8 (ginkgo)

| | |
|---|---|
| SoC | Qualcomm Snapdragon 665 (SM6125): 4× Kryo 260 Gold @ 2.0 GHz + 4× Kryo 260 Silver @ 1.8 GHz, 11 nm |
| RAM | 4 GB LPDDR4X + MIUI "bellek genişletme" 1 GB (depolamada swap) |
| Depolama | 64/128 GB UFS 2.1 — Termux + Ubuntu ≈ 3 GB |
| Kamera | 48 MP ana (Samsung GM1) + 8 MP geniş + 2 MP makro + 2 MP derinlik; ön 13 MP |
| Android | Fabrika 9 → resmî son 11 (MIUI 12.5). Özel ROM'larla 13/14 mümkün |
| Pil | 4000 mAh, 18 W; şarjda sürekli çalışma için ısı yönetimi önemli |
| Mimari | aarch64 — Termux paketleri, Node arm64 prebuilt'leri, Ubuntu arm64 hepsi mevcut |

## Termux'ta performans
- Node 22 arm64 Termux'ta sorunsuz; `npm install` native derleme gerekmezse hızlı. `ws` saf JS.
- `termux-camera-photo` 48 MP'de 2–4 s sürer ve ~4–6 MB JPEG üretir → beden ffmpeg ile 1280 px'e küçültür (`beden.fotografGenislik`). Görüntü modellerine bu yeterli.
- `ffmpeg` (Termux paketi) yazılım kodlaması; 10 s ses dönüşümü < 1 s.
- Yerel LLM çalıştırma (llama.cpp) 4 GB RAM'de 1–3B modellerle "mümkün ama yavaş" (~3–6 tok/s). Bu projede beyin bulutta; yerel model yalnızca çevrimdışı asgari yanıt için düşünülebilir.

## Isı ve pil
- Sürekli şarjda kalan cihazda hedef: kılıfsız, dik, havadar; ekran kapalı. `termux-battery-status` `temperature` alanını izle; 42 °C üzeri kalıcıysa 9remote masaüstü akışını kapat, 9router'ı proot yerine Termux'ta tut.
- MIUI'de şarj sınırı yok. Akıllı priz ile %40–80 döngüsü veya "şarj koruma" destekleyen ROM.
- `termux-wake-lock` CPU'yu uyanık tutar; ekran kapalıyken Wi-Fi'nin uyumasını engelle: Ayarlar → Wi-Fi → Gelişmiş → "Uyku modunda Wi-Fi açık kalsın: Her zaman".

## MIUI'nin arka plan öldürme davranışı
- Termux, Termux:API, Termux:Boot için: Pil tasarrufu → Kısıtlama yok; Otomatik başlat açık; son uygulamalarda kilitle.
- "Bildirimleri sabit tut": Termux'un kalıcı bildirimi görünür olmalı (öldürülme olasılığını düşürür).
- Android 12+ özel ROM'larda **phantom process killer** Termux'un alt süreçlerini 32 sınırında keser: `adb shell "device_config put activity_manager max_phantom_processes 2147483647"` ve `settings put global settings_enable_monitor_phantom_procs false`. Resmî MIUI 12.5 (Android 11) bu sorunu yaşamaz.

## Kamera erişimi ve ekran kilidi
- Bazı MIUI sürümlerinde ekran kilitliyken `termux-camera-photo` "camera in use / timeout" verir. Çözüm: kilit ekranını kapat (Ayarlar → Kilit ekranı → Yok) ve parlaklığı en düşüğe al, ya da "ekran açık kalsın" + siyah duvar kâğıdı.
- Ön kamera (`kamera: 1`) masa üstünde yatan telefon için tavan/insan görür; arka kamera odaya bakması için telefonu dik bir tutucuya koy. "Göz" için 8 MP geniş açı kamera Termux:API'de ayrı id olarak görünmeyebilir (`termux-camera-info` ile kontrol).

## Telefon hattı
- SIM takılıysa `termux-telephony-call` çift SIM'de varsayılan SIM'i kullanır. Arama sesine root'suz erişim yok (bkz. telefon-gorusmesi.md).
- `termux-sms-send` MIUI'de ilk kullanımda "varsayılan SMS uygulaması olmadan gönderim" uyarısı verebilir; izin ver.

## Yedek/alternatif cihazlar
Aynı kurulum her arm64 Android'de çalışır. Daha fazla RAM (6–8 GB) 9remote + 9router + görüntü işlemede rahatlık sağlar; kamera kalitesi göz için ikincil, mikrofon kalitesi kulak için birincil.
