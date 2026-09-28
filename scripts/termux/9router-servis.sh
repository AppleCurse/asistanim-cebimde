#!/data/data/com.termux/files/usr/bin/bash
# 9router'ı TUI/menü olmadan arka plan servisi olarak Next.js doğrudan çalıştırır.
export PREFIX=/data/data/com.termux/files/usr
export HOME="${HOME:-/data/data/com.termux/files/home}"
export PATH="$PREFIX/bin:$PATH"
export LD_PRELOAD="$PREFIX/lib/libtermux-exec.so"

ROUTER_DIR="$PREFIX/lib/node_modules/9router/app"
SERVER_JS="$ROUTER_DIR/custom-server.js"
[[ -f "$SERVER_JS" ]] || SERVER_JS="$ROUTER_DIR/server.js"

if [[ ! -f "$SERVER_JS" ]]; then
  echo "9router app/server.js bulunamadı: $SERVER_JS" >&2
  exit 1
fi

export PORT="${ROUTER_PORT:-20128}"
export HOSTNAME="0.0.0.0"
export INITIAL_PASSWORD="${INITIAL_PASSWORD:-asistan123}"
cd "$ROUTER_DIR"
exec node --max-old-space-size=512 "$SERVER_JS"
