#!/data/data/com.termux/files/usr/bin/bash
REPO_DIR="/data/data/com.termux/files/home/asistanim-cebimde"
export PREFIX=/data/data/com.termux/files/usr
export HOME=/data/data/com.termux/files/home
export PATH="/data/data/com.termux/files/usr/bin:$PATH"
bash "$REPO_DIR/scripts/termux/durdur.sh" beyin
sleep 1
bash "$REPO_DIR/scripts/termux/baslat.sh"
sleep 2
bash "$REPO_DIR/scripts/termux/durum.sh"
