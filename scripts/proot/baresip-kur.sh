#!/bin/bash
# Baresip VoIP / SIP yapılandırıcısı: .env'deki SIP_* bilgilerini okuyarak
# proot Ubuntu içindeki ALSA (.asoundrc) ve Baresip (config, accounts) dosyalarını üretir.
#   Kullanım: bash scripts/proot/baresip-kur.sh
set -eu

REPO_DIR="$(cd "$(dirname "$(readlink -f "$0" 2>/dev/null || echo "$0")")/../.." && pwd)"

# .env varsa yükle
if [[ -f "$REPO_DIR/.env" ]]; then
  set -a
  source "$REPO_DIR/.env"
  set +a
fi

SIP_USER="${SIP_USER:-594999-101}"
SIP_PASS="${SIP_PASS:-}"
SIP_SERVER="${SIP_SERVER:-pbx.zadarma.com}"
SIP_PORT="${SIP_PORT:-5060}"

echo "▶ Baresip Yapılandırması Hazırlanıyor"
echo "  Kullanıcı : $SIP_USER"
echo "  Sunucu    : $SIP_SERVER:$SIP_PORT"

# Proot içi veya doğrudan çalıştırma tespiti
PROOT_ROOT=""
if [[ -d "/data/data/com.termux/files/usr/var/lib/proot-distro/containers/ubuntu" ]]; then
  # Termux'tan çalıştırılıyorsa
  PROOT_ROOT="/data/data/com.termux/files/usr/var/lib/proot-distro/containers/ubuntu/rootfs"
  [[ ! -d "$PROOT_ROOT" ]] && PROOT_ROOT="/data/data/com.termux/files/usr/var/lib/proot-distro/installed-rootfs/ubuntu"
fi

HEDEF_HOME="$PROOT_ROOT/root"
HEDEF_TMP="$PROOT_ROOT/tmp"
mkdir -p "$HEDEF_HOME/.baresip" "$HEDEF_TMP"

# 1. ALSA sanal aygıtları (.asoundrc)
echo "▶ .asoundrc yazılıyor (mic -> /tmp/mic.raw, spk -> /tmp/spk.raw)"
cat << 'EOF' > "$HEDEF_HOME/.asoundrc"
pcm.!default {
    type plug
    slave.pcm "null"
}
pcm.mic {
    type plug
    slave {
        pcm {
            type file
            file "/tmp/mic.raw"
            format "raw"
            slave {
                pcm "null"
            }
        }
    }
}
pcm.spk {
    type plug
    slave {
        pcm {
            type file
            file "/tmp/spk.raw"
            format "raw"
            slave {
                pcm "null"
            }
        }
    }
}
EOF

# 2. Baresip config
echo "▶ ~/.baresip/config yazılıyor (ALSA ses + ctrl_tcp:4444)"
cat << 'EOF' > "$HEDEF_HOME/.baresip/config"
poll_method epoll

# Ses Giriş / Çıkış: ALSA sanal dosya aygıtları
audio_source alsa,mic
audio_player alsa,spk
audio_alert alsa,spk

# Modüller
module_path /usr/lib/baresip/modules
module stdio.so
module cons.so
module contact.so
module alsa.so
module g711.so
module account.so
module ctrl_tcp.so

# TCP Kontrol Arayüzü (Beyin bağlantısı için)
ctrl_tcp_listen 127.0.0.1:4444
EOF

# 3. Baresip accounts
echo "▶ ~/.baresip/accounts yazılıyor"
cat << EOF > "$HEDEF_HOME/.baresip/accounts"
<sip:${SIP_USER}@${SIP_SERVER}>;auth_pass=${SIP_PASS};regint=600;rtcp_mux=yes
EOF
chmod 600 "$HEDEF_HOME/.baresip/accounts"

# 4. FIFO / Ham ses borularını hazırla
touch "$HEDEF_TMP/mic.raw" "$HEDEF_TMP/spk.raw"
chmod 666 "$HEDEF_TMP/mic.raw" "$HEDEF_TMP/spk.raw"

echo "✅ Baresip ve ALSA kurulumu başarıyla tamamlandı."
