#!/data/data/com.termux/files/usr/bin/bash
# Kim yaşıyor, kim ölü? Panel adresini ve tokenı da gösterir.
set -u
export PREFIX="${PREFIX:-/data/data/com.termux/files/usr}"
export HOME="${TERMUX_HOME:-/data/data/com.termux/files/home}"
export PATH="$PREFIX/bin:$PATH"
[[ -f "$PREFIX/lib/libtermux-exec.so" ]] && export LD_PRELOAD="$PREFIX/lib/libtermux-exec.so"

export ASISTAN_HOME="${ASISTAN_HOME:-$HOME/.asistan}"
RUN="$ASISTAN_HOME/run"
REPO_DIR="$(cd "$(dirname "$(readlink -f "$0" 2>/dev/null || echo "$0")")/../.." && pwd)"
[[ -f "$REPO_DIR/.env" ]] && { set -a; # shellcheck disable=SC1091
  source "$REPO_DIR/.env"; set +a; }

BEDEN_PORT="${BEDEN_PORT:-20130}"; BEYIN_PORT="${BEYIN_PORT:-20131}"
for ad in 9router beden beyin baresip 9remote; do
  if [[ -f "$RUN/$ad.pid" ]] && kill -0 "$(cat "$RUN/$ad.pid")" 2>/dev/null; then
    printf '  %-8s ✓ çalışıyor (pid %s)\n' "$ad" "$(cat "$RUN/$ad.child.pid" 2>/dev/null || cat "$RUN/$ad.pid")"
  else
    printf '  %-8s ✗ kapalı\n' "$ad"
  fi
done
echo
TOKEN="${BEYIN_TOKEN:-$(cat "$ASISTAN_HOME/beyin.token" 2>/dev/null || echo '?')}"
printf '  9router : %s\n' "$(curl -s -m 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:20128/ 2>/dev/null || echo 'yok')"
printf '  beden   : %s\n' "$(curl -s -m 3 http://127.0.0.1:$BEDEN_PORT/saglik 2>/dev/null || echo 'yok')"
printf '  beyin   : %s\n' "$(curl -s -m 2 -k "https://127.0.0.1:$BEYIN_PORT/api/durum?token=$TOKEN" 2>/dev/null | grep -q 'asistan' && echo 'ayakta' || echo 'yok')"
echo
SEMA=http; [[ -f "$ASISTAN_HOME/tls/cert.pem" ]] && SEMA=https
IP="$(ip -4 addr show wlan0 2>/dev/null | awk '/inet /{print $2}' | cut -d/ -f1)"
[[ -z "$IP" ]] && IP="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{print $7}')"
echo "  Panel (aynı Wi-Fi/Tailscale): $SEMA://${IP:-<telefon-ip>}:$BEYIN_PORT/?token=$TOKEN"
echo "  Loglar: $ASISTAN_HOME/log/   Durdur: bash $REPO_DIR/scripts/termux/durdur.sh"
