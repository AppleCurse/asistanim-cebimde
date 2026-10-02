# Gerçek durum ve doğrulama kaydı

Bu dosya kaynakta bulunan yetenekleri, otomatik test kanıtını ve henüz sahada doğrulanmayanları ayırır. **Kod var** ifadesi **gerçek telefonda çalıştığı kanıtlandı** anlamına gelmez.

## Bu checkout'ta otomatik doğrulama

**Son doğrulama: 2026-10-02**

- `npm ci`: başarılı; eksik `ws` bağımlılığı kuruldu.
- `npm test`: **81 test geçti, 0 başarısız**.
- Depodaki `.mjs` dosyaları için `node --check`; shell betikleri için `bash -n`; JSON ve web manifesti için ayrıştırma kontrolü başarılı.
- `git diff --check` başarılı.
- Testler mock cihaz, sahte LLM/router ve betik düzeyinde taklitler kullanır; gerçek Android, SIP sağlayıcısı veya RTP hattı testi değildir.

Tarihsel bağlam: önceki ayrı inceleme ortamında 43 test geçti, 22 web/beyin testi eksik bağımlılık nedeniyle çalışmadı. Bu checkout'ta bağımlılık kurulunca önce 68/68, sonra ara değişikliklerde 69/69 elde edilmişti. Bunlar tarihsel skorlardır; güncel yerel sonuç **81/81**'dir.

## Kodlanmış ve test kapsamı bulunan çekirdek

| Alan | Kaynaktaki durum | Otomatik kanıt |
|---|---|---|
| Node.js beyin/beden mimarisi | Var | API, auth ve mock cihaz testleri |
| İzin kapıları ve token doğrulama | Var | Yetkisiz istek, sabit zamanlı karşılaştırma ve izin testleri; Android OS izni uygulama kapısını kendiliğinden açmaz |
| Panel oturumu | POST ile giriş; `HttpOnly` çerez, HTTPS'te `Secure` | Yanlış/doğru token, cookie ve URL-token reddi; token query/localStorage ile kullanılmaz |
| LLM istemcisi ve araç döngüsü | Var | Sahte sağlayıcıyla sohbet/tool-call testleri; 9router varsayılan, doğrudan endpoint için açık `ENABLE_9ROUTER=0` yapılandırması gerekir |
| Araçlar | **17 araç** | Şema ve akış testleri |
| Hafıza ve görev sistemi | Var; basit/yerel | Birim ve API testleri |
| Cebimon | Var; risk/kanıt/onay akışı | Plan, fail-closed değerlendirme ve onay testleri |
| PWA ve tarayıcı görüşmesi | Kodlanmış | HTTP/WebSocket, auth ve görüşme testleri; platform kurulum/arka plan davranışı mock ile doğrulanmaz |
| SIP/baresip köprüsü | Kodlanmış | Netstring, PCM/WAV, VAD/RMS, arama kapısı ve kuyruk testleri |
| Supervisor ve Termux betikleri | Kodlanmış | Shell syntax; `durum.sh` HTTP/TLS seçimi, boot-hook üretimi ve router başlatma politikası mock ile testli |
| 9router başlangıç parolası | Sabit parola yok; ilk parola rastgele ve `0600` dosyaya kalıcı yazılır | Üretim, kalıcılık ve dosya izinleri testli; gerçek 9router kurulumunda entegrasyon testi yapılmadı |

## Henüz sahada kanıtlanmayanlar

- Redmi Note 8'e kurulum ve gerçek Termux:API kamera/mikrofon/TTS çevrimi.
- Gerçek SIP hesabı + baresip + RTP + karşı taraf ile çift yönlü arama/ses.
- Android kilit ekranı, MIUI süreç öldürmesi, ısı/bellek/Wi-Fi etkileri ve **24 saat/7/24** dayanıklılık.
- PWA'nın gerçek cihaz/tarayıcı kombinasyonlarında kurulum, izin, TLS ve arka plan davranışı.
- 9router servisinin Android üzerinde arka planda veya kesintisiz çalışması.

Bu nedenle ürün durumu **güçlü teknik prototip / erken alfa**dır; üretim kalitesi, donanım uyumluluğu veya sürekli çalışma kanıtı iddia edilmez. README ve [kurulum notları](kurulum.md) tasarım önerilerini doğrulanmış saha bulgularından ayrı sunar.

## Henüz bulunmayan ya da eksik kabiliyetler

- Olay bus'ı, trigger/policy engine ve proaktif bildirim akışı.
- Gerçek scheduler ve tekrarlı görev yürütme.
- Sürekli algılama, wake-word ve otomatik alarm.
- Semantik/episodik hafıza ve çoklu kullanıcı profili.
- İnternet arama aracı. Tavily/Gemini için doğrudan kullanılmayan örnek ayarlar kaldırıldı; Gemini 9router üzerinden seçilebilir.

## İlk saha kanıtı için sıra

1. Redmi Note 8'de Termux → beden → beyin → LLM → kamera/mikrofon → TTS tam çevrimini kaydet ve tekrar et.
2. Tek bir kontrollü gerçek SIP görüşmesini gidiş/dönüş ses kanıtıyla doğrula.
3. Cihazı 24 saat çalıştır; süreç, RAM, sıcaklık, ağ ve izin kayıplarını kaydet.
4. Bu kanıtlardan sonra olay/scheduler işlerine geç.

Ayrıntılı yapılacak işler: [Yol haritası](yol-haritasi.md) · Kurulum: [Kurulum](kurulum.md) · Mimari: [Mimari](mimari.md).
