#!/data/data/com.termux/files/usr/bin/bash
grep -E "CALL_|ÇAĞRI|Arama durumu|Arama tamamlandı" /data/data/com.termux/files/home/.asistan/log/beyin.log | tail -n 40
