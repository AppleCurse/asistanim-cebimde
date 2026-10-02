#!/data/data/com.termux/files/usr/bin/bash
echo "=== PROCS ==="
ps -ef | grep -E "node|baresip|servis" | grep -v grep

echo "=== SON GÖREVLER ==="
ls -lt /data/data/com.termux/files/home/.asistan/gorevler/ 2>/dev/null | head -n 5

echo "=== BEYİN LOG (SON 20 SATIR) ==="
tail -n 20 /data/data/com.termux/files/home/.asistan/log/beyin.log 2>/dev/null

echo "=== BARESIP LOG (SON 20 SATIR) ==="
tail -n 20 /data/data/com.termux/files/home/.asistan/log/baresip.log 2>/dev/null
