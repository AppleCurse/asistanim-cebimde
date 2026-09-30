# Yol haritası

## Faz 0 — İskelet ✅ (v0.1.0)
- [x] Ortak ayar/tokens/log (`~/.asistan`)
- [x] Beden: Termux:API HTTP köprüsü, izin modeli, sahte cihaz
- [x] Beyin: 9router istemcisi (sohbet, STT, TTS), araç kullanan ajan döngüsü, kalıcı hafıza
- [x] Görev sistemi: talimat → brifing → kişilik → özet
- [x] Görüşme motoru + tarayıcı yazılım telefonu (Web Speech / sunucu sesi, barge-in, bitiş etiketi)
- [x] Web paneli (sohbet, göz, söylet, görevler, hafıza) + giriş
- [x] Termux scriptleri: kur, baslat/durdur/durum, servis döngüsü, Termux:Boot, TLS
- [x] proot Ubuntu + 9remote kurulumu
- [x] 22 test (sahte 9router ile uçtan uca)
- [x] İndirilebilir sürüm: GitHub release (zip/tar.gz) + tek satır `indir-kur.sh` + `scripts/dev/paketle.sh`

## Faz 1 — Telefonda canlandırma
- [ ] Redmi Note 8'de gerçek kurulum; `termux-camera-photo` süre/çözünürlük, `termux-microphone-record` format doğrulaması
- [ ] Android TTS Türkçe ses seçimi (`termux-tts-engines`) ve hız/ton ayarı
- [ ] Ekran kilitliyken kamera davranışı; gerekirse "ekran karartılmış ama kilitsiz" moduna geçiş
- [ ] Tailscale ile dışarıdan erişim + sertifika yenileme
- [ ] 24 saat dayanıklılık: bellek, ısı, MIUI öldürmeleri → `durum.sh`'a ısı/bellek raporu
- [ ] 9router için `NODE_OPTIONS` bellek sınırı ve düşük bellekte önce onu yeniden başlatma
- [ ] `termux-notification` ile günlük "yaşıyorum" kalp atışı; ölürse cebindekine SMS (eski hattan)

## Faz 2 — Duyular
- [ ] Yüz tanıma: kayıtlı kişiler (`~/.asistan/kisiler/<ad>/*.jpg`) → görüntü modeline referans + aday eşleştirme; sonra yerel gömme (opsiyonel)
- [ ] QR/barkod: `zbarimg` (var) → aksiyon (Wi-Fi QR'ı bağlan, URL'yi özetle)
- [ ] Yazı okuma (OCR) görüntü modeliyle; fatura/tabela akışları
- [ ] Olay tetikleyicileri: hareket/ses eşiği → fotoğraf → "kim geldi?" bildirimi
- [ ] Uyandırma kelimesi (yerel, hafif) → `dinle` → yanıt; hoparlör modunda ev asistanı
- [ ] Sesli bildirim: gelen SMS/arama kayıtlarını özetleyip söyleme

## Faz 3 — VoIP köprüsü (gerçek arama) 🔄
- [x] **SIP trunk + baresip (proot) — UYGULANDI:** Zadarma hesabı, ALSA dosya köprüsü (`mic.raw`/`spk.raw` FIFO), duvar saatine kilitli PCM besleyici, adaptif VAD + yankı kapısı + barge-in, ctrl_tcp arama kontrolü
- [x] Ses kanalı gözcüsü (`⚠️ SES KANALI ÖLÜ`), besleyici kendi kendine iyileştirme, arama kapısı (ses testi yeşil olmadan çaldırmaz) + `scripts/termux/ses-testi.sh` teşhisi
- [x] Arama akışı: panelden onay → VoIP dış arama → görüşme → özet → hafıza (görev kartı: 📳 VoIP'tan ara)
- [ ] Sesli mesaj/robot menü tespiti (IVR): DTMF gönderme aracı
- [ ] Alternatif: Twilio Media Streams adaptörü (μ-law 8 kHz ↔ PCM) — yedek taşıyıcı
- [ ] Rıza/kayıt politikası ayarı; transkript saklama süresi (şimdilik: transkript silinebilir — görev kartı "Kaydı sil")

## Faz 4 — Yaşam
- [ ] Zamanlayıcılar: "yarın 9'da ara", tekrarlı görevler; görev kuyruğu ve yeniden deneme
- [ ] Günlük özet (aramalar, SMS, pil, olaylar) sabah bildirimi
- [ ] Bellek konsolidasyonu: `hafiza.md`'yi LLM ile periyodik sadeleştirme
- [ ] Çoklu kullanıcı/aile profili ve kişi bazlı üslup
- [x] Panel PWA manifest + servis çalışanı (ana ekrana kurulum)
- [ ] Push bildirimleri (`web-push`)
- [ ] Yerel küçük model (llama.cpp, arm64) ile çevrimdışı asgari yanıt (isteğe bağlı)

## Açık sorular
1. LLM sağlayıcı önceliği: ücretsiz katman mı, kalite mi? (görüşmelerde gecikme kritik → hızlı model, örn. Groq/Gemini Flash)
2. VoIP için Twilio/Telnyx (uluslararası) mı, yerli SIP trunk mı? Aylık arama hacmi?
3. Yüz tanıma bulut görüntü modeliyle yeterli mi, yerel gömme şart mı? (mahremiyet)
4. 9router Termux'ta mı proot'ta mı kalsın? (bellek/ısı ölçümünden sonra karar)
