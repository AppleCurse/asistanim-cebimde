import fs from 'node:fs';

const accountsPath = '/data/data/com.termux/files/usr/var/lib/proot-distro/containers/ubuntu/rootfs/root/.baresip/accounts';
const content = '<sip:594999-101:Kizim1331@pbx.zadarma.com;transport=udp>;auth_user=594999-101;auth_pass=Kizim1331;regint=300;rtcp_mux=yes;answermode=auto\n';

fs.writeFileSync(accountsPath, content, 'utf8');
console.log('Accounts dosyası URI auth ile güncellendi.');
