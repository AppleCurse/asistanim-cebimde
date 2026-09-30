# AGENTS.md — Bu depoda çalışan yapay zekâ ajanları için

Bu proje eski bir Android telefonu (Termux, root yok) 7/24 yaşayan kişisel asistana dönüştürür. Kod 9remote üzerinden telefonun içinde de düzenlenir; değişiklikler doğrudan "canlı" cihazı etkiler. Dikkatli ol.

## Kurallar
- **Dil:** Dokümantasyon, yorumlar, log ve kullanıcıya görünen metinler Türkçe. Tanımlayıcılar Türkçe kelimelerle ama ASCII (`gorev`, `hafiza`, `sesCal`) — araç adları OpenAI şemasına uymalı.
- **Bağımlılık ekleme:** Tek dış bağımlılık `ws`. Yeni paket eklemeden önce Node yerleşikleriyle (fetch, FormData, crypto, child_process) çözülüp çözülmediğini düşün; native modül **ekleme** (Termux bionic'te derlenmez).
- **Beden = Termux native**, **9remote = proot**. Beden'e proot'a özgü yol ekleme.
- **Güvenlik varsayılanları değişmez:** telefon/sms/konum/kisiler/kabuk izinleri kapalı gelir; `/saglik` dışındaki uçlar token ister; beden yalnızca 127.0.0.1 dinler.
- **LLM araçları** `beyin/araclar.mjs` içinde `arac(name, description, properties, required, calistir)` ile eklenir; `calistir` `{ metin, resim? }` döner, hata fırlatabilir (döngü yakalar). Tehlikeli araçlar (arama, SMS) izin kapısından geçer; kabuk aracı **verilmez**.
- **Görüşme motoru taşıyıcıdan bağımsız kalır:** `beyin/kopru/motor.mjs` içine WebSocket/Twilio'ya özgü kod koyma; yeni taşıyıcı = yeni dosya (`kopru/twilio.mjs`).
- **Testler:** `npm test` (node:test, sahte 9router + sahte cihaz). Yeni özellik → test. Gerçek ağ/donanım gerektiren şeyler test dışında, `docs/` içinde elle doğrulama listesine yazılır.
- **Ayar eklerken** `ortak/ayar.mjs` → `VARSAYILAN_AYAR` + ortam değişkeni eşlemesi + `.env.example` + `docs/kurulum.md`.
- Commit mesajları Türkçe, kısa, emir kipinde ("Görev özetine takip listesi ekle").

## Hızlı komutlar
```bash
npm test
node scripts/dev/sahte-ortam.mjs        # telefon olmadan panel: http://localhost:20131/?token=dev
npm run sohbet                          # terminalden asistan (gerçek 9router + beden gerekir)
bash scripts/termux/durum.sh            # telefonda: kim yaşıyor
bash scripts/termux/ses-testi.sh        # telefonda: ses gidiş hattı teşhisi (arama ÇALDIRMAZ; arama kapısını açar/kapar)
tail -f ~/.asistan/log/beyin.log
```
