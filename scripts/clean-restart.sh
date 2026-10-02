#!/data/data/com.termux/files/usr/bin/bash
set -x

# 1. Servisleri durdur
bash /data/data/com.termux/files/home/asistanim-cebimde/scripts/termux/durdur.sh

# 2. Kalan tüm hayalet süreçleri temizle
pkill -9 -f "baresip"
pkill -9 -f "servis.sh baresip"
pkill -9 -f "proot.*baresip"
sleep 1

# 3. Kontrol et - baresip tamamen kapalı mı?
echo "Kalan baresip süreçleri:"
ps -ef | grep baresip | grep -v grep

# 4. Servisleri temiz başlat
bash /data/data/com.termux/files/home/asistanim-cebimde/scripts/termux/baslat.sh
sleep 3

# 5. Kontrol et - tam 1 baresip mi var?
echo "Başlatılan baresip süreçleri:"
ps -ef | grep baresip | grep -v grep
