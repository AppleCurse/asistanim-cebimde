import fs from 'node:fs';
const p = '/data/data/com.termux/files/home/asistanim-cebimde/.env';
let c = fs.readFileSync(p, 'utf8');
c = c.replace(/SIP_USER=.*/m, 'SIP_USER=594999-100');
c = c.replace(/SIP_PASS=.*/m, 'SIP_PASS=vtpE4tK4t4');
fs.writeFileSync(p, c);
const check = fs.readFileSync(p, 'utf8').match(/(SIP_USER|SIP_PASS)=.*/gm);
console.log('OK:', check);
