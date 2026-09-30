#!/data/data/com.termux/files/usr/bin/bash
# Tek bir servisi "ölürse yeniden doğur" döngüsünde çalıştırır. baslat.sh tarafından kullanılır.
#   servis.sh <ad> <komut...>
# PID'ler: $ASISTAN_HOME/run/<ad>.pid (bu döngü) ve <ad>.child.pid (asıl süreç)
set -u
export PREFIX="${PREFIX:-/data/data/com.termux/files/usr}"
export HOME="${TERMUX_HOME:-/data/data/com.termux/files/home}"
export PATH="/data/data/com.termux/files/usr/bin:/data/data/com.termux/files/usr/bin/applets:$PREFIX/bin:$PATH"
unset LD_PRELOAD

AD="$1"; shift
ASISTAN_HOME="${ASISTAN_HOME:-$HOME/.asistan}"
RUN="$ASISTAN_HOME/run"; LOG="$ASISTAN_HOME/log"
mkdir -p "$RUN" "$LOG"
echo $$ > "$RUN/$AD.pid"
COCUK=""
ROTATOR=""
LOG_DOSYA="$LOG/$AD.log"
LOG_LIM=${ASISTAN_LOG_LIMIYI:-5242880} # varsayılan 5 MiB; .1 yedeğiyle en fazla ~10 MiB
[[ "$LOG_LIM" =~ ^[0-9]+$ ]] || LOG_LIM=5242880
(( LOG_LIM >= 65536 )) || LOG_LIM=5242880

loguDondur() {
  [[ -f "$LOG_DOSYA" ]] || return 0
  local boyut
  boyut=$(wc -c < "$LOG_DOSYA") || return 0
  (( boyut > LOG_LIM )) || return 0
  local gecici="$LOG_DOSYA.1.tmp"
  tail -c "$LOG_LIM" "$LOG_DOSYA" > "$gecici" || { rm -f "$gecici"; return 0; }
  mv -f "$gecici" "$LOG_DOSYA.1"
  : > "$LOG_DOSYA"
}

rotasyonDongusu() {
  local uyku_pid=
  trap '[[ -n "$uyku_pid" ]] && kill "$uyku_pid" 2>/dev/null; exit 0' TERM INT
  while kill -0 "$COCUK" 2>/dev/null; do
    sleep 30 & uyku_pid=$!
    wait "$uyku_pid" || break
    uyku_pid=
    loguDondur
  done
}

temizle() {
  trap - TERM INT
  [[ -n "$ROTATOR" ]] && kill "$ROTATOR" 2>/dev/null
  [[ -n "$COCUK" ]] && kill "$COCUK" 2>/dev/null
  # yalnızca kendi kayıtlarımızı sil (yeni bir döngü başlatılmış olabilir)
  [[ "$(cat "$RUN/$AD.pid" 2>/dev/null)" == "$$" ]] && rm -f "$RUN/$AD.pid" "$RUN/$AD.child.pid"
  exit 0
}
trap temizle TERM INT

BEKLE=3
while true; do
  loguDondur
  echo "$(date -Is) [servis] $AD başlatılıyor: $*" >> "$LOG_DOSYA"
  BASLANGIC=$(date +%s)
  "$@" >> "$LOG_DOSYA" 2>&1 &
  COCUK=$!
  echo "$COCUK" > "$RUN/$AD.child.pid"
  rotasyonDongusu & ROTATOR=$!
  wait "$COCUK"; KOD=$?
  kill "$ROTATOR" 2>/dev/null || true
  wait "$ROTATOR" 2>/dev/null || true
  ROTATOR=""; COCUK=""
  loguDondur
  # 60 sn'den uzun yaşadıysa sağlıklıydı: bekleme süresini sıfırla
  (( $(date +%s) - BASLANGIC > 60 )) && BEKLE=3
  echo "$(date -Is) [servis] $AD çıktı (kod $KOD), ${BEKLE}s sonra yeniden" >> "$LOG/$AD.log"
  sleep "$BEKLE" & wait $!   # arka planda uyu ki TERM sinyali hemen işlensin
  BEKLE=$(( BEKLE < 60 ? BEKLE * 2 : 60 ))
done
