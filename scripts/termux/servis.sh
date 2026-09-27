#!/data/data/com.termux/files/usr/bin/bash
# Tek bir servisi "ölürse yeniden doğur" döngüsünde çalıştırır. baslat.sh tarafından kullanılır.
#   servis.sh <ad> <komut...>
# PID'ler: $ASISTAN_HOME/run/<ad>.pid (bu döngü) ve <ad>.child.pid (asıl süreç)
set -u
AD="$1"; shift
ASISTAN_HOME="${ASISTAN_HOME:-$HOME/.asistan}"
RUN="$ASISTAN_HOME/run"; LOG="$ASISTAN_HOME/log"
mkdir -p "$RUN" "$LOG"
echo $$ > "$RUN/$AD.pid"
COCUK=""

temizle() {
  trap - TERM INT
  [[ -n "$COCUK" ]] && kill "$COCUK" 2>/dev/null
  # yalnızca kendi kayıtlarımızı sil (yeni bir döngü başlatılmış olabilir)
  [[ "$(cat "$RUN/$AD.pid" 2>/dev/null)" == "$$" ]] && rm -f "$RUN/$AD.pid" "$RUN/$AD.child.pid"
  exit 0
}
trap temizle TERM INT

BEKLE=3
while true; do
  echo "$(date -Is) [servis] $AD başlatılıyor: $*" >> "$LOG/$AD.log"
  BASLANGIC=$(date +%s)
  "$@" >> "$LOG/$AD.log" 2>&1 &
  COCUK=$!
  echo "$COCUK" > "$RUN/$AD.child.pid"
  wait "$COCUK"; KOD=$?
  COCUK=""
  # 60 sn'den uzun yaşadıysa sağlıklıydı: bekleme süresini sıfırla
  (( $(date +%s) - BASLANGIC > 60 )) && BEKLE=3
  echo "$(date -Is) [servis] $AD çıktı (kod $KOD), ${BEKLE}s sonra yeniden" >> "$LOG/$AD.log"
  sleep "$BEKLE" & wait $!   # arka planda uyu ki TERM sinyali hemen işlensin
  BEKLE=$(( BEKLE < 60 ? BEKLE * 2 : 60 ))
done
