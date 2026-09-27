#!/data/data/com.termux/files/usr/bin/bash
# Termux'tan: proot Ubuntu içinde 9remote'u başlatır.
# Depo ve ~/.asistan içeriye bağlanır → 9remote'un IDE'sinden kodu düzenleyip loglara bakabilirsin.
# İlk çalıştırma etkileşimlidir (QR + Approve); sonrasında baslat.sh ENABLE_9REMOTE=1 ile arka planda tutar.
set -u
REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ASISTAN_HOME="${ASISTAN_HOME:-$HOME/.asistan}"
exec proot-distro login ubuntu --shared-tmp \
  --bind "$ASISTAN_HOME:/root/.asistan" \
  --bind "$REPO_DIR:/root/asistanim-cebimde" \
  -- bash -lc "cd /root/asistanim-cebimde && exec 9remote ${*:-}"
