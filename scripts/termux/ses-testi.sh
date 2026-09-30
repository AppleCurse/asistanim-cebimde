#!/data/data/com.termux/files/usr/bin/bash
# SES GİDİŞ HATTI (mic.raw) TEŞHİSİ — telefonu ÇALDIRMADAN ses kanalını doğrular.
#
# Kullanım:  bash scripts/termux/ses-testi.sh
# Çıkış:     yeşil → $ASISTAN_HOME/run/ses-kanali-ok yazılır (arama kapısı açılır)
#            kırmızı → işaret kaldırılır (aramalar kapalı kalır, kimse çaldirilmaz)
#
# Bu betik, "run-as com.termux ... / proc fd / timeout head / arecord" tek tek komut
# listesinin Termux içi karşılığıdır; 3 adımı sırayla çalıştırıp kanıtı basar:
#   1) Ölü boru kontrolü  — beyin fd'leri (deleted) mı, inode/path uyuşuyor mu?
#   2) Besleyici canlı mı — 2 sn'de mic.raw'dan 3200 bayt akıyor mu?
#                         (besleyici yalnızca çağrı sırasında çalışır; çağrı yokken "uykuda" normaldir)
#   3) ALSA mikrofon testi — baresip geçici durdurulur, 440 Hz tını basılır, arecord yakalar
# Arama/SIP ÇALDIRMAZ; sadece borular + ALSA katmanını sınar.
# Acil bypass (arama kapısını elle açmak için): SES_KANALI_KAPISI=0
set -u
export PREFIX="${PREFIX:-/data/data/com.termux/files/usr}"
export HOME="${TERMUX_HOME:-/data/data/com.termux/files/home}"
export PATH="/data/data/com.termux/files/usr/bin:$PREFIX/bin:$PATH"
unset LD_PRELOAD

export ASISTAN_HOME="${ASISTAN_HOME:-$HOME/.asistan}"
REPO_DIR="$(cd "$(dirname "$(readlink -f "$0" 2>/dev/null || echo "$0")")/../.." && pwd)"
ROOTFS_TMP="/data/data/com.termux/files/usr/var/lib/proot-distro/containers/ubuntu/rootfs/tmp"
[[ -d "$ROOTFS_TMP" ]] || ROOTFS_TMP="/data/data/com.termux/files/usr/var/lib/proot-distro/installed-rootfs/ubuntu/tmp"
[[ -d "$ROOTFS_TMP" ]] || ROOTFS_TMP="/tmp"
MIC="$ROOTFS_TMP/mic.raw"
SPK="$ROOTFS_TMP/spk.raw"
ISARET="$ASISTAN_HOME/run/ses-kanali-ok"
BEYIN_LOG="$ASISTAN_HOME/log/beyin.log"
BARESIP_LOG="$ASISTAN_HOME/log/baresip.log"

SORUN=0   # 0 = yeşil
adim() { echo; echo "▶ $1"; }
tamam() { echo "  ✓ $1"; }
hata()  { echo "  ✗ $1"; SORUN=1; }
uyari() { echo "  ! $1"; }

echo "════════════════════════════════════════════════"
echo " Ses gidiş hattı teşhisi (arama ÇALDIRILMAZ)"
echo " mic.raw : $MIC"
echo " spk.raw : $SPK"
echo "════════════════════════════════════════════════"

# ───────────────────────────────────────────────
# 1) Ölü boru kontrolü (fd ↔ dosya uyuşması)
# ───────────────────────────────────────────────
adim "1) Ölü boru kontrolü — beyin fd'leri"
BEYIN_PID="$(cat "$RUN/beyin.child.pid" 2>/dev/null || pgrep -f '^node.*beyin' 2>/dev/null | tail -1 || true)"
if [[ -z "$BEYIN_PID" ]]; then
  uyari "beyin süreci bulunamadı (node.*beyin) — fd kontrolü atlandı"
