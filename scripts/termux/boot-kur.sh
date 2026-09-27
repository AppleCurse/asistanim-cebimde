#!/data/data/com.termux/files/usr/bin/bash
# Termux:Boot kancası: telefon açılınca (veya Termux:Boot ilk açıldığında) asistan kendiliğinden kalkar.
# Gereksinim: F-Droid'den "Termux:Boot" uygulamasını kur ve BİR KEZ aç.
set -eu
REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
mkdir -p "$HOME/.termux/boot"
cat > "$HOME/.termux/boot/asistan.sh" <<EOF
#!/data/data/com.termux/files/usr/bin/bash
termux-wake-lock
sleep 15   # Wi-Fi'nin gelmesini bekle
bash "$REPO_DIR/scripts/termux/baslat.sh" >> "\$HOME/.asistan/log/boot.log" 2>&1
EOF
chmod +x "$HOME/.termux/boot/asistan.sh"
echo "Kuruldu: ~/.termux/boot/asistan.sh"
echo "Not: Termux:Boot uygulamasını en az bir kez aç; MIUI'de Termux için 'Otomatik başlat' iznini ver."
