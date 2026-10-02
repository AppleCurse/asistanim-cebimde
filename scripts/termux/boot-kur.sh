#!/data/data/com.termux/files/usr/bin/bash
# Termux:Boot kancası: telefon açılınca (veya Termux:Boot ilk açıldığında) asistan kendiliğinden kalkar.
# Gereksinim: F-Droid'den "Termux:Boot" uygulamasını kur ve BİR KEZ aç.
set -eu
export PREFIX="${PREFIX:-/data/data/com.termux/files/usr}"
export HOME="${TERMUX_HOME:-/data/data/com.termux/files/home}"
export PATH="$PREFIX/bin:$PATH"
REPO_DIR="$(cd "$(dirname "$(readlink -f "$0" 2>/dev/null || echo "$0")")/../.." && pwd)"
if [[ -f "$REPO_DIR/.env" ]]; then
  set -a; # shellcheck disable=SC1091
  source "$REPO_DIR/.env"; set +a
fi
ASISTAN_HOME="${ASISTAN_HOME:-$HOME/.asistan}"
mkdir -p "$HOME/.termux/boot" "$ASISTAN_HOME/log"
Q_REPO_DIR="$(printf '%q' "$REPO_DIR")"

cat > "$HOME/.termux/boot/asistan.sh" <<EOF
#!/data/data/com.termux/files/usr/bin/bash
set -eu
export PREFIX="\${PREFIX:-/data/data/com.termux/files/usr}"
export HOME="\${TERMUX_HOME:-/data/data/com.termux/files/home}"
export PATH="\$PREFIX/bin:\$PATH"
REPO_DIR=$Q_REPO_DIR
if [[ -f "\$REPO_DIR/.env" ]]; then
  set -a
  source "\$REPO_DIR/.env"
  set +a
fi
export ASISTAN_HOME="\${ASISTAN_HOME:-\$HOME/.asistan}"
termux-wake-lock
sleep 15   # Wi-Fi'nin gelmesini bekle
mkdir -p "\$ASISTAN_HOME/log"
bash "\$REPO_DIR/scripts/termux/baslat.sh" >> "\$ASISTAN_HOME/log/boot.log" 2>&1
EOF
chmod +x "$HOME/.termux/boot/asistan.sh"
echo "Kuruldu: ~/.termux/boot/asistan.sh"
echo "Not: Termux:Boot uygulamasını en az bir kez aç; MIUI'de Termux için 'Otomatik başlat' iznini ver."
