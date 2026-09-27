#!/bin/bash
# Ubuntu (proot) İÇİNDE çalışır. ubuntu-kur.sh tarafından çağrılır; elle de çalıştırılabilir:
#   proot-distro login ubuntu -- bash /tmp/icerde-kur.sh [--9router]
set -eu
export DEBIAN_FRONTEND=noninteractive
KUR_9ROUTER=0
for a in "$@"; do [[ "$a" == "--9router" ]] && KUR_9ROUTER=1; done

echo "▶ apt paketleri"
apt-get update -y
apt-get install -y curl ca-certificates git build-essential python3 make g++ pkg-config nano

echo "▶ Node.js 22"
if ! command -v node >/dev/null || [[ "$(node -v | cut -c2-3)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v; npm -v

# node-machine-id /etc/machine-id ister; proot'ta yoktur
if [[ ! -s /etc/machine-id ]]; then
  tr -d '-' < /proc/sys/kernel/random/uuid > /etc/machine-id
fi

echo "▶ 9remote (uzaktan IDE/terminal/masaüstü)"
npm install -g 9remote --no-audit --no-fund

if [[ $KUR_9ROUTER -eq 1 ]]; then
  echo "▶ 9router (proot içine de)"
  npm install -g 9router --no-audit --no-fund
fi

echo "✅ proot içi kurulum tamam. 9remote sürümü: $(9remote --version 2>/dev/null || echo '?')"
