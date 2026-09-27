# Kurulum — Eski telefonu canlandırma

Hedef cihaz: Xiaomi Redmi Note 8 (Android 9–11 / MIUI 12.x, root yok). Diğer Android'lerde de aynı adımlar geçerlidir.

## 0. Telefonu hazırla

1. **Termux'u F-Droid'den kur** (Play Store sürümü eski ve bakımsız). Aynı kaynaktan: **Termux:API**, **Termux:Boot** (isteğe bağlı: Termux:Widget).
2. **Ayarlar → Uygulamalar → Termux:API → İzinler:** Kamera, Mikrofon, Telefon, SMS, Kişiler, Konum, Bildirim. Termux için de aynıları.
3. **MIUI pil yönetimi:** Ayarlar → Uygulamalar → Termux → Pil tasarrufu → **Kısıtlama yok**; **Otomatik başlat** → aç. Aynısını Termux:API ve Termux:Boot için yap. Ayarlar → Pil → "Uygulamaları arka planda kilitle" listesine Termux'u ekle (son uygulamalar ekranında kilit simgesi).
4. **Geliştirici seçenekleri** (Ayarlar → Telefon hakkında → MIUI sürümüne 7 kez dokun): "MIUI optimizasyonu"nu kapatmak agresif süreç öldürmeyi azaltır (isteğe bağlı). "Ekran açıkken uyanık kal" şarjda faydalı.
5. **Genişletilmiş RAM** (Ayarlar → Ek ayarlar → Bellek genişletme) açık kalsın: 4+1 GB.
6. Telefon sürekli şarjda duracaksa pili %60–80 bandında tutan akıllı priz/zamanlayıcı ömrü uzatır; MIUI'nin şarj sınırı yok. Isınmayı azaltmak için ekran parlaklığını en düşüğe çek, ekranı kapalı tut.

## 1. Termux kurulumu

Termux'ta:

```bash
pkg install -y git
git clone https://github.com/AppleCurse/asistanim-cebimde ~/asistanim-cebimde
bash ~/asistanim-cebimde/scripts/termux/kur.sh --tls
```

`kur.sh` şunları yapar: `pkg` güncelleme; `nodejs-lts termux-api openssh ffmpeg jq zbar openssl-tool util-linux` kurulumu; `npm install`; `npm i -g 9router`; `~/.asistan` + tokenlar; `.env` kopyası; `--tls` ile HTTPS sertifikası; `--proot` ile Ubuntu + 9remote.

İlk kamera/mikrofon komutlarında Android izin pencereleri açılır — **izin ver**.

Doğrulama:

```bash
termux-battery-status          # JSON dönmeli
termux-camera-info             # kameraları listelemeli
termux-tts-speak "merhaba"     # konuşmalı
termux-speech-to-text          # bir şey söyle → yazıya çevirmeli (Google uygulaması gerekir)
```

`termux-speech-to-text` boş dönüyorsa: Google uygulaması / "Speech Services by Google" kurulu ve Türkçe çevrimdışı paket indirilmiş olmalı (Ayarlar → Sistem → Diller → Konuşma).

## 2. 9router: beyni bağla

```bash
9router
```

Telefonun tarayıcısında `http://localhost:20128` → **Providers** → ücretsiz bir sağlayıcı bağla (OpenCode Free kayıtsız çalışır; Kiro, Vertex kredisi vb.) ya da kendi OpenAI/Anthropic/Gemini anahtarını gir. **Dashboard → API key**'i kopyala.

Görüşme motoru için ses sağlayıcıları (isteğe bağlı): 9router'da STT (Whisper/Gemini/Groq…) ve TTS sağlayıcısı bağlarsan `STT_SAGLAYICI=9router`, `TTS_SAGLAYICI=9router` yapabilirsin. Bağlamazsan yazılım telefonu cebindeki telefonun kendi tanıma/okuma motorunu kullanır (ücretsiz).

`~/asistanim-cebimde/.env`:

```env
LLM_API_KEY=9r-...............
LLM_MODEL=kr/claude-sonnet-4.5     # 9router panelindeki model adı; boş bırakırsan ilk uygun model seçilir
KULLANICI_ADI="Adın Soyadın"        # tırnaklı; asistan aramalarda "X'in dijital asistanı" der
ASISTAN_ADI=Cebi
```

Model listesi: `npm run modeller`

## 3. Başlat

```bash
bash ~/asistanim-cebimde/scripts/termux/baslat.sh
```

Çıktıda `Panel: https://192.168.x.y:20131/?token=...` satırını cebindeki telefonda aç (aynı Wi-Fi). Tarayıcı "güvenli değil" derse (kendinden imzalı sertifika) **Gelişmiş → Devam et** — bir kez. Sonra **Ana ekrana ekle**: PWA gibi açılır.

