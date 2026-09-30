#!/data/data/com.termux/files/usr/bin/bash
# Cloudflare named tunnel provides a stable URL; quick tunnel is a temporary development fallback.
set -u
export PATH=/data/data/com.termux/files/usr/bin:$PATH
REPO_DIR="$(cd "$(dirname "$(readlink -f "$0" 2>/dev/null || echo "$0")")/../.." && pwd)"
# Direct invocation and service restart both load the same ignored, owner-only .env.
if [[ -f "$REPO_DIR/.env" ]]; then
  chmod 600 "$REPO_DIR/.env" 2>/dev/null || true
  set -a
  # shellcheck disable=SC1091
  source "$REPO_DIR/.env"
  set +a
fi
ASISTAN_HOME="${ASISTAN_HOME:-$HOME/.asistan}"
LOG="$ASISTAN_HOME/log/tunel.log"
BIN="$HOME/cloudflared"
ROOTFS="/data/data/com.termux/files/usr/var/lib/proot-distro/containers/ubuntu/rootfs"
mkdir -p "$ASISTAN_HOME/log" "$ASISTAN_HOME/run"
chmod 700 "$ASISTAN_HOME" 2>/dev/null || true

if [[ ! -d "$ROOTFS" ]]; then
  echo "Ubuntu/proot-distro kurulu değil; Cloudflare tüneli başlatılamadı." >&2
  exit 1
fi
if [[ -x "$BIN" ]]; then
  cp -u "$BIN" "$ROOTFS/usr/local/bin/cloudflared"
  chmod 755 "$ROOTFS/usr/local/bin/cloudflared"
elif [[ ! -x "$ROOTFS/usr/local/bin/cloudflared" ]]; then
  echo "cloudflared bulunamadı: $BIN" >&2
  exit 1
fi
mkdir -p "$ROOTFS/root"
TOKEN_FILE="$ROOTFS/root/.cloudflared-tunnel-token"
if [[ -n "${CLOUDFLARED_TUNNEL_TOKEN:-}" ]]; then
  umask 077
  printf '%s' "$CLOUDFLARED_TUNNEL_TOKEN" > "$TOKEN_FILE"
  chmod 600 "$TOKEN_FILE"
  # Secret is read from a private file, never exposed in the process command line.
  exec proot-distro login ubuntu -- cloudflared tunnel run --token-file /root/.cloudflared-tunnel-token
else
  rm -f "$TOKEN_FILE"
  echo "${CLOUDFLARED_PUBLIC_URL:-} quick tunnel başlatılıyor (geçici URL, her yeniden başlatmada değişebilir)." >&2
  exec proot-distro login ubuntu -- cloudflared tunnel --url https://127.0.0.1:20131 --no-tls-verify
fi
