#!/data/data/com.termux/files/usr/bin/bash
# Ses kanalı kanarya testi: her gece 03:00 çalışır; kırmızı sonucu SMS ile bildirir.
set -u
REPO_DIR="$(cd "$(dirname "$(readlink -f "$0" 2>/dev/null || echo "$0")")/../.." && pwd)"
ASISTAN_HOME="${ASISTAN_HOME:-$HOME/.asistan}"
mkdir -p "$ASISTAN_HOME/log"
NUMARA="${KANARYA_SMS_NUMARA:-${1:-}}"
# Cron komutu kabuk kodudur: değerleri tek tırnakla quote et, satır sonu/% girişi reddet.
case "$ASISTAN_HOME$REPO_DIR" in *[$'\r\n%']*) echo "Hata: cron yollarında satır sonu veya % kullanılamaz." >&2; exit 1 ;; esac
if [[ -n "$NUMARA" && ! "$NUMARA" =~ ^\+?[0-9]{5,20}$ ]]; then
  echo "Hata: SMS numarası + ve rakamlardan oluşmalı (5–20 rakam)." >&2; exit 1
fi
cron_quote() { local v=$1; v=${v//\'/\'\\\'\'}; printf "'%s'" "$v"; }
Q_HOME=$(cron_quote "$ASISTAN_HOME")
Q_NUMARA=$(cron_quote "$NUMARA")
Q_SCRIPT=$(cron_quote "$REPO_DIR/scripts/termux/kanarya-calistir.sh")
Q_LOG=$(cron_quote "$ASISTAN_HOME/log/kanarya.log")
SATIR="0 3 * * * ASISTAN_HOME=$Q_HOME KANARYA_SMS_NUMARA=$Q_NUMARA bash $Q_SCRIPT >> $Q_LOG 2>&1"
(crontab -l 2>/dev/null | grep -v 'kanarya-calistir.sh' || true; echo "$SATIR") | crontab -
echo "Kanarya kuruldu: her gece 03:00"
[[ -n "$NUMARA" ]] || echo "Uyarı SMS'i için: KANARYA_SMS_NUMARA=+905... bash $0"