Terminalden deneme: `npm run sohbet` → `pil kaç?`, `etrafa bak`, `"test" de`.

Yönetim:

```bash
bash scripts/termux/durum.sh     # kim yaşıyor, panel adresi
bash scripts/termux/durdur.sh    # hepsini durdur
tail -f ~/.asistan/log/beyin.log # loglar
```

## 4. Açılışta otomatik kalksın

```bash
bash ~/asistanim-cebimde/scripts/termux/boot-kur.sh
```

Termux:Boot uygulamasını **bir kez aç** (Android kancayı kaydetsin). Telefonu yeniden başlat → 15 sn sonra servisler kalkar (`~/.asistan/log/boot.log`).

## 5. Uzaktan erişim (evden çıkınca)

En temiz yol **Tailscale**: eski telefona ve cebindekine Tailscale uygulamasını kur, aynı hesapla gir. Panel: `https://100.x.y.z:20131/?token=...` — port açma, DDNS yok. Sertifikayı Tailscale IP'siyle yenile: `TAILSCALE_IP=100.x.y.z bash scripts/termux/tls-uret.sh` ve beyni yeniden başlat.

Alternatif: 9remote'un "Zero-Config Localhost Preview" özelliği (HTTP sayfaları çalışır; WebSocket'li yazılım telefonu için Tailscale önerilir).

## 6. Mikrofon ve HTTPS

Tarayıcılar mikrofonu ve konuşma tanımayı yalnızca **güvenli bağlamda** (HTTPS veya localhost) açar. Seçenekler:

- `scripts/termux/tls-uret.sh` (kur.sh `--tls`) → beyin HTTPS ile kalkar; ilk açılışta uyarıyı geç.
- Chrome'da `chrome://flags/#unsafely-treat-insecure-origin-as-secure` → `http://192.168.x.y:20131` ekle → HTTP ile de mikrofon açılır.
- Tailscale + HTTPS sertifikası (yukarıdaki gibi).

Yazılım telefonunda **"Tarayıcı sesi"** modu Android Chrome'da en iyi çalışır (Türkçe tanıma + Google TTS sesleri). iOS Safari'de tanıma yoktur; yazarak konuşabilirsin, yanıtlar yine seslendirilir.

## 7. proot Ubuntu + 9remote (isteğe bağlı, "sinir sistemi")

```bash
bash scripts/proot/ubuntu-kur.sh          # Ubuntu + Node 22 + 9remote (≈ 10 dk)
bash scripts/proot/9remote.sh             # ilk eşleşme: QR'ı cebindeki telefonla okut → Approve
ENABLE_9REMOTE=1 bash scripts/termux/baslat.sh   # sonrasında arka planda
```

Depo `/root/asistanim-cebimde`, ayarlar `/root/.asistan` olarak içeriye bağlanır → 9remote'un IDE'sinden kodu düzenleyip Claude Code/Codex'i (9router'a bağlı) çalıştırabilirsin. Proot içinden `localhost:20128` ve `:20130` aynı şekilde erişilebilir.

## Sorun giderme

| Belirti | Sebep / çözüm |
|---|---|
| `Beden: ulasilamiyor` | `bash scripts/termux/durum.sh`; `~/.asistan/log/beden.log`. Port çakışması → `.env` `BEDEN_PORT`. |
| Beden `mock` modunda | Termux:API paketi (`pkg install termux-api`) veya uygulaması yok. `termux-battery-status` çalışmalı. |
| `LLM hazır değil` | 9router çalışmıyor (`9router`), `LLM_API_KEY` yanlış, sağlayıcı bağlı değil. `curl -H "Authorization: Bearer $LLM_API_KEY" http://127.0.0.1:20128/v1/models` |
| Kamera 30 sn sonra hata | Başka uygulama kamerayı tutuyor; MIUI izinlerini kontrol et; ekran kilitliyken bazı ROM'lar kamerayı vermez → ekranı kilitsiz, karartılmış tut. |
| `termux-microphone-record` boş dosya | Mikrofon izni; arama sırasında mikrofon telefon uygulamasında kilitlidir (bkz. telefon-gorusmesi.md). |
| Servisler geceleri ölüyor | MIUI pil kısıtı / otomatik başlat kapalı; `termux-wake-lock` bildirimi görünmeli; Android 12+ ROM'larda phantom process killer → `adb shell device_config put activity_manager max_phantom_processes 2147483647`. |
| Panelde mikrofon izni yok | HTTPS değil → §6. |
| 9remote `sharp` / `koffi` hatası | Termux'ta değil proot'ta çalıştır (`scripts/proot/9remote.sh`). |
| `node-machine-id` hatası (proot) | `/etc/machine-id` yok → `icerde-kur.sh` üretir; elle: `tr -d '-' < /proc/sys/kernel/random/uuid > /etc/machine-id` |
