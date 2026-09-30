# Mimari

## Katmanlar

```
Katman 0 — Android / MIUI                (root yok)
Katman 1 — Termux (bionic libc, Node 22) → BEDEN, BEYİN, 9ROUTER, sshd     ← asistanın kendisi burada yaşar
Katman 2 — proot Ubuntu (glibc)          → 9REMOTE (native modüller), ağır araçlar   ← isteğe bağlı
```

**Neden 9remote proot'ta, 9router Termux'ta?** 9router'ın bağımlılıkları saf JS (react, enquirer, node-forge, node-machine-id) → Termux Node'unda doğrudan çalışır. 9remote ise `sharp`, `koffi`, `node-pty`, `node-datachannel`, `robotjs` gibi glibc için derlenmiş modüller taşır → Termux'un bionic libc'sinde çalışmaz, proot Ubuntu şart. Termux ile proot aynı ağ alanını paylaşır; `localhost` iki tarafta da aynı yerdir.

**Neden bizim kod Termux'ta?** Donanıma (kamera, mikrofon, telefon) sadece Termux:API üzerinden erişilir ve `termux-*` komutları Termux'un kendi ortamında çalışır. Beyin de aynı yerde durursa proot'a bağımlılık kalmaz: **asgari kurulum = Termux + node + 9router + bu depo.**

## Bileşenler ve portlar

| Bileşen | Port | Dinler | Kimlik doğrulama | Kaynak |
|---|---|---|---|---|
| 9router | 20128 | 127.0.0.1 | 9router API key | npm `9router` |
| Beden | 20130 | 127.0.0.1 | `Authorization: Bearer <beden.token>` | `beden/server.mjs` |
| Beyin | 20131 | 0.0.0.0 | `?token=` → çerez, veya Bearer `<beyin.token>` | `beyin/index.mjs` |
| sshd | 8022 | 0.0.0.0 | Termux şifresi / anahtar | Termux `openssh` |
| 9remote | relay + P2P | — | split-key + fiziksel Approve | npm `9remote` (proot) |

Tüm çalışma verisi `~/.asistan/` altında (`ASISTAN_HOME` ile değiştirilebilir):

```
~/.asistan/
├── config.json      ayarlar (izinler, portlar, LLM, arama)
├── beden.token      beyin→beden anahtarı        (0600)
├── beyin.token      panel→beyin anahtarı        (0600)
├── hafiza.md        kalıcı hafıza (insan tarafından da düzenlenebilir)
├── gorevler/*.json  görüşme görevleri: brifing + transkript + sonuç
├── sohbet/*.jsonl   sohbet günlükleri (oturum başına)
├── veri/            fotoğraflar, ses kayıtları
├── log/             beden.log beyin.log 9router.log ...
├── run/             pid dosyaları (servis.sh)
└── tls/             cert.pem key.pem (isteğe bağlı HTTPS)
```

## Veri akışları

### Sohbet + araç kullanımı
```
panel/CLI ─POST /api/sohbet─► Asistan.yanitla()
   ├─ sistem mesajı = kişilik + tarih + açık izinler + hafiza.md
   ├─ LLM (9router) ← araç tanımları (araclar.mjs)
   ├─ tool_calls → araç → Beden HTTP → Termux:API → donanım
   │     bak → fotoğraf base64 → bir sonraki tura image_url olarak eklenir (görüntü modeli)
   └─ son yanıt → panel; sohbet/*.jsonl'a günlük
```

### Görev (telefon görüşmesi)
```
"X'i ara, ... söyle" ─► GorevYoneticisi.olustur()
   └─ LLM JSON brifing: kisi, amac, konusma_noktalari, kabul_edilebilir_sonuclar, sinirlar, ton, acilis, basari_kriteri, eksik_bilgi
   └─ durum: hazir (veya taslak: eksik bilgi var)
panel "Görüşmeyi başlat" ─► taşıyıcı seçimi
   tarayici : WebSocket /ws/telefon → Gorusme motoru (motor.mjs)
   hucresel : Beden /telefon/ara (sadece hattı açar; brifing ekranda "kopya kâğıdı")
   voip     : baresip/SIP köprüsü (sip.mjs, ctrl_tcp + ALSA FIFO; docs/telefon-gorusmesi.md)
Gorusme motoru: açılış cümlesi → [ses→STT] → LLM(brifing kişiliği) → [TTS→ses] … → [GORUSME_BITTI]
   └─ GorevYoneticisi.ozetle(): {basarili, ozet, kararlar, takip} → görev kapanır → hafiza.md'ye not
```

