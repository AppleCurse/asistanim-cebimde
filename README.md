# Asistanım Cebimde

> Eski bir Android telefonu **7/24 yaşayan**, gören, duyan, konuşan ve **senin adına telefon eden** kişisel asistana dönüştürüyoruz.
> Cebindeki telefondan ona yazarsın; o eski telefonun içinden dünyaya bakar, dinler, arar, konuşur ve sana rapor verir.

**Donanım:** Xiaomi Redmi Note 8 (ginkgo) · Snapdragon 665, 8 çekirdek · 4 GB + 1 GB genişletilmiş RAM · Termux (root yok)

## Anatomi

| Organ | Nedir | Nasıl |
|---|---|---|
| 🧠 **Beyin** | LLM'ler — muhakeme, planlama, konuşma | [9router](https://github.com/decolua/9router) → 40+ sağlayıcı tek uçtan (`localhost:20128/v1`), ücretsiz katman + otomatik yedekleme |
| 👁 **Göz** | Kamera: ortamı görme, yüz/QR/yazı okuma | Termux:API `termux-camera-photo` → görüntü modeli |
| 👂 **Kulak** | Mikrofon: dinleme, konuşmayı yazıya çevirme | Android STT (ücretsiz) veya 9router `/audio/transcriptions` |
| 👄 **Ağız** | Hoparlör: sesli konuşma | Android TTS (ücretsiz, çevrimdışı) veya 9router `/audio/speech` |
| ✋ **Eller** | Telefon hattı, SMS, bildirim, pano, konum | Termux:API |
| ❤️ **Kalp** | Ölürse yeniden doğma, açılışta kalkma, uyanık kalma | `scripts/termux/servis.sh` + Termux:Boot + wake-lock |
| 🔌 **Sinir sistemi** | Her yerden içeri girme: IDE, terminal, masaüstü | [9remote](https://github.com/decolua/9remote) (proot Ubuntu içinde) + panel |
| 📞 **Köprü** | Telefon görüşmesi motoru: dinle → düşün → konuş | `beyin/kopru/` — taşıyıcıdan bağımsız, bugün tarayıcı, yarın VoIP |

## Mimari

```
   CEBİNDEKİ TELEFON                             ESKİ TELEFON (Redmi Note 8, Termux)
  ┌──────────────────┐                     ┌─────────────────────────────────────────────────┐
  │ Panel (PWA)      │  http(s) :20131     │  BEYİN  beyin/index.mjs                          │
  │  • sohbet        │◄───────────────────►│   ajan döngüsü + araçlar + görevler + web paneli │
  │  • görevler      │  ws /ws/telefon     │   └─ köprü: görüşme motoru (STT→LLM→TTS)          │
  │  • 📞 yazılım tel│                     │        │ http :20130 (token)                      │
  │ 9remote (PWA)    │◄─── WebRTC P2P ────►│  BEDEN  beden/server.mjs  ── Termux:API ── donanım│
  └──────────────────┘                     │        │ http :20128/v1                           │
                                           │  9ROUTER  LLM + STT + TTS musluğu → 40+ sağlayıcı │
                                           │  (proot Ubuntu) 9remote ── IDE / terminal / ekran │
                                           └─────────────────────────────────────────────────┘
```

- **Beden** yalnızca `127.0.0.1`'i dinler ve token ister (Android'de localhost'a her uygulama bağlanabilir). Telefon/SMS/konum/kabuk yetenekleri **varsayılan kapalı**; `~/.asistan/config.json` → `beden.izinler` ile tek tek açılır.
- **Beyin** LAN/Tailscale'e açılır, token + çerezle korunur. Tüm LLM/STT/TTS trafiği 9router üzerinden geçer: sağlayıcı değiştirmek ayar değiştirmektir.
- **Görevler**: "Ahmet'i ara, yarınki toplantıyı 16:00'a ertele" → LLM yapılandırılmış brifing çıkarır (kişi, amaç, konuşma noktaları, sınırlar, başarı kriteri) → panelde onaylarsın → görüşme motoru brifingle konuşur → transkriptten sonuç raporu + hafızaya not + bildirim.

Ayrıntılar: [docs/mimari.md](docs/mimari.md) · Telefon görüşmesi tasarımı ve dürüst sınırlar: [docs/telefon-gorusmesi.md](docs/telefon-gorusmesi.md)

## İndir ve kur (eski telefonda, Termux içinde)

**Yol 1 — Tek satır (önerilen):** Termux'a yapıştır, gerisini o halleder:

```bash
curl -fsSL https://github.com/AppleCurse/asistanim-cebimde/releases/latest/download/indir-kur.sh | bash -s -- --tls
```
(`--proot` eklersen Ubuntu + 9remote de kurulur.)

**Yol 2 — Zip indir:** [Sürümler sayfasından](https://github.com/AppleCurse/asistanim-cebimde/releases/latest) `asistanim-cebimde-vX.Y.Z.zip` dosyasını eski telefonun tarayıcısıyla indir (Downloads'a iner), sonra Termux'ta:

```bash
termux-setup-storage                 # bir kez; Downloads'a erişim izni
pkg install -y unzip
unzip -o ~/storage/downloads/asistanim-cebimde-v*.zip -d ~/
bash ~/asistanim-cebimde/scripts/termux/kur.sh --tls
```

**Yol 3 — Git (geliştirme):**

```bash
pkg install -y git
git clone https://github.com/AppleCurse/asistanim-cebimde ~/asistanim-cebimde
bash ~/asistanim-cebimde/scripts/termux/kur.sh --tls
```

**Cebindeki telefona "uygulama" olarak:** Panel bir PWA'dır. Panel açıkken üstteki **⬇ Kur** düğmesine (Chrome) ya da tarayıcı menüsünden **Ana ekrana ekle**'ye bas → ikonlu, tam ekran uygulama gibi açılır. (HTTPS'te otomatik kurulum istemi çıkar; HTTP'de "Ana ekrana ekle" kısayol olarak çalışır.)

Sonra:

1. **F-Droid'den** `Termux:API` ve `Termux:Boot` uygulamalarını kur; Termux'a kamera/mikrofon/telefon/SMS/kişiler izni ver. MIUI'de Termux için pil kısıtlamasını kaldır, otomatik başlatmayı aç.
2. `9router` çalıştır → telefonun tarayıcısında `http://localhost:20128` → ücretsiz bir sağlayıcı bağla → API key ve model adını `.env` dosyasına yaz (`LLM_API_KEY`, `LLM_MODEL`, `KULLANICI_ADI`).
3. `bash scripts/termux/baslat.sh` → panel adresini ve tokenı yazar. Cebindeki telefonda aç, ana ekrana ekle.
4. `bash scripts/termux/boot-kur.sh` → telefon her açıldığında asistan kendiliğinden kalkar.

Adım adım ve sorun giderme: [docs/kurulum.md](docs/kurulum.md)

## Telefon olmadan geliştirme (bilgisayarda)

```bash
npm install
npm test                          # 22 test: beden, ajan döngüsü, görev brifingi, WebSocket görüşme
node scripts/dev/sahte-ortam.mjs  # sahte 9router + sahte cihaz + gerçek beyin → http://localhost:20131/?token=dev
```

Gerçek bir 9router'a bağlı geliştirmek için: `GERCEK_LLM=1 LLM_API_KEY=... LLM_MODEL=... node scripts/dev/sahte-ortam.mjs`

## Depo yapısı

```
ortak/ayar.mjs         ayarlar, tokenlar, log (~/.asistan)
beden/                 Termux cihaz köprüsü: server.mjs (HTTP API), termux-api.mjs (gerçek), mock.mjs (sahte)
beyin/                 index.mjs (HTTP+WS sunucu), asistan.mjs (ajan döngüsü), araclar.mjs (araçlar),
                       gorev.mjs (görüşme görevleri), llm.mjs (9router istemcisi), hafiza.mjs, cli.mjs
beyin/kopru/           motor.mjs (görüşme motoru), tarayici.mjs (WebSocket yazılım telefonu)
beyin/web/             panel (index.html/panel.js) + yazılım telefonu (telefon.html/telefon.js) + PWA (manifest, sw.js, ikonlar)
scripts/termux/        indir-kur.sh (tek satır kurulum), kur.sh, baslat.sh, durdur.sh, durum.sh, servis.sh, boot-kur.sh, tls-uret.sh
scripts/proot/         ubuntu-kur.sh, icerde-kur.sh, 9remote.sh
scripts/dev/           sahte-ortam.mjs, paketle.sh (zip/tar.gz sürüm paketi)
test/                  node:test — sahte 9router ile uçtan uca
docs/                  mimari, kurulum, telefon görüşmesi, yol haritası, donanım notları
```

## Durum ve yol haritası

- ✅ **Faz 0 — İskelet (bu sürüm):** beden + beyin + panel + görev sistemi + tarayıcı üzerinden sesli görüşme motoru, Termux kurulum/yaşam döngüsü scriptleri, proot/9remote kurulumu, testler.
- ⏳ **Faz 1 — Telefonda canlandırma:** gerçek cihazda kamera/mikrofon/TTS doğrulama, Termux:Boot, pil/ısı gözlemi, Tailscale ile uzaktan erişim.
- ⏳ **Faz 2 — Duyular:** yüz tanıma (kayıtlı kişiler), QR/yazı okuma akışları, "kapı zili" tarzı olay tetikleyicileri, sesli uyandırma kelimesi.
- ⏳ **Faz 3 — VoIP köprüsü:** gerçek telefon görüşmesi (Twilio/Telnyx medya akışı veya SIP trunk + baresip), sunucu tarafı VAD, barge-in, kayıt/rıza akışı.
- ⏳ **Faz 4 — Yaşam:** zamanlayıcılar, hatırlatmalar, günlük özet, çoklu görev kuyruğu, bellek konsolidasyonu.

Tam liste: [docs/yol-haritasi.md](docs/yol-haritasi.md)

## Etik ve hukuk notu

Asistan bir görüşmeye başlarken **dijital asistan olduğunu söyler** (`arama.aiOlduguSoylensin`, varsayılan açık). Görüşme kaydı/transkripti tutulur; Türkiye'de KVKK ve TCK 132-133 gereği karşı tarafın bilgisi/rızası olmadan kayıt yapma. Bu proje kişisel kullanım içindir.
