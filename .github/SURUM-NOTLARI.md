## Asistanım Cebimde v0.1.0 — Faz 0: iskelet

**Ne bu?** Çekmecedeki eski Android telefonu (hedef: Xiaomi Redmi Note 8, root yok) 7/24 yaşayan kişisel asistana dönüştüren proje. Kamerası gözü, mikrofonu kulağı, hoparlörü ağzı, telefon hattı ve SMS'i elleri; beyni 9router üzerinden istediğin LLM. Cebindeki telefondan panelle yönetirsin: "etrafa bak", "pil kaç?", "Ahmet'i ara, toplantıyı ertele".

Tam kılavuz (ne işe yarar, nasıl kurulur, nasıl kullanılır, her ayar, sorun giderme): **[README](https://github.com/AppleCurse/asistanim-cebimde#readme)**

### Kurulum (eski telefonda, Termux içinde — F-Droid'den Termux + Termux:API + Termux:Boot kurulu olmalı)

Tek satır:
```bash
curl -fsSL https://github.com/AppleCurse/asistanim-cebimde/releases/latest/download/indir-kur.sh | bash -s -- --tls
```
Zip ile: aşağıdaki `asistanim-cebimde-v0.1.0.zip`'i indir →
```bash
termux-setup-storage && pkg install -y unzip
unzip -o ~/storage/downloads/asistanim-cebimde-v0.1.0.zip -d ~/
bash ~/asistanim-cebimde/scripts/termux/kur.sh --tls
```
Sonra: `9router` → panelinden sağlayıcı bağla → API key'i `.env`'e yaz → `bash scripts/termux/baslat.sh` → çıkan adresi cebindeki telefonda aç → **⬇ Kur** ile uygulama olarak ana ekrana ekle → `bash scripts/termux/boot-kur.sh`.

### Bu sürümde neler var
- **Beden** (`beden/`): Termux:API üzerinden kamera, mikrofon, TTS, telefon, SMS, bildirim, konum, pano, fener — token korumalı HTTP köprüsü; telefon/SMS/konum/kişiler/kabuk izinleri varsayılan kapalı; sahte cihaz modu.
- **Beyin** (`beyin/`): 9router istemcisi (sohbet + STT + TTS), araç kullanan ajan döngüsü, **16 araç**, kalıcı hafıza, web paneli (**PWA**, ana ekrana kurulur), terminal sohbeti.
- **Görüşme görevleri**: "X'i ara, … söyle" → LLM brifingi (kişi, amaç, konuşma noktaları, sınırlar, başarı kriteri) → panelde onay → görüşme → sonuç raporu + hafızaya not.
- **Görüşme motoru + yazılım telefonu**: tarayıcıdan sesli görüşme (Web Speech ücretsiz / 9router sesi), barge-in, otomatik özet.
- **Yaşam döngüsü**: ölürse yeniden doğuran supervisor, Termux:Boot, wake-lock, HTTPS sertifikası, durum/durdur scriptleri.
- **proot Ubuntu + 9remote** kurulumu (telefonun içine IDE/terminal/masaüstü).
- **22 test**, telefon olmadan çalışan sahte ortam, GitHub Actions sürüm paketi.

### Bilinen sınırlar
- Root'suz Android çağrı sesine erişim vermez: asistan SIM'den **çevirir ama konuşamaz**. Kendi başına konuşması için VoIP hattı (Twilio/Telnyx/yerli SIP) **Faz 3**'te; motor hazır. Bkz. `docs/telefon-gorusmesi.md`.
- Gerçek cihazda canlı doğrulama henüz yapılmadı (sahte cihazla test edildi); ilk kurulumda `beden/termux-api.mjs` içinde küçük ayarlar gerekebilir.

### Dosyalar
| Dosya | Ne için |
|---|---|
| `indir-kur.sh` | tek satır kurulum |
| `asistanim-cebimde-v0.1.0.zip` | elle indirip açmak için |
| `asistanim-cebimde-v0.1.0.tar.gz` | aynı içerik |
| `asistanim-cebimde.tar.gz` | `indir-kur.sh`'ın çektiği sabit isimli paket |
