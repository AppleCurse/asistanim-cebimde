#!/data/data/com.termux/files/usr/bin/bash
set -u
REPO_DIR="$(cd "$(dirname "$(readlink -f "$0" 2>/dev/null || echo "$0")")/../.." && pwd)"
if bash "$REPO_DIR/scripts/termux/ses-testi.sh"; then
  echo "kanarya: yeşil"
else
  echo "kanarya: KIRMIZI"
  if [[ -n "${KANARYA_SMS_NUMARA:-}" ]] && command -v termux-sms-send >/dev/null 2>&1; then
    termux-sms-send -n "$KANARYA_SMS_NUMARA" "Asistanım Cebimde: ses kanalı testi KIRMIZI. Aramalar güvenlik için kapatıldı."
  fi
  exit 1
fi
