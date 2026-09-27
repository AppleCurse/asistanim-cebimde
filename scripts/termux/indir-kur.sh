#!/data/data/com.termux/files/usr/bin/bash
# TEK SATIR KURULUM — eski telefonda Termux'a yapıştır:
#
#   curl -fsSL https://github.com/AppleCurse/asistanim-cebimde/releases/latest/download/indir-kur.sh | bash
#
# Seçenekler (bash -s -- ile):   ... | bash -s -- --tls --proot
#   --tls    panel için HTTPS sertifikası (tarayıcıda mikrofon için gerekir)
#   --proot  Ubuntu + 9remote de kurulsun
# Ortam:  ASISTAN_DAL=main  → sürüm paketi yerine git'ten o dalı çeker (geliştirme)
set -eu

if [[ "${PREFIX:-}" != *com.termux* ]]; then
  echo "Bu kurulum Termux içinde çalışır (F-Droid'den Termux kur, içinde çalıştır)." >&2
  exit 1
fi

DEPO="AppleCurse/asistanim-cebimde"
HEDEF="${ASISTAN_DIZIN:-$HOME/asistanim-cebimde}"
PAKET_URL="https://github.com/$DEPO/releases/latest/download/asistanim-cebimde.tar.gz"

printf '\n\033[1;32m▶ Asistanım Cebimde indiriliyor\033[0m\n'
pkg install -y curl tar >/dev/null 2>&1 || pkg install -y curl tar

if [[ -n "${ASISTAN_DAL:-}" ]]; then
  pkg install -y git >/dev/null 2>&1 || true
  if [[ -d "$HEDEF/.git" ]]; then
    git -C "$HEDEF" fetch --depth 1 origin "$ASISTAN_DAL" && git -C "$HEDEF" checkout -q FETCH_HEAD
  else
    git clone --depth 1 -b "$ASISTAN_DAL" "https://github.com/$DEPO" "$HEDEF"
  fi
else
  GECICI="$(mktemp -d)"
  if ! curl -fsSL --retry 3 -o "$GECICI/paket.tar.gz" "$PAKET_URL"; then
    # Paket dosyası (henüz) yoksa: son sürümün etiketini bul, GitHub'ın kaynak arşivini kullan
    ETIKET="$(curl -fsSLI -o /dev/null -w '%{url_effective}' "https://github.com/$DEPO/releases/latest" | sed 's#.*/tag/##')"
    [[ -n "$ETIKET" && "$ETIKET" != *"/"* ]] || ETIKET="main"
    echo "  paket bulunamadı, kaynak arşivi indiriliyor: $ETIKET"
    curl -fL --retry 3 -o "$GECICI/paket.tar.gz" "https://github.com/$DEPO/archive/refs/tags/$ETIKET.tar.gz" \
      || curl -fL --retry 3 -o "$GECICI/paket.tar.gz" "https://github.com/$DEPO/archive/refs/heads/$ETIKET.tar.gz"
  fi
  mkdir -p "$HEDEF"
  # Arşivin üst dizini atlanarak hedefe açılır (mevcut .env ve ~/.asistan dokunulmaz)
  tar -xzf "$GECICI/paket.tar.gz" -C "$HEDEF" --strip-components=1
  rm -rf "$GECICI"
fi

echo "  → $HEDEF"
exec bash "$HEDEF/scripts/termux/kur.sh" "$@"
