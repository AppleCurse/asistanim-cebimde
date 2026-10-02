#!/data/data/com.termux/files/usr/bin/bash
# Kim yaşıyor, kim ölü? Panel adresini gösterir; erişim anahtarını URL/loglara koymaz.
set -u
export PREFIX="${PREFIX:-/data/data/com.termux/files/usr}"
export HOME="${TERMUX_HOME:-/data/data/com.termux/files/home}"
export PATH="$PREFIX/bin:$PATH"
[[ -f "$PREFIX/lib/libtermux-exec.so" ]] && export LD_PRELOAD="$PREFIX/lib/libtermux-exec.so"

REPO_DIR="$(cd "$(dirname "$(readlink -f "$0" 2>/dev/null || echo "$0")")/../.." && pwd)"
if [[ -f "$REPO_DIR/.env" ]]; then
  set -a; # shellcheck disable=SC1091
  source "$REPO_DIR/.env"; set +a
fi
export ASISTAN_HOME="${ASISTAN_HOME:-$HOME/.asistan}"
RUN="$ASISTAN_HOME/run"

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
TLS_DIZINI="$ASISTAN_HOME/tls"
SEMA=http
CURL_TLS=()
if [[ -f "$TLS_DIZINI/cert.pem" && -f "$TLS_DIZINI/key.pem" ]]; then
  SEMA=https
  CURL_TLS=(-k)
fi
printf '  9router : %s\n' "$(curl -s -m 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:20128/ 2>/dev/null || echo 'yok')"
printf '  beden   : %s\n' "$(curl -s -m 3 "http://127.0.0.1:$BEDEN_PORT/saglik" 2>/dev/null || echo 'yok')"
BEYIN_YANIT="$(curl -s -m 2 "${CURL_TLS[@]}" -H "Authorization: Bearer $TOKEN" "$SEMA://127.0.0.1:$BEYIN_PORT/api/durum" 2>/dev/null || true)"
printf '  beyin   : %s\n' "$(grep -q 'asistan' <<< "$BEYIN_YANIT" && echo 'ayakta' || echo 'yok')"
echo
IP="$(ip -4 addr show wlan0 2>/dev/null | awk '/inet /{print $2}' | cut -d/ -f1)"
[[ -z "$IP" ]] && IP="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{print $7}')"
echo "  Yerel Panel (Aynı Wi-Fi): $SEMA://${IP:-<telefon-ip>}:$BEYIN_PORT/"
TUNEL_URL="${CLOUDFLARED_PUBLIC_URL:-$(grep -oE 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' "$ASISTAN_HOME/log/tunel.log" 2>/dev/null | tail -1)}"
if [[ -n "$TUNEL_URL" ]]; then
  TUNEL_URL="$(node -e 'try { const u = new URL(process.argv[1]); u.username = ""; u.password = ""; u.search = ""; u.hash = ""; process.stdout.write(u.toString().replace(/\/$/, "")); } catch {}' "$TUNEL_URL" 2>/dev/null || true)"
fi
[[ -n "$TUNEL_URL" ]] && echo "  Online Panel (Dünyanın her yerinden): $TUNEL_URL/"
echo "  Giriş anahtarı: cat $ASISTAN_HOME/beyin.token  (anahtarı URL'ye eklemeyin)"
echo "  Loglar: $ASISTAN_HOME/log/   Durdur: bash $REPO_DIR/scripts/termux/durdur.sh"
