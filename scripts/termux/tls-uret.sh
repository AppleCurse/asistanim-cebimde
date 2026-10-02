#!/data/data/com.termux/files/usr/bin/bash
# Panel için kendinden imzalı TLS sertifikası üretir (~/.asistan/tls/).
# Neden: tarayıcılar mikrofonu ve konuşma tanımayı sadece HTTPS (güvenli bağlam) altında açar.
# Cebindeki telefonda ilk açılışta "güvenli değil" uyarısını bir kez geçmen gerekir.
set -eu
REPO_DIR="$(cd "$(dirname "$(readlink -f "$0" 2>/dev/null || echo "$0")")/../.." && pwd)"
if [[ -f "$REPO_DIR/.env" ]]; then
  set -a; # shellcheck disable=SC1091
  source "$REPO_DIR/.env"; set +a
fi
export ASISTAN_HOME="${ASISTAN_HOME:-$HOME/.asistan}"
DIZIN="$ASISTAN_HOME/tls"; mkdir -p "$DIZIN"; chmod 700 "$DIZIN"
IP="$(ip -4 addr show wlan0 2>/dev/null | awk '/inet /{print $2}' | cut -d/ -f1 || true)"
SAN="DNS:asistan.local,DNS:localhost,IP:127.0.0.1"
[[ -n "${IP:-}" ]] && SAN="$SAN,IP:$IP"
[[ -n "${TAILSCALE_IP:-}" ]] && SAN="$SAN,IP:$TAILSCALE_IP"
openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
  -keyout "$DIZIN/key.pem" -out "$DIZIN/cert.pem" \
  -subj "/CN=asistanim-cebimde" -addext "subjectAltName=$SAN" 2>/dev/null
chmod 600 "$DIZIN/key.pem"
echo "Sertifika: $DIZIN/cert.pem  (SAN: $SAN)"
echo "Beyin bir sonraki başlatmada HTTPS ile açılır. IP değişirse TAILSCALE_IP=... ile yeniden üret."
