#!/data/data/com.termux/files/usr/bin/bash
# Termux'tan çalıştırılır: proot-distro ile Ubuntu kurar, içine Node 22 + 9remote (+ isteğe bağlı 9router) koyar.
# 9remote'un native modülleri (sharp, koffi, node-pty, node-datachannel) glibc ister; Termux'un bionic libc'sinde
# çalışmaz → bu yüzden proot Ubuntu. 9router saf JS olduğundan Termux'ta doğrudan çalışır (kur.sh oraya kurar).
set -eu
REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
command -v proot-distro >/dev/null || pkg install -y proot-distro

if ! proot-distro list 2>/dev/null | grep -A3 'ubuntu' | grep -qi 'installed'; then
  echo "▶ Ubuntu indiriliyor (≈ 100 MB, birkaç dakika)"
  proot-distro install ubuntu
else
  echo "▶ Ubuntu zaten kurulu"
fi

# İç scripti paylaşılan /tmp üzerinden içeri taşı
cp "$REPO_DIR/scripts/proot/icerde-kur.sh" "$PREFIX/tmp/icerde-kur.sh"
echo "▶ Ubuntu içinde kurulum"
proot-distro login ubuntu --shared-tmp -- bash /tmp/icerde-kur.sh "$@"

cat <<EOF

✅ Ubuntu + 9remote hazır.
İlk eşleşme (bir kez, elle):   bash $REPO_DIR/scripts/proot/9remote.sh
  → QR çıkar, cebindeki telefonla okut → Termux ekranında "Approve" onayla.
Sonra arka planda:              ENABLE_9REMOTE=1 bash $REPO_DIR/scripts/termux/baslat.sh
EOF
