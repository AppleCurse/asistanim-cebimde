#!/data/data/com.termux/files/usr/bin/bash
ps -ef | grep -E "node|baresip"
NODE_PIDS=$(pgrep -f "node")
for p in $NODE_PIDS; do
  echo "--- PID $p cmd: $(tr '\0' ' ' < /proc/$p/cmdline 2>/dev/null) ---"
  ls -l /proc/$p/fd 2>/dev/null | grep -E "raw|pipe|socket|log"
done
