#!/usr/bin/env bash
# İndirilebilir paket üretir (git'e commit edilmiş dosyalardan; node_modules, .env, .git dışarıda kalır).
#   bash scripts/dev/paketle.sh [çıktı-dizini]     → varsayılan: deponun bir üstü
# Üretilenler:
#   asistanim-cebimde-v<sürüm>.zip      insanlar için (telefonda indir → Termux'ta aç)
#   asistanim-cebimde-v<sürüm>.tar.gz   aynı içerik
#   asistanim-cebimde.tar.gz            sabit isim → indir-kur.sh "releases/latest/download" ile çeker
set -eu
REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
CIKTI="${1:-$(dirname "$REPO_DIR")}"
SURUM="$(node -p "require('$REPO_DIR/package.json').version")"
AD="asistanim-cebimde"
mkdir -p "$CIKTI"
cd "$REPO_DIR"
git archive --format=zip    --prefix="$AD/" -o "$CIKTI/$AD-v$SURUM.zip"    HEAD
git archive --format=tar.gz --prefix="$AD/" -o "$CIKTI/$AD-v$SURUM.tar.gz" HEAD
cp "$CIKTI/$AD-v$SURUM.tar.gz" "$CIKTI/$AD.tar.gz"
cp "$REPO_DIR/scripts/termux/indir-kur.sh" "$CIKTI/indir-kur.sh"
ls -la "$CIKTI/$AD-v$SURUM.zip" "$CIKTI/$AD-v$SURUM.tar.gz" "$CIKTI/$AD.tar.gz" "$CIKTI/indir-kur.sh"