else
  echo "  beyin pid: $BEYIN_PID"
  ls -l "/proc/$BEYIN_PID/fd" 2>/dev/null | grep -E "mic\.raw|spk\.raw" || uyari "beyin fd'lerinde mic.raw/spk.raw görünmüyor"
  for f in mic.raw spk.raw; do
    yol="$ROOTFS_TMP/$f"
    if [[ ! -p "$yol" ]]; then
      hata "$f FIFO değil/yok: $yol"
      continue
    fi
    dosya_inode="$(stat -c %i "$yol" 2>/dev/null || echo '?')"
    fd_bulundu=0
    for link in /proc/"$BEYIN_PID"/fd/*; do
      hedef="$(readlink "$link" 2>/dev/null || true)"
      [[ "$hedef" == *"$f"* ]] || continue
      fd_bulundu=1
      if [[ "$hedef" == *"(deleted)"* ]]; then
        hata "$f fd'si KOPUK (deleted): $hedef"
      else
        fd_inode="$(stat -c %i "$link" 2>/dev/null || echo '?')"
        if [[ "$fd_inode" != "$dosya_inode" ]]; then
          hata "$f inode uyuşmazlığı: fd=$fd_inode dosya=$dosya_inode (beyin eski boruya yapışık)"
        else
          tamam "$f fd'si yola bağlı (inode $dosya_inode)"
        fi
      fi
    done
    [[ $fd_bulundu -eq 1 ]] || hata "$f için beyin fd'si yok — beyin boruyu hiç açamamış"
  done
  if [[ $SORUN -ne 0 ]]; then
    echo
    uyari "Sorun bulundu — ÇÖZÜM: durdur.sh + baslat.sh İKİSİ BİRLİKTE (tek tek ASLA). Uygulanıyor..."
    bash "$REPO_DIR/scripts/termux/durdur.sh"
    sleep 1
    bash "$REPO_DIR/scripts/termux/baslat.sh"
    sleep 2
    BEYIN_PID="$(cat "$RUN/beyin.child.pid" 2>/dev/null || pgrep -f '^node.*beyin' 2>/dev/null | tail -1 || true)"
    echo "  Yeniden kontrol (beyin pid: ${BEYIN_PID:-yok})..."
    KIRIK=0
    if [[ -z "$BEYIN_PID" ]]; then
      KIRIK=1
    else
      for f in mic.raw spk.raw; do
        if ! ls -l "/proc/$BEYIN_PID/fd" 2>/dev/null | grep -E "mic\.raw|spk\.raw" | grep -vq "(deleted)"; then
          KIRIK=1
        fi
      done
    fi
    if [[ $KIRIK -eq 0 ]]; then
      tamam "Yeniden başlatma sonrası fd'ler temiz (adım 2-3 nihai kararı verecek)"
    else
      hata "Yeniden başlatma sonrası fd'ler hâlâ sorunlu"
    fi
  fi
fi

# ───────────────────────────────────────────────
# 2) Besleyici canlı mı? (2 sn'de 3200 bayt)
# ───────────────────────────────────────────────
adim "2) Besleyici canlılık — 2 sn'de mic.raw'dan bayt akışı"
if [[ ! -p "$MIC" ]]; then
  hata "mic.raw yok: $MIC"
else
  BAYT="$(timeout 2 head -c 3200 "$MIC" 2>/dev/null | wc -c | tr -d ' ')"
  echo "  okunan: $BAYT / 3200 bayt"
  # Aktif çağrı var mı? (besleyici yalnızca çağrı sırasında yazar — çağrı yokken sessizlik normaldir)
  CAGRI_VAR=0
  if [[ -f "$BEYIN_LOG" ]]; then
    SON_AKTIF="$(grep -n 'ÇAĞRI AKTİF' "$BEYIN_LOG" 2>/dev/null | tail -1 | cut -d: -f1)"
    SON_KAPANIS="$(grep -nE 'ÇAĞRI SONLANDI|Arama tamamlandı' "$BEYIN_LOG" 2>/dev/null | tail -1 | cut -d: -f1)"
    [[ -n "$SON_AKTIF" && ( -z "$SON_KAPANIS" || "$SON_AKTIF" -gt "$SON_KAPANIS" ) ]] && CAGRI_VAR=1
  fi
  if [[ "$BAYT" == "3200" ]]; then
    tamam "besleyici yaşıyor (sorun varsa ALSA/RTP tarafında — adım 3'e bak)"
  elif [[ "$BAYT" == "0" && $CAGRI_VAR -eq 0 ]]; then
    uyari "besleyici uykuda (aktif çağrı yok) — besleyici çağrı dışında yazmaz, NORMAL. Nihai karar adım 3'te"
  elif [[ "$BAYT" == "0" ]]; then
    hata "besleyici ÖLÜ — aktif çağrı var ama mic.raw'a hiç bayt gelmiyor (beyin.log'a bak)"
  else
    uyari "kısmi akış: $BAYT bayt — besleyici takılıyor olabilir"
  fi
fi

# ───────────────────────────────────────────────
# 3) ALSA mikrofon testi (baresip geçici durdurulur, arama yapılmaz)
# ───────────────────────────────────────────────
adim "3) ALSA mikrofon testi — 440 Hz tını → mic.raw → arecord"
if ! command -v proot-distro >/dev/null 2>&1; then
  uyari "proot-distro yok — ALSA testi atlandı (yalnız Termux tarafı doğrulandı)"
else
  bash "$REPO_DIR/scripts/termux/durdur.sh" baresip
  sleep 0.5

  proot-distro login ubuntu -- bash -c 'command -v arecord >/dev/null 2>&1 || apt-get install -y alsa-utils' || \
    uyari "alsa-utils kurulamadı — arecord yoksa test yapılamaz"

  echo "  Termux: 3 sn boyunca 440 Hz tını basılıyor (8000Hz s16le, 20 ms'de bir 320 bayt)..."
  # Not: 8000Hz s16le mono 20 ms = 320 bayt (besleyiciyle aynı biçim; 160 bayt olsaydı 8-bit olurdu)
  node - "$MIC" <<'NODEEOF' &
const fs = require('node:fs');
const yol = process.argv[2];
let fd;
try { fd = fs.openSync(yol, fs.constants.O_RDWR); } catch (e) { console.error('mic.raw açılamadı:', e.message); process.exit(1); }
const Hz = 440, ORNEK = 8000, PARCA = 320; // 20 ms @ 8 kHz s16le mono
const t0 = Date.now();
let t = 0;
const aralik = setInterval(() => {
  const buf = Buffer.alloc(PARCA);
  for (let i = 0; i < PARCA; i += 2) {
    buf.writeInt16LE(Math.round(20000 * Math.sin(2 * Math.PI * Hz * t / ORNEK)), i);
    t++;
  }
  try { fs.writeSync(fd, buf); } catch {}
  if (Date.now() - t0 >= 3000) { clearInterval(aralik); try { fs.closeSync(fd); } catch {} }
}, 20);
NODEEOF
  TINI_PID=$!

  echo "  proot: arecord -D mic (3 sn) çalıştırılıyor..."
  proot-distro login --bind /dev/zero:/dev/full ubuntu -- bash -c 'arecord -D mic -r 8000 -f S16_LE -c 1 -t raw -d 3 /tmp/deneme.pcm' || \
    hata "arecord çalışmadı — ALSA pcm.mic tanımı açılamıyor"
  wait "$TINI_PID" 2>/dev/null

  DENEME="$ROOTFS_TMP/deneme.pcm"
  if [[ -f "$DENEME" ]]; then
    echo "  Ölçüm:"
    ls -l "$DENEME"
    od -A d -t d2 "$DENEME" | head
    MINMAX="$(od -A n -t d2 "$DENEME" | awk '{for(i=1;i<=NF;i++){if(m==""||$i<m)m=$i; if(M==""||$i>M)M=$i}} END{print m+0, M+0}')"
    MIN="${MINMAX%% *}"; MAX="${MINMAX##* }"
    echo "  min=$MIN max=$MAX"
    if awk -v min="$MIN" -v max="$MAX" 'BEGIN { m=(min<0?-min:min); M=(max<0?-max:max); exit !(m>5000 || M>5000) }'; then
      tamam "ALSA mikrofon yakalama SAĞLAM (±20000 civarı salınım var) → sorun baresip RTP gönderiminde olabilir"
    else
      hata "ALSA mikrofon yakalama ÖLÜ/sessiz (salınım yok: min=$MIN max=$MAX)"
      echo "      → .asoundrc'deki pcm.mic tanımını yeniden kur: bash scripts/proot/baresip-kur.sh"
      echo "      → hâlâ olmazsa 'type file' yerine 'type raw' + 'plug' dene ya da proot'a ALSA loopback kur"
    fi
  else
    hata "deneme.pcm oluşmadı — ALSA yakalama hiç veri üretmedi (pcm.mic infile ölü)"
  fi

  echo "  baresip.log son satırları:"
  grep -iE "audio|alsa|read|error|eof" "$BARESIP_LOG" 2>/dev/null | tail -40 || echo "  (baresip.log yok/boş)"

  echo "  baresip yeniden başlatılıyor..."
  bash "$REPO_DIR/scripts/termux/baslat.sh"
fi

# ───────────────────────────────────────────────
# SONUÇ — arama kapısı bu işarete bağlı
# ───────────────────────────────────────────────
echo
echo "════════════════════════════════════════════════"
mkdir -p "$ASISTAN_HOME/run"
if [[ $SORUN -eq 0 ]]; then
  touch "$ISARET"
  echo " ✅ SES TESTİ YEŞİL — arama kapısı AÇILDI ($ISARET)"
else
  rm -f "$ISARET"
  echo " ❌ SES TESTİ KIRMIZI — arama kapısı KAPALI kalacak (kullanıcı ÇALDIRILMAYACAK)"
  echo "    Beyin logu: grep -iE 'mic.raw|SES KANALI' \"$BEYIN_LOG\" | tail -30"
fi
echo "════════════════════════════════════════════════"
exit $SORUN
