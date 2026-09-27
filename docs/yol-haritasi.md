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

## Faz 3 — VoIP köprüsü (gerçek arama)
- [ ] Taşıyıcı: Twilio Media Streams adaptörü (μ-law 8 kHz ↔ PCM, sunucu VAD, barge-in)
- [ ] Tünel: cloudflared (Termux arm64) veya küçük VPS röle
- [ ] Arama akışı: panelden onay → dış arama → görüşme → özet → bildirim + SMS raporu
- [ ] Sesli mesaj/robot menü tespiti (IVR): DTMF gönderme aracı
- [ ] Alternatif: SIP trunk + baresip (proot) araştırması
- [ ] Rıza/kayıt politikası ayarı; transkript saklama süresi

## Faz 4 — Yaşam
- [ ] Zamanlayıcılar: "yarın 9'da ara", tekrarlı görevler; görev kuyruğu ve yeniden deneme
- [ ] Günlük özet (aramalar, SMS, pil, olaylar) sabah bildirimi
- [ ] Bellek konsolidasyonu: `hafiza.md`'yi LLM ile periyodik sadeleştirme
- [ ] Çoklu kullanıcı/aile profili ve kişi bazlı üslup
- [ ] Panel PWA manifest + push bildirimleri (`web-push`)
- [ ] Yerel küçük model (llama.cpp, arm64) ile çevrimdışı asgari yanıt (isteğe bağlı)

## Açık sorular
1. LLM sağlayıcı önceliği: ücretsiz katman mı, kalite mi? (görüşmelerde gecikme kritik → hızlı model, örn. Groq/Gemini Flash)
2. VoIP için Twilio/Telnyx (uluslararası) mı, yerli SIP trunk mı? Aylık arama hacmi?
3. Yüz tanıma bulut görüntü modeliyle yeterli mi, yerel gömme şart mı? (mahremiyet)
4. 9router Termux'ta mı proot'ta mı kalsın? (bellek/ısı ölçümünden sonra karar)
