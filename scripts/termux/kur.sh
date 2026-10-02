#!/data/data/com.termux/files/usr/bin/bash
# Asistanım Cebimde — TERMUX KURULUMU (eski telefonda, Termux içinde çalıştır)
#
#   git clone https://github.com/AppleCurse/asistanim-cebimde ~/asistanim-cebimde
#   bash ~/asistanim-cebimde/scripts/termux/kur.sh
#
# Ne yapar: paketleri kurar, Node bağımlılıklarını yükler, 9router'ı kurar,
# ~/.asistan dizinini/tokenları oluşturur, sonraki adımları yazar.
# Seçenekler:  --proot   proot-distro + Ubuntu'yu da kurar (9remote için)
#              --tls     panel için kendinden imzalı sertifika üretir (mikrofon izni için gerekir)
set -euo pipefail
umask 077

if [[ "${PREFIX:-}" != *com.termux* ]]; then
  echo "Bu script Termux içinde çalışmalı." >&2
  exit 1
fi

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
if [[ -f "$REPO_DIR/.env" ]]; then
  chmod 600 "$REPO_DIR/.env" 2>/dev/null || true
  set -a; # shellcheck disable=SC1091
  source "$REPO_DIR/.env"; set +a
fi
ASISTAN_HOME="${ASISTAN_HOME:-$HOME/.asistan}"
PROOT=0; TLS=0
for a in "$@"; do
  case "$a" in
    --proot) PROOT=1 ;;
    --tls) TLS=1 ;;
    *) echo "bilinmeyen seçenek: $a" >&2; exit 1 ;;
  esac
done

adim() { printf '\n\033[1;32m▶ %s\033[0m\n' "$*"; }

adim "Paketler güncelleniyor"
pkg update -y && pkg upgrade -y

adim "Gerekli paketler kuruluyor (node, termux-api, ffmpeg, zbar, openssh, ...)"
pkg install -y nodejs-lts git termux-api openssh ffmpeg jq zbar openssl-tool iproute2 curl
[[ $PROOT -eq 1 ]] && pkg install -y proot-distro

adim "Depolama izni (fotoğraf/ses dosyalarına Android'den erişmek için, isteğe bağlı)"
[[ -d "$HOME/storage" ]] || termux-setup-storage || true

adim "Proje bağımlılıkları"
cd "$REPO_DIR"
npm install --omit=dev --no-audit --no-fund

adim "9router kuruluyor (LLM + STT + TTS musluğu)"
npm install -g 9router --no-audit --no-fund

adim "~/.asistan hazırlanıyor (ayarlar + tokenlar)"
export ASISTAN_HOME
node -e "import('$REPO_DIR/ortak/ayar.mjs').then(m => { m.ayarYukle(); m.tokenAl('beden'); m.tokenAl('beyin'); console.log('ayar:', m.AYAR_DOSYASI); })"
[[ -f "$REPO_DIR/.env" ]] || cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"
chmod 600 "$REPO_DIR/.env" 2>/dev/null || true

if [[ $TLS -eq 1 ]]; then
  adim "TLS sertifikası"
  bash "$REPO_DIR/scripts/termux/tls-uret.sh"
fi

if [[ $PROOT -eq 1 ]]; then
  adim "Ubuntu (proot) + 9remote"
  bash "$REPO_DIR/scripts/proot/ubuntu-kur.sh"
fi

adim "Termux:API izinleri tetikleniyor (kamera/mikrofon izin pencereleri çıkabilir)"
termux-battery-status >/dev/null 2>&1 && echo "termux-api çalışıyor ✓" || echo "UYARI: Termux:API uygulaması kurulu değil gibi (F-Droid'den 'Termux:API' kur, sonra tekrar dene)."
termux-camera-info >/dev/null 2>&1 || true
termux-tts-engines >/dev/null 2>&1 || true

cat <<EOF

✅ Kurulum bitti. Sıradaki adımlar:

1) Telefonda kurulu olması gerekenler (F-Droid, Play Store sürümleriyle KARIŞTIRMA):
   - Termux:API   → kamera, mikrofon, telefon, SMS, bildirim
   - Termux:Boot  → telefon açılınca asistanın kendiliğinden kalkması
   Android Ayarlar → Uygulamalar → Termux / Termux:API → yalnızca kullanacağın işlevlerin OS izinlerini ver.
   OS izni, uygulamadaki ayrı config.json yetenek kapısını açmaz; telefon/SMS/konum/kişiler/kabuk kapıları ayrıca bilinçli açılmadıkça kapalı kalır.
   MIUI: Pil tasarrufu → Termux için "Kısıtlama yok" + "Otomatik başlat" aç. Geliştirici seçenekleri → "MIUI optimizasyonu" kapat (isteğe bağlı).

2) Güvenli ilk parolayla 9router'ı başlat ve bir sağlayıcı bağla:
     bash $REPO_DIR/scripts/termux/9router-servis.sh  # ön planda; durdurmak için Ctrl+C
   İlk parola "$ASISTAN_HOME/9router.initial-password" dosyasına 0600 izinle kaydedilir; başka Termux oturumundan şu komutla oku: cat "$ASISTAN_HOME/9router.initial-password".
   Tarayıcıda http://localhost:20128 → Providers → ücretsiz bir sağlayıcı bağla (OpenCode Free / Kiro) veya kendi API anahtarını gir.
   Dashboard'daki API key'i ve model adını $REPO_DIR/.env içine yaz: LLM_API_KEY=..., LLM_MODEL=...

3) Hepsini ayağa kaldır:
     bash $REPO_DIR/scripts/termux/baslat.sh
   Cebindeki telefondan panel adresini (script yazar) aç.

4) Açılışta otomatik başlasın:
     bash $REPO_DIR/scripts/termux/boot-kur.sh

Ayarlar: $ASISTAN_HOME/config.json   (telefon/SMS/konum izinleri varsayılan KAPALI — bilinçli aç)
EOF
