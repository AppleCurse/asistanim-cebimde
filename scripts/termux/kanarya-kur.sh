#!/data/data/com.termux/files/usr/bin/bash
# Ses kanalı kanarya testi: her gece 03:00 çalışır; kırmızı sonucu SMS ile bildirir.
set -u
REPO_DIR="$(cd "$(dirname "$(readlink -f "$0" 2>/dev/null || echo "$0")")/../.." && pwd)"
ASISTAN_HOME="${ASISTAN_HOME:-$HOME/.asistan}"
mkdir -p "$ASISTAN_HOME/log"
NUMARA="${KANARYA_SMS_NUMARA:-${1:-}}"
SATIR="0 3 * * * ASISTAN_HOME='$ASISTAN_HOME' KANARYA_SMS_NUMARA='$NUMARA' bash '$REPO_DIR/scripts/termux/kanarya-calistir.sh' >> '$ASISTAN_HOME/log/kanarya.log' 2>&1"
(crontab -l 2>/dev/null | grep -v 'kanarya-calistir.sh' || true; echo "$SATIR") | crontab -
echo "Kanarya kuruldu: her gece 03:00"
[[ -n "$NUMARA" ]] || echo "Uyarı SMS'i için: KANARYA_SMS_NUMARA=+905... bash $0"
