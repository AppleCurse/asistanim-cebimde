#!/data/data/com.termux/files/usr/bin/bash
# Asistanı ayağa kaldırır: sshd + 9router + beden + beyin (+ isteğe bağlı 9remote).
# Her servis servis.sh ile "ölürse yeniden doğar". Loglar: ~/.asistan/log/
#   bash scripts/termux/baslat.sh            # hepsini başlat
#   ENABLE_9REMOTE=1 bash scripts/termux/baslat.sh   # proot içindeki 9remote'u da (ilk eşleşmeyi önce elle yap!)
set -u
export PREFIX="${PREFIX:-/data/data/com.termux/files/usr}"
export HOME="${TERMUX_HOME:-/data/data/com.termux/files/home}"
export PATH="/data/data/com.termux/files/usr/bin:$PREFIX/bin:$PATH"
unset LD_PRELOAD

REPO_DIR="$(cd "$(dirname "$(readlink -f "$0" 2>/dev/null || echo "$0")")/../.." && pwd)"
export ASISTAN_HOME="${ASISTAN_HOME:-$HOME/.asistan}"
RUN="$ASISTAN_HOME/run"; mkdir -p "$RUN" "$ASISTAN_HOME/log"
SERVIS="$REPO_DIR/scripts/termux/servis.sh"

# .env yükle (LLM_API_KEY, LLM_MODEL, ... )
if [[ -f "$REPO_DIR/.env" ]]; then
  set -a; # shellcheck disable=SC1091
  source "$REPO_DIR/.env"; set +a
fi

yasiyor() { [[ -f "$RUN/$1.pid" ]] && kill -0 "$(cat "$RUN/$1.pid")" 2>/dev/null; }
baslat() {
  local ad="$1"; shift
  if yasiyor "$ad"; then echo "  $ad zaten çalışıyor (pid $(cat "$RUN/$ad.pid"))"; return; fi
  setsid "$SERVIS" "$ad" "$@" </dev/null >/dev/null 2>&1 &
  sleep 0.3
  echo "  $ad başlatıldı"
}

echo "▶ Uyanık kalma kilidi"
termux-wake-lock 2>/dev/null || echo "  (termux-wake-lock yok — Termux:API kurulu mu?)"

echo "▶ Servisler"
command -v sshd >/dev/null && { pgrep -x sshd >/dev/null || sshd; echo "  sshd (port 8022)"; }
if [[ "${ENABLE_9ROUTER:-0}" == "1" ]] && [[ -f "$REPO_DIR/scripts/termux/9router-servis.sh" ]] && command -v 9router >/dev/null; then
  baslat 9router bash "$REPO_DIR/scripts/termux/9router-servis.sh"
else
  echo "  9router atlandı (.env doğrudan OpenRouter/Groq kullanıyor)"
fi
baslat beden node "$REPO_DIR/beden/server.mjs"
baslat beyin  node "$REPO_DIR/beyin/index.mjs"
if command -v proot-distro >/dev/null; then
  baslat baresip proot-distro login --bind /dev/zero:/dev/full ubuntu -- baresip
fi
if [[ -f "$REPO_DIR/scripts/termux/tunel.sh" ]]; then
  baslat tunel bash "$REPO_DIR/scripts/termux/tunel.sh"
fi
if [[ "${ENABLE_9REMOTE:-0}" == "1" ]]; then
  baslat 9remote bash "$REPO_DIR/scripts/proot/9remote.sh"
fi

sleep 2
echo
echo "▶ Durum"
bash "$REPO_DIR/scripts/termux/durum.sh"
