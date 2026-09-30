#!/data/data/com.termux/files/usr/bin/bash
export PATH=/data/data/com.termux/files/usr/bin:$PATH
ASISTAN_HOME="${ASISTAN_HOME:-$HOME/.asistan}"
LOG="$ASISTAN_HOME/log/tunel.log"
PID_FILE="$ASISTAN_HOME/run/tunel.pid"
BIN="$HOME/cloudflared"

mkdir -p "$ASISTAN_HOME/log" "$ASISTAN_HOME/run"

# Varsa eski tüneli durdur
if [[ -f "$PID_FILE" ]]; then
  old_pid=$(cat "$PID_FILE" 2>/dev/null)
  [[ -n "$old_pid" ]] && kill "$old_pid" 2>/dev/null
fi
pkill -f "cloudflared" 2>/dev/null || true

# Proot içerisine kopyala (varsa atla)
ROOTFS="/data/data/com.termux/files/usr/var/lib/proot-distro/containers/ubuntu/rootfs"
[[ -d "$ROOTFS" ]] && cp -u "$BIN" "$ROOTFS/usr/local/bin/cloudflared" && chmod +x "$ROOTFS/usr/local/bin/cloudflared"

# Proot içinde çalıştır (DNS resolv.conf 8.8.8.8 düzgün çalışır)
nohup proot-distro login ubuntu -- cloudflared tunnel --url https://127.0.0.1:20131 --no-tls-verify > "$LOG" 2>&1 &
echo $! > "$PID_FILE"
