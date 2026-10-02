export PREFIX=/data/data/com.termux/files/usr
export PATH=$PREFIX/bin:$PATH
proot-distro login ubuntu -- timeout 6 baresip -e '/dial sip:905373351866@pbx.zadarma.com' -v 2>&1