### Ses yolları
| Mod | Kulak (STT) | Ağız (TTS) | Maliyet | Nerede kullanılır |
|---|---|---|---|---|
| `android` | `termux-speech-to-text` (Google tanıma) | `termux-tts-speak` (Android TTS) | ücretsiz | eski telefonun yanındayken; hoparlörden konuşma |
| `9router` | `/v1/audio/transcriptions` | `/v1/audio/speech` | sağlayıcıya göre | görüşme motoru (ses tarayıcıya/hatta gider) |
| `tarayici-ses` | cebindeki telefonun Web Speech API'si | `speechSynthesis` | ücretsiz | yazılım telefonu; sıfır sağlayıcıyla çalışır |

## Güvenlik modeli

1. **Localhost güvenli değildir.** Android'de cihazdaki her uygulama `127.0.0.1:20130`'a bağlanabilir → Beden token ister ve `/saglik` dışında hiçbir şey açık değildir.
2. **Yetenek bazlı izinler.** Kamera/mikrofon/konuşma/bildirim/pano açık; telefon, SMS, konum, kişiler, kabuk **kapalı** gelir. Her biri `config.json`'dan bilinçli açılır; kapalıyken 403 döner ve LLM'e "izin kapalı" metni gider.
3. **Beyin LAN'a açılır ama tokensiz hiçbir API/WS çalışmaz.** Tarayıcı `?token=` ile bir kez girer, çerez kalır. TLS için `scripts/termux/tls-uret.sh`.
4. **Uzaktan erişimde port açma yok.** Tavsiye: Tailscale (Android uygulaması eski telefonda, cebindekinde de) → `https://100.x.y.z:20131`. 9remote zaten P2P + fiziksel onay.
5. **Aramalar onaylıdır.** LLM `telefon_ara`'yı ancak izin açıksa kullanabilir; görüşme görevleri panelde insan onayıyla başlar. Görüşme başında AI olduğunu söyler.
6. **Kabuk erişimi** (`/kabuk`) varsayılan kapalıdır ve LLM araçlarına hiç verilmemiştir; yalnızca panel/otomasyon için düşünülmüştür.

## Kaynak bütçesi (Redmi Note 8)

| Süreç | Yaklaşık RSS | Not |
|---|---|---|
| MIUI + sistem | 1.5–2 GB | değiştirilemez |
| 9router (Next.js sunucu) | 250–400 MB | en ağır parçamız; `NODE_OPTIONS=--max-old-space-size=512` ile sınırla |
| Beyin | 60–90 MB | görüntü base64'leri geçicidir |
| Beden | 40–60 MB | ffmpeg çağrıları anlık |
| proot Ubuntu + 9remote | 150–300 MB | yalnızca gerektiğinde çalıştır (`ENABLE_9REMOTE=1`) |

4 GB fiziksel + 1 GB "genişletilmiş RAM" (MIUI swap) ile hepsi bir arada çalışır; 9remote'un 60fps masaüstü akışı ısıyı artırır, uzun süreli değil "gerektiğinde" kullan. Ayrıntı: [donanim-notlari.md](donanim-notlari.md).

## Tasarım kararları

- **Tek dil: Node.js (ESM).** 9router/9remote Node; Termux'ta `nodejs-lts` var; `fetch`, `FormData`, `WebSocket` istemcisi yerleşik. Tek dış bağımlılık `ws`.
- **Türkçe alan adları** (beden, beyin, köprü, görev, hafıza) — proje metaforlarıyla bire bir; tanımlayıcılar ASCII (ş/ğ yok) ki araç adları OpenAI şemasına uysun.
- **Araç sonuçları metin, görüntüler ayrı kullanıcı mesajı.** OpenAI `tool` mesajları metin taşır; kamera görüntüsü bir sonraki `user` mesajına `image_url` olarak eklenir (yaygın, sağlayıcılar arası uyumlu desen).
- **Görüşme motoru taşıyıcıdan bağımsız.** Bugün WebSocket+tarayıcı, yarın Twilio medya akışı ya da SIP: motor `metin/sesCal/sesDurdur/durum/bitti` arayüzünü konuşur, gerisini taşıyıcı bilir.
- **Ölçeklenebilir değil, dayanıklı.** Tek kullanıcı, tek cihaz; hedef 7/24 ayakta kalmak: bash tabanlı yeniden doğma, Termux:Boot, wake-lock, kademeli bekleme.
