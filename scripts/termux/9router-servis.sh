#!/data/data/com.termux/files/usr/bin/bash
# 9router'ı TUI/menü olmadan arka plan servisi olarak Next.js doğrudan çalıştırır.
export PREFIX=/data/data/com.termux/files/usr
export HOME="${HOME:-/data/data/com.termux/files/home}"
export PATH="$PREFIX/bin:$PATH"
export LD_PRELOAD="$PREFIX/lib/libtermux-exec.so"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
if [[ -f "$REPO_DIR/.env" ]]; then
  chmod 600 "$REPO_DIR/.env" 2>/dev/null || true
  set -a
  source "$REPO_DIR/.env"
  set +a
fi

ROUTER_DIR="$PREFIX/lib/node_modules/9router/app"
SERVER_JS="$ROUTER_DIR/custom-server.js"
[[ -f "$SERVER_JS" ]] || SERVER_JS="$ROUTER_DIR/server.js"

if [[ ! -f "$SERVER_JS" ]]; then
  echo "9router app/server.js bulunamadı: $SERVER_JS" >&2
  exit 1
fi

export PORT="${ROUTER_PORT:-20128}"
export HOSTNAME="0.0.0.0"
export ASISTAN_HOME="${ASISTAN_HOME:-$HOME/.asistan}"
umask 077
INITIAL_PASSWORD="$(node "$SCRIPT_DIR/9router-password.mjs")" || {
  echo "9router başlangıç parolası hazırlanamadı." >&2
  exit 1
}
export INITIAL_PASSWORD
cd "$ROUTER_DIR"
exec node --max-old-space-size=512 "$SERVER_JS"
