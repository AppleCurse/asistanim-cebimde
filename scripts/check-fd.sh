#!/data/data/com.termux/files/usr/bin/bash
BEYIN_PID=$(pgrep -f "node.*beyin" | head -n 1)
echo "Beyin PID: $BEYIN_PID"
if [ -n "$BEYIN_PID" ]; then
  ls -l "/proc/$BEYIN_PID/fd"
fi
BARESIP_PID=$(pgrep -f "baresip" | head -n 1)
echo "Baresip PID: $BARESIP_PID"
if [ -n "$BARESIP_PID" ]; then
  ls -l "/proc/$BARESIP_PID/fd" 2>/dev/null
fi
ls -ld /data/data/com.termux/files/usr/var/lib/proot-distro/containers/ubuntu/rootfs/tmp/*.raw
