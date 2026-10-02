#!/data/data/com.termux/files/usr/bin/bash
# Servisleri durdurur (önce döngüyü, sonra süreci — böylece yeniden doğmaz).
#   bash scripts/termux/durdur.sh            # hepsi
#   bash scripts/termux/durdur.sh beyin      # sadece beyin
set -u
export PREFIX="${PREFIX:-/data/data/com.termux/files/usr}"
export HOME="${TERMUX_HOME:-/data/data/com.termux/files/home}"
export PATH="/data/data/com.termux/files/usr/bin:$PREFIX/bin:$PATH"
unset LD_PRELOAD

REPO_DIR="$(cd "$(dirname "$(readlink -f "$0" 2>/dev/null || echo "$0")")/../.." && pwd)"
if [[ -f "$REPO_DIR/.env" ]]; then
  set -a; # shellcheck disable=SC1091
  source "$REPO_DIR/.env"; set +a
fi
export ASISTAN_HOME="${ASISTAN_HOME:-$HOME/.asistan}"
RUN="$ASISTAN_HOME/run"
LISTE=("$@")
[[ ${#LISTE[@]} -eq 0 ]] && LISTE=(9remote baresip beyin beden 9router)
for ad in "${LISTE[@]}"; do
  if [[ -f "$RUN/$ad.pid" ]]; then
    kill "$(cat "$RUN/$ad.pid")" 2>/dev/null && echo "  $ad döngüsü durduruldu"
  fi
  if [[ -f "$RUN/$ad.child.pid" ]]; then
    kill "$(cat "$RUN/$ad.child.pid")" 2>/dev/null && echo "  $ad süreci durduruldu"
  fi
  rm -f "$RUN/$ad.pid" "$RUN/$ad.child.pid"
done
[[ $# -eq 0 ]] && termux-wake-unlock 2>/dev/null
echo "bitti"
