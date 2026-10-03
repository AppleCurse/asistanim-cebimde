# Depo Temizlik ve Çer-Çöp Haritası
Tarih: 2026-10-03
Hazırlayan: Antigravity Ajanı

---

## 1. Dokümantasyon ve İfade Tutarlılığı Kontrolü

| Dosya | Durum | Tespit ve Gerekli Eylem |
|---|---|---|
| `README.md` | ✅ Güncel | Canlı VoIP araması, Fish Audio klon ses ve 7/24 çalışma tescillendi. |
| `docs/durum.md` | ✅ Güncel | "Sahada kanıtlananlar" başlığı altında VoIP ve 72+ saatlik çalışma kayda geçti. |
| `docs/telefon-gorusmesi.md` | ✅ Güncel | VoIP satırı "✅ Sahada canlı doğrulandı" olarak güncellendi. |
| `package.json` | ✅ Güncel | Prototip ibaresi kaldırıldı; sahada doğrulanmış sistem açıklaması işlendi. |
| `AGENTS.md` | ✅ Güncellendi | **Satır 3:** Canlı VoIP araması, Fish Audio ve 72+ saatlik Redmi Note 8 kararlılığı işlendi. |
| `scripts/omer-ara.mjs` | ✅ Güncellendi | **Satır 28-48:** Eski "doğrulanmadı" ibareleri kaldırıldı; canlı VoIP/SIP ve klon ses yetenekleri işlendi. |

---

## 2. Duplicate ve Mimari Kontrolü

* **`beden/kopru/` vs `beyin/kopru/`:**
  * İnceleme sonucu: `beden/kopru/` diye bir klasör **yoktur**. 
  * Köprü modülleri yalnızca `beyin/kopru/` (`motor.mjs`, `sip.mjs`, `tarayici.mjs`) altındadır. Mimari ayrım doğrudur, burada kod tekrarı yoktur.
* **Zadarma Test Betikleri Duplicate Analizi:**
  * `scripts/test-zadarma-callback.mjs`
  * `scripts/test-zadarma-callerid.mjs`
  * `scripts/test-zadarma-diag.mjs`
  * `scripts/test-zadarma-requirements.mjs`
  * `scripts/test-zadarma-stat.mjs`
  * **Bulgu:** 5 dosyanın 5'inde de aynı `buildZadarmaSignature` / MD5-HMAC imzalama mantığı ve sabit API KEY/SECRET değerleri kopyala-yapıştır yapılmıştır. Tek bir `scripts/zadarma-cli.mjs` altında birleştirilmeli ya da arşive kaldırılmalıdır.

---

## 3. Silinen ve Temizlenen 5 Atıl Dosya (Tamamlandı)

Canlı sistemin parçası olmayan, geçmiş tekil logları ayıklamak için açılmış aşağıdaki 5 atık dosya depodan kalıcı olarak silindi:

1. ✅ `scripts/find-beyin-call.mjs` (Silindi)
2. ✅ `scripts/find-beyin-call-after.mjs` (Silindi)
3. ✅ `scripts/find-beyin-call-details.mjs` (Silindi)
4. ✅ `scripts/read-log.mjs` (Silindi)
5. ✅ `scripts/find-call.mjs` (Silindi)

---

## 4. Pil ve Süreç Yükü (Termux / Android Tarafı)

* **`scripts/termux/servis.sh`:** 
  * Her 30 saniyede bir arka planda uyanıp `wc -c < $LOG_DOSYA` ile rotasyon kontrolü yapıyor. Bu kontrol Termux için makuldür; CPU tüketimi düşüktür.
* **Tehlike Noktası (Zombiler):**
  * `scripts/dev/sahte-ortam.mjs` veya test çalıştırmaları esnasında arka planda `ctrl_tcp` (port 4444) veya Node süreçleri `kill` edilmeden bırakılırsa, Termux arka planda uyanık kalarak pil tüketebilir.
  * `clean-restart.sh` betiği bu temizliği doğru yapmaktadır.

---

## 5. Uygulanan Eylemler (2026-10-03)

1. ✅ `AGENTS.md` satır 3 güncellendi (canlı saha gerçekleri işlendi).
2. ✅ `scripts/omer-ara.mjs` güncellendi ("doğrulanmadı" şablonu temizlendi).
3. ✅ 5 atık script (`find-*.mjs`, `read-log.mjs`) depodan silindi.
4. ✅ Temizlik haritası tescillendi.
